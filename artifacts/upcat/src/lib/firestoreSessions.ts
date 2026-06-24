import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Session, SessionAnswer } from "@/types/session";

function userSessionsCol(uid: string) {
  return collection(db, "user_sessions", uid, "quizzes");
}

export async function saveSession(
  uid: string,
  data: {
    answers: SessionAnswer[];
    totalScore: number;
    correctCount?: number;
    wrongCount?: number;
    blankCount?: number;
    totalQuestions: number;
    timeTakenSeconds: number;
  }
): Promise<Session> {
  const ref = await addDoc(userSessionsCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    ...data,
    createdAt: new Date().toISOString(),
  };
}

export async function listSessions(uid: string): Promise<Session[]> {
  const q = query(userSessionsCol(uid), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const raw = d.data();
    const createdAt =
      raw.createdAt instanceof Timestamp
        ? raw.createdAt.toDate().toISOString()
        : typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString();

    const answers: SessionAnswer[] = raw.answers ?? [];
    const correctCount = raw.correctCount ?? answers.filter((a) => a.isCorrect).length;
    const wrongCount = raw.wrongCount ?? answers.filter((a) => !a.isCorrect && !a.isBlank).length;
    const blankCount = raw.blankCount ?? answers.filter((a) => a.isBlank).length;

    return {
      id: d.id,
      answers,
      totalScore: raw.totalScore ?? 0,
      correctCount,
      wrongCount,
      blankCount,
      totalQuestions: raw.totalQuestions ?? 0,
      timeTakenSeconds: raw.timeTakenSeconds ?? 0,
      createdAt,
    } as Session;
  });
}

export async function getSession(uid: string, sessionId: string): Promise<Session | null> {
  const ref = doc(db, "user_sessions", uid, "quizzes", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data();
  const createdAt =
    raw.createdAt instanceof Timestamp
      ? raw.createdAt.toDate().toISOString()
      : typeof raw.createdAt === "string"
      ? raw.createdAt
      : new Date().toISOString();

  const answers: SessionAnswer[] = raw.answers ?? [];
  const correctCount = raw.correctCount ?? answers.filter((a) => a.isCorrect).length;
  const wrongCount = raw.wrongCount ?? answers.filter((a) => !a.isCorrect && !a.isBlank).length;
  const blankCount = raw.blankCount ?? answers.filter((a) => a.isBlank).length;

  return {
    id: snap.id,
    answers,
    totalScore: raw.totalScore ?? 0,
    correctCount,
    wrongCount,
    blankCount,
    totalQuestions: raw.totalQuestions ?? 0,
    timeTakenSeconds: raw.timeTakenSeconds ?? 0,
    createdAt,
  } as Session;
}
