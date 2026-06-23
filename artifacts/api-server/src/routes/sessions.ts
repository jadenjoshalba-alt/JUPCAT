import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { CreateSessionBody, GetSessionParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .orderBy(sessionsTable.createdAt);

  const result = sessions.map((s) => ({
    ...s,
    totalScore: Number(s.totalScore),
    answers: s.answers,
  }));

  res.json(result);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { answers, totalScore, totalQuestions, timeTakenSeconds } = parsed.data;

  const [session] = await db
    .insert(sessionsTable)
    .values({
      answers: answers as unknown as Record<string, unknown>[],
      totalScore: String(totalScore),
      totalQuestions,
      timeTakenSeconds,
    })
    .returning();

  res.status(201).json({
    ...session,
    totalScore: Number(session.totalScore),
  });
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    ...session,
    totalScore: Number(session.totalScore),
  });
});

export default router;
