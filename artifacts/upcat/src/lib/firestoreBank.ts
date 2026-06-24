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

export async function uploadBankToFirestore(uid: string): Promise<void> {
  const questions = getBankQuestions();
  await setDoc(bankRef(uid), {
    questions,
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
    questions: merged,
    updatedAt: serverTimestamp(),
  });
  return { merged: toAdd.length };
}
