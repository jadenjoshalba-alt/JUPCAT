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

function cleanAnswer(ans: SessionAnswer): Record<string, unknown> {
  const base = {
    questionId: ans.questionId,
    subject: ans.subject,
    questionText: ans.questionText,
    selectedAnswer: ans.selectedAnswer,
    correctAnswer: ans.correctAnswer,
    isCorrect: ans.isCorrect,
    isBlank: ans.isBlank,
  };
  if (ans.explanation) base.explanation = ans.explanation;
  if (ans.choices) base.choices = ans.choices;
  return stripUndefined(base) as Record<string, unknown>;
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
  const cleanData = {
    answers: data.answers.map(cleanAnswer),
    totalScore: data.totalScore,
    correctCount: data.correctCount ?? 0,
    wrongCount: data.wrongCount ?? 0,
    blankCount: data.blankCount ?? 0,
    totalQuestions: data.totalQuestions,
    timeTakenSeconds: data.timeTakenSeconds,
  };
  const ref = await addDoc(userSessionsCol(uid), {
    ...cleanData,
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    ...data,
    createdAt: new Date().toISOString(),
  };
}

export async function listSessions(uid: string): Promise<Session[]> {
  try {
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
  } catch (err) {
    console.error("[listSessions] Firestore error:", err);
    throw err;
  }
}

export async function getSession(uid: string, sessionId: string): Promise<Session | null> {
  try {
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
  } catch (err) {
    console.error("[getSession] Firestore error:", err);
    throw err;
  }
}
