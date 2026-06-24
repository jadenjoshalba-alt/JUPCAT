export interface BankQuestion {
  id: string;
  subject: string;
  topic?: string;
  text: string;
  imageUrl?: string;
  choices: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

const BANK_KEY = "upcat_question_bank";
const USED_KEY = "upcat_used_question_ids";

export function getBankQuestions(): BankQuestion[] {
  try {
    const raw = localStorage.getItem(BANK_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BankQuestion[];
  } catch {
    return [];
  }
}

export function saveBankQuestions(questions: BankQuestion[]): void {
  localStorage.setItem(BANK_KEY, JSON.stringify(questions));
}

export function addBankQuestions(incoming: BankQuestion[]): { added: number; skipped: number } {
  const existing = getBankQuestions();
  const existingIds = new Set(existing.map((q) => q.id));
  const toAdd = incoming.filter((q) => !existingIds.has(q.id));
  saveBankQuestions([...existing, ...toAdd]);
  return { added: toAdd.length, skipped: incoming.length - toAdd.length };
}

export function clearBank(): void {
  localStorage.removeItem(BANK_KEY);
  localStorage.removeItem(USED_KEY);
}

export function getUsedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(USED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markQuestionsUsed(ids: string[]): void {
  const used = getUsedIds();
  ids.forEach((id) => used.add(id));
  localStorage.setItem(USED_KEY, JSON.stringify([...used]));
}

export function resetUsedIds(): void {
  localStorage.removeItem(USED_KEY);
}

function getPassageId(q: BankQuestion): string | null {
  if (q.subject.startsWith("reading_") && (q as any).passageId) {
    return (q as any).passageId;
  }
  if (q.subject.startsWith("reading_") && q.text.startsWith("PASSAGE:")) {
    const match = q.text.match(/^PASSAGE:\s*\n?([\s\S]*?)\n?\nQUESTION:/i);
    if (match) {
      const passageHash = match[1].trim().slice(0, 80);
      return passageHash;
    }
  }
  return null;
}

export function pickQuestions(
  subject: string,
  count: number,
  topics: string[]
): BankQuestion[] {
  const all = getBankQuestions();
  const used = getUsedIds();

  const filterFn = (q: BankQuestion) => {
    if (q.subject !== subject) return false;
    if (topics.length > 0 && q.topic && !topics.includes(q.topic)) return false;
    return true;
  };

  const candidates = all.filter(filterFn);
  const unused = candidates.filter((q) => !used.has(q.id));
  const pool = unused.length >= count ? unused : candidates;

  // For reading comprehension, keep passages grouped together
  if (subject.startsWith("reading_")) {
    // Group by passage
    const passageGroups: Record<string, BankQuestion[]> = {};
    const standalone: BankQuestion[] = [];
    for (const q of pool) {
      const pid = getPassageId(q);
      if (pid) {
        if (!passageGroups[pid]) passageGroups[pid] = [];
        passageGroups[pid].push(q);
      } else {
        standalone.push(q);
      }
    }

    // Shuffle passage groups
    const groupKeys = Object.keys(passageGroups).sort(() => Math.random() - 0.5);

    let result: BankQuestion[] = [];
    for (const key of groupKeys) {
      const group = passageGroups[key];
      // If adding this whole group would exceed count by too much, skip
      if (result.length + group.length > count && result.length > 0) {
        continue;
      }
      result = result.concat(group);
    }

    // Add standalone questions if needed to reach count
    const shuffledStandalone = [...standalone].sort(() => Math.random() - 0.5);
    while (result.length < count && shuffledStandalone.length > 0) {
      const q = shuffledStandalone.pop()!;
      if (!result.some((r) => r.id === q.id)) {
        result.push(q);
      }
    }

    return result;
  }

  // For other subjects, just shuffle and pick
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getBankStats(subject?: string): { total: number; unused: number } {
  const all = getBankQuestions();
  const used = getUsedIds();
  const filtered = subject ? all.filter((q) => q.subject === subject) : all;
  const unused = filtered.filter((q) => !used.has(q.id)).length;
  return { total: filtered.length, unused };
}
