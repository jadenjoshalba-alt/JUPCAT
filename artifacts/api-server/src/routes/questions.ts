import { Router, type IRouter } from "express";
import { GenerateQuestionsBody } from "@workspace/api-zod";
import { GoogleGenAI } from "@google/genai";
import { sql } from "drizzle-orm";
import { db, questionsTable } from "@workspace/db";

const router: IRouter = Router();

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ── Gemini fallback ──
async function generateWithRetry(
  prompt: string,
  model: string,
  retries = 3
): Promise<string> {
  if (!ai) throw new Error("No AI client configured");
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      });
      const text = response.text ?? "";
      if (text.trim().length > 0) return text;
      throw new Error("Empty response");
    } catch (err: any) {
      const code = err?.status ?? err?.code ?? 0;
      const isRetryable = code === 503 || code === 429 || code === 502 || code === 504;
      if (attempt < retries - 1 && isRetryable) {
        const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("All retries exhausted");
}

function buildPrompt(subject: string, count: number, topics: string[]): string {
  const topicLine =
    topics.length > 0
      ? `Focus ONLY on these specific topics: ${topics.join(", ")}.`
      : "Cover a variety of topics within this subject.";

  const baseInstructions = `You are an expert UPCAT (University of the Philippines College Admission Test) question writer with decades of experience.

STRICT REQUIREMENTS:
- Difficulty: UPCAT level — not too easy, not too hard. Appropriate for high school seniors applying to UP.
- Each question must have exactly 4 choices: A, B, C, D.
- Exactly ONE choice is correct.
- Include a clear, educational explanation for the correct answer (2-4 sentences).
- Questions must be factually accurate, unambiguous, and test real academic competence.
- Add instructions before each question where appropriate.
- ONLY return a valid JSON array — no markdown, no code fences, no extra text.`;

  if (subject === "reading_english" || subject === "reading_filipino") {
    const lang = subject === "reading_english" ? "English" : "Filipino";
    const passageLang = subject === "reading_english" ? "English" : "Filipino (Tagalog/Filipino language)";
    return `${baseInstructions}

Subject: Reading Comprehension in ${lang}

IMPORTANT: Generate reading comprehension passages with accompanying questions.
- Create ${Math.ceil(count / 3)} to ${Math.ceil(count / 2)} distinct passages.
- Each passage: 3-6 sentences. Some passages may include descriptions like "[Image: A diagram showing...]" or "[Comic strip: ...]" for visual-based items.
- Each passage must have 2 to 5 comprehension questions.
- Total questions across all passages must equal exactly ${count}.
- The passage text should appear in the "text" field BEFORE the question, like: "PASSAGE:\n[passage text here]\n\nQUESTION: [question about the passage]"
- All text must be in ${passageLang}.
- Test: main idea, inference, vocabulary in context, tone, author's purpose, detail recall.
${topicLine}

Return exactly this JSON structure (array of ${count} questions total):
[
  {
    "id": "q_unique_id_1",
    "subject": "${subject}",
    "text": "PASSAGE:\nThe Philippine eagle, one of the world's largest and most powerful birds, faces extinction due to habitat loss. Its forest home in Mindanao continues to shrink as logging and farming expand.\n\nINSTRUCTION: Read the passage and answer the question.\n\nQUESTION: What is the main threat to the Philippine eagle according to the passage?",
    "choices": [
      {"id": "A", "text": "Hunting by local farmers"},
      {"id": "B", "text": "Habitat loss due to logging and farming"},
      {"id": "C", "text": "Competition with other eagle species"},
      {"id": "D", "text": "Climate change affecting food supply"}
    ],
    "correctAnswer": "B",
    "explanation": "The passage explicitly states that its forest home continues to shrink 'as logging and farming expand,' making habitat loss the main threat identified in the text."
  }
]`;
  }

  if (subject === "math") {
    return `${baseInstructions}

Subject: Mathematics (UPCAT level)
${topicLine}

IMPORTANT for Math:
- Include word problems (coin problems, age problems, distance-rate-time, investment, mixture, work problems).
- Some questions may reference a graph or figure with a textual description like: "[Graph: A line graph showing...] Based on the graph, what is the slope?"
- Show complete mathematical expressions clearly in the text field.
- Test actual computation skill and conceptual understanding, not just recall.
- For word problems, include all necessary information in the question.

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "math",
    "text": "INSTRUCTION: Solve the following problem.\n\nAna is 5 years older than Ben. In 3 years, the sum of their ages will be 37. How old is Ana now?",
    "choices": [
      {"id": "A", "text": "14"},
      {"id": "B", "text": "16"},
      {"id": "C", "text": "17"},
      {"id": "D", "text": "19"}
    ],
    "correctAnswer": "C",
    "explanation": "Let Ben's current age = x, Ana's = x+5. In 3 years: (x+3) + (x+5+3) = 37 → 2x+11 = 37 → x = 13. Ana is 13+5 = 18... (adjust your computation to match your chosen answer)."
  }
]`;
  }

  if (subject === "science") {
    const physicsTopics = ["subdivision of physics", "measurement", "scalar and vectors", "newton's laws of motion", "momentum", "work", "energy", "newton laws of motion"];
    const isPhysics = topics.some(t => physicsTopics.some(p => t.toLowerCase().includes(p.toLowerCase())));
    const physicsExtra = isPhysics
      ? `- Include some word problems requiring computation (e.g., force = mass × acceleration, kinetic energy = ½mv²).
- Some questions may describe a graph or diagram.
- Show formulas and units clearly.`
      : "";

    return `${baseInstructions}

Subject: Science (UPCAT level)
${topicLine}

IMPORTANT for Science:
${physicsExtra}
- Questions should require genuine understanding, not just memorization of terms.
- Use SI units where applicable.
- Include scenario-based questions.

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "science",
    "text": "INSTRUCTION: Choose the best answer.\n\nA 5 kg object is pushed with a net force of 20 N. What is its acceleration?",
    "choices": [
      {"id": "A", "text": "4 m/s²"},
      {"id": "B", "text": "100 m/s²"},
      {"id": "C", "text": "0.25 m/s²"},
      {"id": "D", "text": "2.5 m/s²"}
    ],
    "correctAnswer": "A",
    "explanation": "By Newton's Second Law, acceleration = Force / mass = 20 N / 5 kg = 4 m/s²."
  }
]`;
  }

  if (subject === "language_english") {
    return `${baseInstructions}

Subject: English Language Proficiency (UPCAT level)
${topicLine}

IMPORTANT for English Language Proficiency:
- Test vocabulary, grammar, correct usage, analogies, idiomatic expressions, and sentence structure.
- For analogy questions use format: "WORD : WORD :: _____ : _____"
- For error identification, underline or mark the error portion in the text like: "She [don't] know the answer."
- For sentence completion, use blanks like "_____" clearly.
- Questions should test nuanced language skills.

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "language_english",
    "text": "INSTRUCTION: Choose the best answer to complete the sentence.\n\nDespite the heavy rain, the athletes decided to _____ with the outdoor practice.",
    "choices": [
      {"id": "A", "text": "proceed"},
      {"id": "B", "text": "precede"},
      {"id": "C", "text": "recede"},
      {"id": "D", "text": "concede"}
    ],
    "correctAnswer": "A",
    "explanation": "'Proceed' means to continue or move forward with an action, which fits the context of continuing with practice. 'Precede' means to come before, 'recede' means to move back, and 'concede' means to admit or yield."
  }
]`;
  }

  if (subject === "language_filipino") {
    return `${baseInstructions}

Subject: Filipino Language Proficiency (UPCAT level) — Lahat ng tanong at pagpipilian ay sa Filipino.
${topicLine}

MAHALAGA para sa Filipino Language Proficiency:
- Susubukan ang bokabularyo, gramatika, wastong gamit, idyoma, at pagkakasunod-sunod ng pangungusap.
- Para sa paghahalintulad (analogy): "SALITA : SALITA :: _____ : _____"
- Para sa pagkilala ng mali, markahan ang maling bahagi.
- Para sa pagkumpleto ng pangungusap, gamitin ang "_____".

Ibalik ang eksaktong JSON na ito (array ng eksaktong ${count} tanong):
[
  {
    "id": "q_unique_id_1",
    "subject": "language_filipino",
    "text": "PANUTO: Piliin ang salitang pinaka-angkop upang makumpleto ang pangungusap.\n\nKahit malakas ang ulan, nagpatuloy pa rin sila sa _____ ng kanilang pagsasanay.",
    "choices": [
      {"id": "A", "text": "pagpapatuloy"},
      {"id": "B", "text": "pagwawakas"},
      {"id": "C", "text": "pagsisimula"},
      {"id": "D", "text": "pagtatapos"}
    ],
    "correctAnswer": "A",
    "explanation": "Ang 'pagpapatuloy' ay ang tamang sagot dahil ipinahihiwatig ng pangungusap na hindi sila huminto sa kanilang aktibidad."
  }
]`;
  }

  return `${baseInstructions}

Subject: ${subject}
${topicLine}

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "${subject}",
    "text": "INSTRUCTION: Choose the best answer.\n\n[Question text here]",
    "choices": [
      {"id": "A", "text": "Choice A"},
      {"id": "B", "text": "Choice B"},
      {"id": "C", "text": "Choice C"},
      {"id": "D", "text": "Choice D"}
    ],
    "correctAnswer": "A",
    "explanation": "Explanation here."
  }
]`;
}

// ── Main endpoint ──
router.post("/questions/generate", async (req, res): Promise<void> => {
  const bodyParsed = GenerateQuestionsBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { subjects } = bodyParsed.data;
  const allQuestions: unknown[] = [];

  for (const subjectItem of subjects) {
    const { subject, count, topics = [] } = subjectItem;
    const topicList = topics as string[];

    // Try database first: select random questions matching subject and topics
    let dbQuestions: { id: number; subject: string; text: string; choices: unknown; correctAnswer: string; explanation: string }[] = [];
    try {
      if (topicList.length > 0) {
        dbQuestions = await db
          .select()
          .from(questionsTable)
          .where(sql`${questionsTable.subject} = ${subject} AND ${questionsTable.topic} IN (${sql.join(topicList, sql`, `)})`)
          .orderBy(sql`RANDOM()`)
          .limit(count);
      } else {
        dbQuestions = await db
          .select()
          .from(questionsTable)
          .where(sql`${questionsTable.subject} = ${subject}`)
          .orderBy(sql`RANDOM()`)
          .limit(count);
      }
    } catch (err) {
      req.log.error({ err, subject }, "DB query failed");
      // Fall through to AI
    }

    if (dbQuestions.length > 0) {
      // Use database questions (return whatever we have, even if fewer than requested)
      dbQuestions.forEach((q, i) => {
        allQuestions.push({
          id: `db_${subject}_${q.id}_${i}`,
          subject: q.subject,
          text: q.text,
          choices: q.choices,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        });
      });
      // Only continue to AI if we have absolutely zero questions in the DB
      continue;
    }

    // No questions in DB for this subject/topic — try AI as fallback
    if (!ai) {
      res.status(500).json({ error: "No question bank available for this subject and no AI configured." });
      return;
    }
    const prompt = buildPrompt(subject, count, topicList);
    let text = "";
    try {
      text = await generateWithRetry(prompt, "gemini-2.5-flash", 3);
    } catch (err: any) {
      const code = err?.status ?? err?.code ?? 0;
      const msg = err?.message ?? "";
      req.log.error({ err, subject, code }, "Gemini API call failed after retries");
      if (code === 503 || msg.includes("high demand") || msg.includes("UNAVAILABLE")) {
        res.status(503).json({ error: "Gemini is currently at high capacity. Please try again later." });
      } else if (code === 429 || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({ error: "Gemini API quota exceeded. Please try again tomorrow, or use fewer subjects." });
      } else {
        res.status(500).json({ error: `Failed to generate questions for ${subject}. Please try again.` });
      }
      return;
    }

    let questionBatch: unknown[];
    try {
      const raw = text.trim();
      questionBatch = JSON.parse(raw);
      if (!Array.isArray(questionBatch)) throw new Error("Response is not a JSON array");
    } catch (err) {
      req.log.error({ text, subject }, "Failed to parse Gemini JSON response");
      res.status(500).json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    allQuestions.push(...questionBatch);
  }

  res.json(allQuestions);
});

export default router;
