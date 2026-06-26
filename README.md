1. Frontend Prompt Builder (The "Upload Questions" dialog)
File: artifacts/upcat/src/pages/dashboard.tsx

Function: buildPrompt() — starts at line 569

This is the prompt you see when you click "Upload Questions" on the dashboard. It has two main sections:

A. The base/global prompt (lines 576–618)
Every question gets this. Edit these parts.push(...) lines to change things like:

The system persona ("You are an expert UPCAT question writer...")
- The "STRICT REQUIREMENTS" (4 choices, 1 correct, explanation, etc.)
- The "CRITICAL — NO IMAGES ALLOWED" section (ASCII art rules)
- The JSON structure template
- B. Subject-specific calibration blocks (lines 646–749)
- Each if (subject.id === "...") block injects extra instructions when that subject is selected:

Subject	                                Line     Block header
reading_english / reading_filipino	    646	     [UPCAT READING COMPREHENSION CALIBRATION]
math	                                  681	     [UPCAT MATHEMATICS CALIBRATION]
science	                                716	     [UPCAT SCIENCE CALIBRATION]
language_english / language_filipino	  736	     [UPCAT LANGUAGE PROFICIENCY CALIBRATION]

How to edit: Just change the text inside the quotes on any parts.push("...") line. For example:

// Old
parts.push("- Focus on: Number systems, algebraic expressions, functions...");
// New
parts.push("- Focus on: Calculus, differential equations, and linear algebra.");




2. API Server Prompt Builder (The /generate endpoint)
File: artifacts/api-server/src/routes/questions.ts

Function: buildPrompt() — starts at line 72

This is used if the app ever calls the AI directly via the backend API (not the frontend copy-paste flow). It has the same structure but in a different format.

A. Base instructions (lines 78–88)
const baseInstructions = `You are an expert UPCAT...
STRICT REQUIREMENTS:
...
${ASCII_INSTRUCTIONS}`;

B. Subject-specific blocks (lines 90–~270)
Reading Comprehension:     lines 90–140
Math:                      lines 143–~180
Science:                   lines ~183–~220
Language:                  lines ~223–~260
How to edit: These are template literals (backticks) instead of parts.push(). You just edit the text directly inside the backticks.

Quick Cheat Sheet
What you want to change	                                Where to edit
- System persona, base rules, JSON format	              dashboard.tsx line 576–618 + questions.ts line 78–88
- Reading comprehension passage rules	                  dashboard.tsx line 651–677 + questions.ts line 97–121
- Math focus areas / LaTeX / ASCII art	                dashboard.tsx line 683–712 + questions.ts line 149–~180
- Science topics / SI units / diagrams	                dashboard.tsx line 718–732 + questions.ts line ~183–~220
- Language grammar rules / error identification format	dashboard.tsx line 738–747 + questions.ts - line ~223–~260
- ASCII art examples (all subjects)	                    dashboard.tsx line 590–599 + questions.ts line 46–70


After You Edit
1. Save the file
2. Rebuild: pnpm --filter @workspace/upcat run build (frontend) or pnpm --filter @workspace/api-server run build (backend)
3. Restart the workflow in the Replit panel (or I can do it for you)


The next time you open the app, the new prompt text will be generated automatically.
