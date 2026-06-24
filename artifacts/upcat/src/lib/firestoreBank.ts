import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BankQuestion, getBankQuestions, saveBankQuestions } from "@/lib/questionBank";

function bankRef(uid: string) {
  return doc(db, "user_questionbanks", uid);
}

/** Recursively strip all undefined values from an object. Firestore rejects undefined. */
function stripUndefined(obj: unknown): unknown {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === "object" && obj !== null) {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) clean[key] = stripUndefined(val);
    }
    return clean;
  }
  return obj;
}

function cleanQuestions(questions: BankQuestion[]): unknown[] {
  return questions.map((q) => {
    const base: Record<string, unknown> = {
      id: q.id,
      subject: q.subject,
      text: q.text,
      choices: q.choices,
      correctAnswer: q.correctAnswer,
    };
    if (q.topic) base.topic = q.topic;
    if (q.explanation) base.explanation = q.explanation;
    return stripUndefined(base);
  });
}

export async function uploadBankToFirestore(uid: string): Promise<void> {
  const questions = getBankQuestions();
  await setDoc(bankRef(uid), {
    questions: cleanQuestions(questions),
    updatedAt: serverTimestamp(),
  });
}

export async function downloadBankFromFirestore(uid: string): Promise<BankQuestion[]> {
  const snap = await getDoc(bankRef(uid));
  if (!snap.exists()) return [];
  const data = snap.data();
  return (data?.questions ?? []) as BankQuestion[];
}

export async function syncBankWithFirestore(uid: string): Promise<{ merged: number }> {
  const remote = await downloadBankFromFirestore(uid);
  const local = getBankQuestions();
  const localIds = new Set(local.map((q) => q.id));
  const toAdd = remote.filter((q) => !localIds.has(q.id));
  const merged = [...local, ...toAdd];
  saveBankQuestions(merged);
  await setDoc(bankRef(uid), {
    questions: cleanQuestions(merged),
    updatedAt: serverTimestamp(),
  });
  return { merged: toAdd.length };
}
