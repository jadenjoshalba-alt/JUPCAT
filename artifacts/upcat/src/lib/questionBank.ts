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
