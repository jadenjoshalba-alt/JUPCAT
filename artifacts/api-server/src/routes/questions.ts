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

const ASCII_INSTRUCTIONS = `
CRITICAL — NO IMAGES ALLOWED:
- Do NOT include "imageUrl" fields. This field is banned.
- Do NOT reference external images, files, or URLs.
- Instead, for any diagram, graph, table, or figure you would normally show as an image, represent it INLINE using ASCII art, box-drawing characters, flowchart notation, or markdown-style tables directly inside the "text" field.
- Use these techniques:
  • Box drawing: ┌─────┐ │ ... │ └─────┘ or simple +---+---+ | A | B | +---+---+
  • Flowcharts: [Start] → (Process) → <Decision?> → Yes → [End]
                                                   ↓ No
                                               [Retry]
  • Coordinate graphs: describe axes with ASCII like:
      y
      |     *
      |   *
      | *
      +---------- x
        0  1  2
  • Number lines: <-----|-----|-----|----> 0     1     2
  • Punnett squares, tables, periodic trend grids: use | and --- alignment
  • Chemistry structural bonds: H-O-H or H₂O, C₆H₁₂O₆, arrows → for reactions
  • Physics diagrams: describe forces with arrows (→ ← ↑ ↓) and labels
  • Venn diagrams: describe overlapping sets in text: (Set A) ∩ (Set B) = {x,y}
  • Data tables: | Col1 | Col2 | Col3 | with |------|------|------| dividers

All visual content MUST be embedded as plain text inside the "text" field. No imageUrl, no external references.`;

function buildPrompt(subject: string, count: number, topics: string[]): string {
  const topicLine =
    topics.length > 0
      ? `Focus ONLY on these specific topics: ${topics.join(", ")}.`
      : "Cover a variety of topics within this subject.";

  const baseInstructions = `You are an expert UPCAT (University of the Philippines College Admission Test) question writer with decades of experience.

STRICT REQUIREMENTS:
- Difficulty: UPCAT level — calibrated for a college entrance exam. Each question should be solvable by a well-prepared high school senior in 1-2 minutes. Avoid extremely complex multi-step problems or obscure trivia. Focus on clear, tested concepts that are standard UPCAT material.
- Do not reuse or rephrase your questions — generate entirely new questions each time.
- Each question must have exactly 4 choices: A, B, C, D.
- Exactly ONE choice is correct.
- Include a clear, educational explanation for the correct answer (2-4 sentences).
- Questions must be factually accurate, unambiguous, and test real academic competence.
- Add instructions before each question where appropriate.
- ONLY return a valid JSON array — no markdown, no code fences, no extra text.
${ASCII_INSTRUCTIONS}`;

  if (subject === "reading_english" || subject === "reading_filipino") {
    const lang = subject === "reading_english" ? "English" : "Filipino";
    const passageLang = subject === "reading_english" ? "English" : "Filipino (Tagalog/Filipino language)";
    return `${baseInstructions}

Subject: Reading Comprehension in ${lang}

IMPORTANT: Generate reading comprehension passages with accompanying questions.
- Create ${Math.ceil(count / 3)} to ${Math.ceil(count / 2)} distinct passages.
- Passage types MUST be varied across the set. Use any of these: research paper excerpt, advertisement, essay, poem, short story excerpt, instruction manual, song lyrics, scientific article, historical document, newspaper editorial, persuasive speech, biography excerpt, interview transcript, or academic journal abstract.
- Each passage must be substantial enough for 2-5 comprehension questions.
  • Poems: 2-4 stanzas with a clear theme.
  • Short stories: 3-6 sentences with a clear narrative arc.
  • Research papers: 1-2 paragraphs with a clear thesis and supporting evidence.
  • Advertisements: standard ad format with a clear call to action and persuasive elements.
  • Essays: 3-5 sentences with a clear argument and conclusion.
  • Song lyrics: 2-3 verses with a clear mood or message.
  • Instructions: a numbered or step-by-step procedural text.
  • Scientific articles: 1-2 paragraphs explaining a concept or phenomenon.
  • Historical documents: a short excerpt with a clear historical context.
  • Newspaper editorials: 2-3 sentences with a clear opinion or argument.
  • Persuasive speeches: 2-3 sentences with a clear call to action.
  • Biography excerpts: 2-3 sentences about a person's life or achievement.
  • Interview transcripts: 3-5 questions and answers with a clear topic.
  • Academic journal abstracts: 1-2 paragraphs with a clear research question and methodology.
- If a passage involves data or a figure, represent it using ASCII art or a table directly in the text — never an image.
- Each passage must have 2 to 5 comprehension questions.
- Total questions across all passages must equal exactly ${count}.
- CRITICAL: Every question for the same passage MUST include a "passageId" field (e.g., "p1", "p2") and the full passage text repeated in the "text" field before the question.
- Format each question's text like: "PASSAGE:\\n[passage text]\\n\\nQUESTION: [question text]"
- All text must be in ${passageLang}.
- Test: main idea, inference, vocabulary in context, tone, author's purpose, detail recall, implied meaning, structural analysis, and rhetorical purpose.
${topicLine}

Return exactly this JSON structure (array of ${count} questions total):
[
  {
    "id": "q_unique_id_1",
    "passageId": "p1",
    "subject": "${subject}",
    "text": "PASSAGE:\\nThe Philippine eagle, one of the world's largest and most powerful birds, faces extinction due to habitat loss. Its forest home in Mindanao continues to shrink as logging and farming expand.\\n\\nQUESTION: What is the main threat to the Philippine eagle according to the passage?",
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
- For questions involving geometry figures (triangles, polygons, circles, right triangles), represent them in ASCII art inline in the "text" field.
  Example — triangle with angles:
    In a triangle with angles labeled:
      68°
      / \\
    x/_____\\
      47°
  Example — right triangle with labeled sides:
      |
    a |  \
      |    \ˆ c
    __|______
        b
- For questions involving a graph, plot, or number line, represent them in ASCII art inline in the "text" field. Example:
    y-axis
    |        • (3,4)
    |    • (1,2)
    |
    +-----------> x-axis
- For coordinate geometry: show axes with points marked as * or o.
- For number lines: <--|-----|-----|----> 0    1    2
- For tables and data: use markdown-style | Col1 | Col2 | with dividers.
- Show complete mathematical expressions clearly in the text field using unicode symbols (², ³, √, π, ≥, ≤, ±).
- Test actual computation skill and conceptual understanding, not just recall.
- For word problems, include all necessary information in the question.

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "math",
    "text": "INSTRUCTION: Solve the following problem.\\n\\nAna is 5 years older than Ben. In 3 years, the sum of their ages will be 37. How old is Ana now?",
    "choices": [
      {"id": "A", "text": "14"},
      {"id": "B", "text": "16"},
      {"id": "C", "text": "18"},
      {"id": "D", "text": "19"}
    ],
    "correctAnswer": "C",
    "explanation": "Let Ben's current age = x, Ana's = x+5. In 3 years: (x+3) + (x+8) = 37 → 2x+11 = 37 → x = 13. Ana is 13+5 = 18."
  }
]`;
  }

  if (subject === "science") {
    const physicsTopics = ["subdivision of physics", "measurement", "scalar and vectors", "newton's laws of motion", "momentum", "work", "energy", "newton laws of motion"];
    const isPhysics = topics.some(t => physicsTopics.some(p => t.toLowerCase().includes(p.toLowerCase())));
    const physicsExtra = isPhysics
      ? `- Include word problems requiring computation (e.g., F = ma, KE = ½mv², W = Fd).
- For force diagrams, use ASCII arrows:
    ↑ Normal Force (N)
    |
  [Box] ——→ Applied Force (F)
    |
    ↓ Weight (mg)
- Show formulas and SI units clearly.`
      : "";

    return `${baseInstructions}

Subject: Science (UPCAT level)
${topicLine}

IMPORTANT for Science:
${physicsExtra}
- Questions should require genuine understanding, not just memorization of terms.
- Use SI units where applicable.
- Include scenario-based questions.
- For any diagram (cell diagram, atom model, food web, etc.), represent it using ASCII art or a structured text description.
  Example atom model:
        e⁻
       /
  (nucleus)
       \\
        e⁻
- For tables (periodic trends, data comparisons), use ASCII table format:
  | Element | Atomic No. | Electronegativity |
  |---------|------------|-------------------|
  | Li      |     3      |       0.98        |

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "science",
    "text": "INSTRUCTION: Choose the best answer.\\n\\nA 5 kg object is pushed with a net force of 20 N. What is its acceleration?",
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
- For error identification, mark the error portion with **bold** text like: "She **don't** know the answer." Do NOT use underlines or brackets. Make the error word clearly stand out.
- For error correction questions, the choices should be ONLY the single word to replace the error (e.g., choices: "doesn't", "didn't", "don't", "done"). The choices should NOT be full phrases or rewritten sentences.
- For sentence completion, use blanks like "_____" clearly.
- Questions should test nuanced language skills.

Return exactly this JSON structure (array of exactly ${count} questions):
[
  {
    "id": "q_unique_id_1",
    "subject": "language_english",
    "text": "INSTRUCTION: Choose the best answer to complete the sentence.\\n\\nDespite the heavy rain, the athletes decided to _____ with the outdoor practice.",
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
- Para sa pagkilala ng mali, markahan ang maling bahagi ng **bold** (e.g., "Siya **ay** pumunta sa eskwelahan."). Huwag gumamit ng underline o bracket.
- Para sa pagwawasto ng mali, ang mga pagpipilian ay ISANG salita lamang (halimbawa: "ay", "nag", "um", "na"). Hindi buong pangungusap.
- Para sa pagkumpleto ng pangungusap, gamitin ang "_____".

Ibalik ang eksaktong JSON na ito (array ng eksaktong ${count} tanong):
[
  {
    "id": "q_unique_id_1",
    "subject": "language_filipino",
    "text": "PANUTO: Piliin ang salitang pinaka-angkop upang makumpleto ang pangungusap.\\n\\nKahit malakas ang ulan, nagpatuloy pa rin sila sa _____ ng kanilang pagsasanay.",
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
    "text": "INSTRUCTION: Choose the best answer.\\n\\n[Question text here]",
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

    // Try database first
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
    }

    if (dbQuestions.length > 0) {
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
      continue;
    }

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
      // Strip any imageUrl fields AI may have accidentally included
      questionBatch = (questionBatch as any[]).map((q: any) => {
        const { imageUrl, ...rest } = q;
        return rest;
      });
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
