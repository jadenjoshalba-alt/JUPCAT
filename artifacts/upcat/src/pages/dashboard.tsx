import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { listSessions } from "@/lib/firestoreSessions";
import { syncBankWithFirestore, uploadBankToFirestore } from "@/lib/firestoreBank";
import { Session } from "@/types/session";
import { useTest } from "@/context/TestContext";
import { SUBJECT_LABELS, formatTime, calcTotalSeconds, SECONDS_PER_ITEM } from "@/lib/format";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight, History, PlayCircle, BookOpen, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, RotateCcw, Upload, Trash2, RefreshCw,
  AlertTriangle, Copy, FileText, Sparkles, Wand2, Calculator, Cloud, CloudOff,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBankStats, getBankQuestions, addBankQuestions, clearBank,
  resetUsedIds, pickQuestions, BankQuestion
} from "@/lib/questionBank";
import { useUpcatCountdown } from "@/hooks/useCountdown";

// ─── UPCAT Countdown ──────────────────────────────────────────────────────────

function UpcatCountdown() {
  const daysLeft = useUpcatCountdown();

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 text-primary">
        <Clock className="h-5 w-5" />
        <span className="text-2xl font-bold tabular-nums">{daysLeft}</span>
      </div>
      <div className="text-sm">
        <span className="font-medium text-foreground">days remaining</span>
        <span className="text-muted-foreground"> until UPCAT 2026</span>
      </div>
    </div>
  );
}

// ─── UPG Calculator ───────────────────────────────────────────────────────────

function UpgCalculator() {
  const [lang, setLang] = useState(0);
  const [math, setMath] = useState(0);
  const [science, setScience] = useState(0);
  const [reading, setReading] = useState(0);
  const [hswa, setHswa] = useState(90);
  const [palugit, setPalugit] = useState(0);
  const [pabigat, setPabigat] = useState(0);
  const [showFormula, setShowFormula] = useState(false);

  const upcatAvg = useMemo(() => {
    if (lang + math + science + reading === 0) return 0;
    return (lang + math + science + reading) / 4;
  }, [lang, math, science, reading]);

  const estimatedUPG = useMemo(() => {
    // UPCAT component: 60% weight, normalized to 1.0-5.0 scale
    // A raw score of 0 = UPG 5.0, raw score of 100 = UPG 1.0
    const upcatScore = upcatAvg;
    const upcatComponent = 5.0 - (upcatScore / 100) * 4.0;

    // HSWA component: 40% weight, normalized to 1.0-5.0 scale
    // HSWA of 60 = UPG 5.0, HSWA of 100 = UPG 1.0
    const hswaComponent = 5.0 - ((hswa - 60) / 40) * 4.0;

    const rawUPG = (upcatComponent * 0.60) + (hswaComponent * 0.40);

    // Apply modifiers
    const adjusted = rawUPG - palugit + pabigat;

    return Math.max(1.0, Math.min(5.0, adjusted));
  }, [upcatAvg, hswa, palugit, pabigat]);

  const getUPGCategory = (upg: number) => {
    if (upg <= 1.5) return "Excellent";
    if (upg <= 2.0) return "Very Good";
    if (upg <= 2.5) return "Good";
    if (upg <= 3.0) return "Fair";
    return "Needs Improvement";
  };

  const getCategoryColor = (upg: number) => {
    if (upg <= 1.5) return "text-emerald-600";
    if (upg <= 2.0) return "text-blue-600";
    if (upg <= 2.5) return "text-yellow-600";
    if (upg <= 3.0) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">UPG Calculator</CardTitle>
        </div>
        <CardDescription>
          Estimate your University Predicted Grade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* UPCAT Subtest Scores */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            UPCAT Subtest Scores (0-100)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Language Proficiency</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={lang || ""}
                onChange={(e) => setLang(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mathematics</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={math || ""}
                onChange={(e) => setMath(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Science</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={science || ""}
                onChange={(e) => setScience(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reading Comprehension</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={reading || ""}
                onChange={(e) => setReading(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
                placeholder="0"
              />
            </div>
          </div>
          {upcatAvg > 0 && (
            <div className="text-xs text-muted-foreground">
              Average: {upcatAvg.toFixed(1)} / 100
            </div>
          )}
        </div>

        <Separator />

        {/* High School Grades */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            High School Weighted Average
          </div>
          <div className="space-y-1">
            <Label className="text-xs">HSWA (Grades 9-11)</Label>
            <Input
              type="number"
              min={60}
              max={100}
              step={0.1}
              value={hswa}
              onChange={(e) => setHswa(Math.min(100, Math.max(60, Number(e.target.value) || 90)))}
              className="h-9"
            />
          </div>
        </div>

        <Separator />

        {/* Modifiers */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            Adjustments (optional)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Palugit (bonus)</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={palugit}
                onChange={(e) => setPalugit(Math.min(2, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
              />
              <span className="text-[10px] text-muted-foreground">
                e.g. +0.5 for public school
              </span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pabigat (penalty)</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={pabigat}
                onChange={(e) => setPabigat(Math.min(2, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9"
              />
              <span className="text-[10px] text-muted-foreground">
                e.g. -0.05 for out-of-region 2nd choice
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Result */}
        <div className="text-center space-y-2 py-2">
          <div className="text-sm text-muted-foreground">Estimated UPG</div>
          <div className="text-5xl font-bold tabular-nums text-foreground">
            {estimatedUPG.toFixed(3)}
          </div>
          <div className={`text-sm font-medium ${getCategoryColor(estimatedUPG)}`}>
            {getUPGCategory(estimatedUPG)} — Lower is better
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted rounded-md p-3 space-y-1">
          <p>
            <strong>Formula:</strong> UPG = (UPCAT × 0.60) + (HSWA × 0.40)
          </p>
          <p>
            <strong>Basis:</strong> UPCAT = 60%, HSWA = 40%. Lower UPG = better.
          </p>
          <p>
            <strong>Tip:</strong> Skipping questions you don&apos;t know is better than guessing (0.25 penalty per wrong answer).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Topic definitions ────────────────────────────────────────────────────────

const ALL_TOPICS_VALUE = "__all__";

const TOPIC_GROUPS: Record<string, { label: string; options: { value: string; label: string }[] }[]> = {
  language_english: [
    {
      label: "Language Proficiency (English)",
      options: [
        { value: "vocabulary_and_analogy", label: "Vocabulary and Analogy" },
        { value: "sentence_sequencing", label: "Sentence Sequencing and Arrangement" },
        { value: "sentence_completion", label: "Sentence Completion and Improvement" },
        { value: "identifying_error", label: "Identifying Error in the Sentence" },
        { value: "idiomatic_expression", label: "Idiomatic Expression" },
        { value: "related_pair_of_words", label: "Related Pair of Words" },
        { value: "correct_word_usage", label: "Correct Word Usage" },
      ],
    },
  ],
  language_filipino: [
    {
      label: "Language Proficiency (Filipino)",
      options: [
        { value: "bokabularyo_at_paghahalintulad", label: "Bokabularyo at Paghahalintulad" },
        { value: "pagkakasunod_ng_pangungusap", label: "Pagkakasunod-sunod ng Pangungusap" },
        { value: "pagkumpleto_ng_pangungusap", label: "Pagkumpleto at Pagpapabuti ng Pangungusap" },
        { value: "pagkilala_ng_mali", label: "Pagkilala ng Mali sa Pangungusap" },
        { value: "idyomatikong_ekspresyon", label: "Idyomatikong Ekspresyon" },
        { value: "magkaugnay_na_pares", label: "Magkaugnay na Pares ng Salita" },
        { value: "wastong_gamit_ng_salita", label: "Wastong Gamit ng Salita" },
      ],
    },
  ],
  math: [
    {
      label: "Mathematics",
      options: [
        { value: "algebra_numbers_integers", label: "Algebra of Numbers and Integers" },
        { value: "decimals_fractions_percent", label: "Decimals, Fractions and Percent" },
        { value: "scientific_notation", label: "Scientific Notation" },
        { value: "ratio_proportion", label: "Ratio and Proportion" },
        { value: "variations", label: "Variations" },
        { value: "statistics", label: "Statistics" },
        { value: "number_series_progressions", label: "Number Series and Progressions" },
        { value: "algebra_polynomials", label: "Algebra (Polynomials, Rational Expressions)" },
        { value: "plane_geometry", label: "Plane Geometry" },
        { value: "analytic_geometry", label: "Analytic Geometry" },
        { value: "trigonometry", label: "Trigonometry" },
        { value: "word_problems", label: "Word Problems (Coin, Age, Investment, etc.)" },
      ],
    },
  ],
  science: [
    {
      label: "Chemistry",
      options: [
        { value: "chem_matter", label: "Matter" },
        { value: "chem_energy", label: "Energy" },
        { value: "chem_phases_of_matter", label: "Phases of Matter" },
        { value: "chem_atomic_structure", label: "Atomic Structure" },
        { value: "chem_valence_dot_diagrams", label: "Valence and Dot Diagrams" },
        { value: "chem_quantum_numbers", label: "Quantum Numbers" },
        { value: "chem_ions_octet_rules", label: "Ions and Octet Rules" },
        { value: "chem_periodic_table", label: "Periodic Table and Periodic Trends" },
        { value: "chem_bonding", label: "Bonding" },
        { value: "chem_stoichiometry", label: "Stoichiometry" },
      ],
    },
    {
      label: "General Science",
      options: [
        { value: "gen_measurement", label: "Measurement" },
        { value: "gen_force", label: "Force" },
        { value: "gen_friction", label: "Friction" },
        { value: "gen_work", label: "Work" },
        { value: "gen_matter", label: "Matter" },
        { value: "gen_plasma_plastics_metal_alloy", label: "Plasma, Plastics, Metal, Alloy" },
        { value: "gen_biomass_fossil_fuels", label: "Biomass vs Fossil Fuels" },
        { value: "gen_water", label: "Water" },
        { value: "gen_air_pollutant", label: "Air Pollutant" },
        { value: "gen_materials_properties", label: "Materials Properties" },
        { value: "gen_melting_boiling", label: "Melting and Boiling Point" },
        { value: "gen_diffusion_osmosis", label: "Diffusion vs Osmosis" },
        { value: "gen_nuclear_fission", label: "Nuclear and Nuclear Fission" },
        { value: "gen_geothermal_energy", label: "Geothermal Energy" },
        { value: "gen_weather_climate", label: "Weather and Climate" },
        { value: "gen_objects_space", label: "Objects in Space" },
        { value: "gen_layers_atmosphere", label: "Layers of Atmosphere" },
        { value: "gen_position_earth", label: "Position of Earth in the Universe" },
        { value: "gen_motion_earth", label: "Motion of Earth in Space" },
        { value: "gen_layers_earth", label: "Layers of Earth" },
        { value: "gen_rocks_minerals", label: "Rocks and Minerals" },
        { value: "gen_branches_of_science", label: "Branches of Science" },
        { value: "gen_moon", label: "Moon" },
      ],
    },
    {
      label: "Biology",
      options: [
        { value: "bio_living_things", label: "Living Things" },
        { value: "bio_cellular_energetics", label: "Cellular Energetics" },
        { value: "bio_genetics", label: "Genetics" },
        { value: "bio_cell_reproduction", label: "Cell Reproduction" },
        { value: "bio_heredity", label: "Heredity" },
        { value: "bio_diversity_organisms", label: "Diversity of Organisms" },
        { value: "bio_plants", label: "Plants" },
        { value: "bio_animal_structures", label: "Animal Structures and Functions (Body Systems)" },
        { value: "bio_evolution", label: "Evolution" },
        { value: "bio_animal_behavior", label: "Animal Behavior and Energy" },
      ],
    },
    {
      label: "Physics",
      options: [
        { value: "phys_subdivision", label: "Subdivision of Physics" },
        { value: "phys_measurement", label: "Measurement" },
        { value: "phys_scalar_vectors", label: "Scalar and Vectors" },
        { value: "phys_newton_laws", label: "Newton's Laws of Motion" },
        { value: "phys_momentum", label: "Momentum" },
        { value: "phys_work", label: "Work" },
        { value: "phys_energy", label: "Energy" },
      ],
    },
  ],
  reading_english: [],
  reading_filipino: [],
};

type SubjectId = "language_english" | "language_filipino" | "math" | "science" | "reading_english" | "reading_filipino";

const AVAILABLE_SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: "language_english", label: "Language Proficiency (English)" },
  { id: "language_filipino", label: "Language Proficiency (Filipino)" },
  { id: "math", label: "Mathematics" },
  { id: "science", label: "Science" },
  { id: "reading_english", label: "Reading Comprehension (English)" },
  { id: "reading_filipino", label: "Reading Comprehension (Filipino)" },
];

// ─── Sample Gemini Prompt ─────────────────────────────────────────────────────

const SAMPLE_PROMPT = `Generate 20 UPCAT-level Language Proficiency (English) questions. Return ONLY a JSON array — no markdown, no extra text. Each item must follow this exact structure:

[
  {
    "id": "q_unique_id_1",
    "subject": "language_english",
    "topic": "vocabulary_and_analogy",
    "text": "INSTRUCTION: Choose the best answer.\\n\\nEPHEMERAL : LASTING ::",
    "choices": [
      {"id": "A", "text": "Fragile : Strong"},
      {"id": "B", "text": "Transient : Temporary"},
      {"id": "C", "text": "Permanent : Enduring"},
      {"id": "D", "text": "Beautiful : Radiant"}
    ],
    "correctAnswer": "A",
    "explanation": "Ephemeral means short-lived (opposite of lasting), just as fragile means easily broken (opposite of strong).",
    "imageUrl": "images/filename.png"  // optional: for diagrams. Use Image Manager to upload images
  }
]

Subject values: language_english | language_filipino | math | science | reading_english | reading_filipino
Topic values (language_english): vocabulary_and_analogy | sentence_sequencing | sentence_completion | identifying_error | idiomatic_expression | related_pair_of_words | correct_word_usage`;

// ─── Topic Selector ───────────────────────────────────────────────────────────

function TopicSelector({
  subjectId,
  selectedTopics,
  onChange,
  disabled,
}: {
  subjectId: SubjectId;
  selectedTopics: string[];
  onChange: (topics: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = TOPIC_GROUPS[subjectId] ?? [];
  if (groups.length === 0) return null;

  const allOptions = groups.flatMap((g) => g.options);
  const isAllSelected = selectedTopics.length === 0 || selectedTopics.includes(ALL_TOPICS_VALUE);

  const toggleAll = () => onChange([ALL_TOPICS_VALUE]);

  const toggleTopic = (value: string) => {
    if (isAllSelected) {
      onChange([value]);
      return;
    }
    if (selectedTopics.includes(value)) {
      const next = selectedTopics.filter((t) => t !== value);
      onChange(next.length === 0 ? [ALL_TOPICS_VALUE] : next);
    } else {
      const next = [...selectedTopics.filter((t) => t !== ALL_TOPICS_VALUE), value];
      onChange(next.length === allOptions.length ? [ALL_TOPICS_VALUE] : next);
    }
  };

  const displayLabel = isAllSelected
    ? "All Topics"
    : selectedTopics.length === 1
    ? allOptions.find((o) => o.value === selectedTopics[0])?.label ?? "1 topic"
    : `${selectedTopics.length} topics selected`;

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>{displayLabel}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && !disabled && (
        <div className="mt-3 pl-1 space-y-4 border-l-2 border-border ml-1 pl-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${subjectId}-all`}
              checked={isAllSelected}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor={`${subjectId}-all`} className="text-sm font-semibold cursor-pointer">
              Select All Topics
            </Label>
          </div>

          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              {groups.length > 1 && (
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {group.label}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.options.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`${subjectId}-${opt.value}`}
                      checked={!isAllSelected && selectedTopics.includes(opt.value)}
                      onCheckedChange={() => toggleTopic(opt.value)}
                    />
                    <Label
                      htmlFor={`${subjectId}-${opt.value}`}
                      className="text-xs cursor-pointer leading-tight"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prompt Generator Panel ───────────────────────────────────────────────────

function PromptGeneratorPanel({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [genSelectedSubjects, setGenSelectedSubjects] = useState<Record<string, boolean>>(
    AVAILABLE_SUBJECTS.reduce((acc, s) => ({ ...acc, [s.id]: false }), {})
  );
  const [genItemCounts, setGenItemCounts] = useState<Record<string, number>>(
    AVAILABLE_SUBJECTS.reduce((acc, s) => ({ ...acc, [s.id]: 10 }), {})
  );
  const [genSelectedTopics, setGenSelectedTopics] = useState<Record<string, string[]>>(
    AVAILABLE_SUBJECTS.reduce((acc, s) => ({ ...acc, [s.id]: [ALL_TOPICS_VALUE] }), {})
  );
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"generate" | "paste">("generate");

  const reset = () => {
    setPasteText("");
    setError("");
    setResult(null);
    setGeneratedPrompt("");
  };

  const buildPrompt = () => {
    const selected = AVAILABLE_SUBJECTS.filter((s) => genSelectedSubjects[s.id]);
    if (selected.length === 0) {
      setGeneratedPrompt("Select at least one subject above to generate a prompt.");
      return;
    }

    const parts: string[] = [];
    parts.push("You are an expert UPCAT (University of the Philippines College Admission Test) question writer.");
    parts.push("");
    parts.push("STRICT REQUIREMENTS:");
    parts.push("- Each question must have exactly 4 choices: A, B, C, D.");
    parts.push("- Exactly ONE choice is correct.");
    parts.push("- Include a clear, educational explanation for the correct answer (2-4 sentences).");
    parts.push("- Add instructions before each question where appropriate.");
    parts.push("- ONLY return a valid JSON array — no markdown, no code fences, no extra text.");
    parts.push("");
    parts.push("CRITICAL — NO IMAGES ALLOWED:");
    parts.push('- Do NOT include "imageUrl" fields. This field is banned. This app CANNOT render images.');
    parts.push('- Do NOT reference external images, files, or URLs.');
    parts.push("- Instead, for any diagram, graph, table, or figure, represent it INLINE using ASCII art, box-drawing characters, or simple text notation directly inside the \"text\" field.");
    parts.push("- Use these techniques:");
    parts.push("  • Triangles / polygons: draw with slashes and dashes, and label angles with text like \"68°\" or \"x\" near the vertices.");
    parts.push("  • Circles: use ( ) and label center/radius.");
    parts.push("  • Coordinate graphs: y-axis on left, x-axis on bottom with +, and points marked with * or o.");
    parts.push("  • Number lines: <--|-----|-----|----> 0    1    2");
    parts.push("  • Tables: | Col1 | Col2 | Col3 | with |------|------|------| dividers");
    parts.push("  • Right triangles for trig: label sides as opposite, adjacent, hypotenuse with text.");
    parts.push("  • Flowcharts / sequences: [Start] -> (Step 1) -> (Step 2) -> [End]");
    parts.push("  • Venn diagrams: describe in text (Set A) n (Set B) = {x, y}");
    parts.push("  • Data tables: markdown-style with | and ---");
    parts.push("");
    parts.push("For each question, use this exact structure:");
    parts.push(`{`);
    parts.push(`  "id": "q_unique_id_here",`);
    parts.push(`  "subject": "subject_value",`);
    parts.push(`  "topic": "topic_value",`);
    parts.push(`  "text": "INSTRUCTION: ...\\n\\nQuestion text here",`);
    parts.push(`  "choices": [`);
    parts.push(`    {"id": "A", "text": "..."},`);
    parts.push(`    {"id": "B", "text": "..."},`);
    parts.push(`    {"id": "C", "text": "..."},`);
    parts.push(`    {"id": "D", "text": "..."}`);
    parts.push(`  ],`);
    parts.push(`  "correctAnswer": "A",`);
    parts.push(`  "explanation": "Explanation here."`);
    parts.push(`}`);
    parts.push("");
    parts.push("Subject values: language_english | language_filipino | math | science | reading_english | reading_filipino");
    parts.push("");

    for (const subject of selected) {
      const count = genItemCounts[subject.id] || 10;
      const topics = genSelectedTopics[subject.id] ?? [ALL_TOPICS_VALUE];
      const isAll = topics.length === 0 || topics.includes(ALL_TOPICS_VALUE);
      const allTopicOptions = (TOPIC_GROUPS[subject.id] ?? []).flatMap((g) => g.options);
      const specificTopics = isAll ? allTopicOptions.map((t) => t.value) : topics;
      const topicLabels = specificTopics.map((t) => allTopicOptions.find((o) => o.value === t)?.label || t);

      parts.push(`--- ${subject.label} ---`);
      parts.push(`Generate exactly ${count} questions for ${subject.label}.`);

      if (isAll && topicLabels.length > 0) {
        const perTopic = Math.floor(count / topicLabels.length);
        const remainder = count % topicLabels.length;
        parts.push("");
        parts.push("DISTRIBUTE questions evenly across these topics:");
        topicLabels.forEach((label, i) => {
          const topicCount = i < remainder ? perTopic + 1 : perTopic;
          parts.push(`  - ${label}: ${topicCount} questions`);
        });
        parts.push("");
        parts.push("When 'All Topics' is selected, spread questions equally across the available topics so each topic gets fair representation.");
      } else if (!isAll && topicLabels.length > 0) {
        parts.push(`Focus ONLY on these topics: ${topicLabels.join(", ")}.`);
      }

      if (subject.id === "reading_english" || subject.id === "reading_filipino") {
        const lang = subject.id === "reading_english" ? "English" : "Filipino (Tagalog/Filipino language)";
        const passageCountMin = Math.ceil(count / 5);
        const passageCountMax = Math.ceil(count / 2);
        parts.push("");
        parts.push("[UPCAT READING COMPREHENSION CALIBRATION]");
        parts.push(`- Language: ${lang}.`);
        parts.push(`- Create ${passageCountMin} to ${passageCountMax} distinct passages.`);
        parts.push("- Passage types MUST be varied across the set. Use any of these: research paper excerpt, advertisement, essay, poem, short story excerpt, instruction manual, song lyrics, scientific article, historical document, newspaper editorial, persuasive speech, biography excerpt, interview transcript, or academic journal abstract.");
        parts.push("- Each passage must be substantial enough for 2-5 comprehension questions.");
        parts.push("  • Poems: 2-4 stanzas with a clear theme.");
        parts.push("  • Short stories: 3-6 sentences with a clear narrative arc.");
        parts.push("  • Research papers: 1-2 paragraphs with a clear thesis and supporting evidence.");
        parts.push("  • Advertisements: standard ad format with a clear call to action and persuasive elements.");
        parts.push("  • Essays: 3-5 sentences with a clear argument and conclusion.");
        parts.push("  • Song lyrics: 2-3 verses with a clear mood or message.");
        parts.push("  • Instructions: a numbered or step-by-step procedural text.");
        parts.push("  • Scientific articles: 1-2 paragraphs explaining a concept or phenomenon.");
        parts.push("  • Historical documents: a short excerpt with a clear historical context.");
        parts.push("  • Newspaper editorials: 2-3 sentences with a clear opinion or argument.");
        parts.push("  • Persuasive speeches: 2-3 sentences with a clear call to action.");
        parts.push("  • Biography excerpts: 2-3 sentences about a person's life or achievement.");
        parts.push("  • Interview transcripts: 3-5 questions and answers with a clear topic.");
        parts.push("  • Academic journal abstracts: 1-2 paragraphs with a clear research question and methodology.");
        parts.push("- If a passage involves data or a figure, represent it using ASCII art or a table directly in the text — never an image.");
        parts.push("- Each passage must have 2 to 5 comprehension questions.");
        parts.push("- Total questions across all passages must equal exactly " + count + ".");
        parts.push('- CRITICAL: Every question for the same passage MUST include a "passageId" field (e.g., "p1", "p2") and the full passage text repeated in the "text" field before the question.');
        parts.push('- Format each question\'s text like: "PASSAGE:\\n[passage text]\\n\\nQUESTION: [question text]"');
        parts.push("- All passage and question text must be in " + lang + ".");
        parts.push("- Test: main idea, inference, vocabulary in context, tone, author's purpose, detail recall, implied meaning, structural analysis, and rhetorical purpose.");
        parts.push("- Do NOT randomize the order of questions within a passage. Keep all questions for passage 1 together, then all questions for passage 2, etc.");
        parts.push("");
      }

      if (subject.id === "math") {
        parts.push("");
        parts.push("[UPCAT MATHEMATICS CALIBRATION]");
        parts.push("- Focus on: Number systems, algebraic expressions, functions, linear/quadratic equations, geometry, trigonometry, and word problems (variations, mixture, motion, investment).");
        parts.push("- Keep calculations realistic, clean, and quickly solvable on scratch paper without messy long-form arithmetic.");
        parts.push("- All equations, fractions, and expressions must be cleanly typeset using vertical formatting (e.g., standard LaTeX for fractions $\\frac{a}{b}$ or exponents) so they match the appearance of a physical exam paper.");
        parts.push("- Question stems must be short, punchy, direct, and get straight to the point without dense blocks of unnecessary text.");
        parts.push("- IMPORTANT for Mathematics:");
        parts.push("- For questions involving geometry figures (triangles, polygons, circles, right triangles), represent them in ASCII art inline in the \"text\" field.");
        parts.push("  Example — triangle with angles:");
        parts.push("    In a triangle with angles labeled:");
        parts.push("      68°");
        parts.push("      / \\");
        parts.push("    x/_____\\");
        parts.push("      47°");
        parts.push("  Example — right triangle with labeled sides:");
        parts.push("      |");
        parts.push("    a |  \\");
        parts.push("      |    \\ c");
        parts.push("    __|______");
        parts.push("        b");
        parts.push("- For questions involving a graph, plot, or number line, represent them in ASCII art inline in the \"text\" field.");
        parts.push("  Example — coordinate graph:");
        parts.push("    y-axis");
        parts.push("    |        • (3,4)");
        parts.push("    |    • (1,2)");
        parts.push("    |");
        parts.push("    +-----------> x-axis");
        parts.push("  Example — number line:");
        parts.push("    <--|-----|-----|----> 0    1    2");
        parts.push("- For tables and data: use markdown-style | Col1 | Col2 | with dividers.");
        parts.push("- For flowcharts / sequences: [Start] -> (Step 1) -> (Step 2) -> [End]");
        parts.push("");
      }

      if (subject.id === "science") {
        parts.push("");
        parts.push("[UPCAT SCIENCE CALIBRATION]");
        parts.push("- Focus strictly on foundational computational physics (basic forces, kinematics, motion) and core chemistry concepts (mass conservation, solutions) modeled directly after official test parameters.");
        parts.push("- Questions should require genuine understanding, not just memorization of terms.");
        parts.push("- Use SI units where applicable.");
        parts.push("- Include scenario-based questions.");
        parts.push("- For any diagram (cell diagram, atom model, food web, etc.), represent it using ASCII art or a structured text description.");
        parts.push("  Example atom model:");
        parts.push("        e\u207b");
        parts.push("       /");
        parts.push("  (nucleus)");
        parts.push("       \\");
        parts.push("        e\u207b");
        parts.push("- For tables (periodic trends, data comparisons), use ASCII table format:");
        parts.push("  | Element | Atomic No. | Electronegativity |");
        parts.push("  |---------|------------|-------------------|");
        parts.push("");
      }

      if (subject.id === "language_english" || subject.id === "language_filipino") {
        parts.push("");
        parts.push("[UPCAT LANGUAGE PROFICIENCY CALIBRATION]");
        parts.push("- Emphasize subject-verb agreement, pronouns, parallelism, modifiers, and word choice (e.g., affect vs. effect).");
        parts.push("- Sentences must be short, punchy, single- or dual-clause structures. Do not make them overly long or verbose.");
        parts.push("- Traps must be high-yield and realistic (e.g., aspectual/tense parallelism, proximity/collective agreement rules, pronoun consistency, ng/nang distinctions, or context vocabulary).");
        parts.push("- For Error Identification questions, the specific parts of the sentence being tested must be fully capitalized and bolded with bracketed letters right next to them inside the text exactly like this: **WORD [A]**. The 'No error' choice must also look like this: **NO ERROR [D]**.");
        parts.push("- Do NOT include a separate 'NO ERROR' or 'D. NO ERROR' choice in the choices list; the selections are fully integrated directly inside the sentence text.");
        parts.push("- For Sequencing questions: Use short phrases or narrative elements labeled (1) to (4). Below the text, provide four options lettered A., B., C., D. using clean, hyphenated sorting strings (e.g., A. 2-3-4-1).");
        parts.push("- For Vocabulary & Idioms: Feature a targeted word in full UPPERCASE in a short sentence. Options A., B., C., D. underneath must be completely lowercase unless proper nouns.");
        parts.push("- For Spelling: Present four lowercase options testing standard high-frequency trap configurations.");
        parts.push("- For Sentence Completion: Use a clean, blank line (_______) inside a concise sentence. Options A., B., C., D. underneath must be lowercase and focus on strict morphological or particle usage.");
        parts.push("");
      }

      parts.push("");
    }

    parts.push("Return the complete JSON array with ALL questions.");
    parts.push("Make sure every question has a unique 'id' across the entire array.");

    const prompt = parts.join("\n");
    setGeneratedPrompt(prompt);
    setCustomPrompt(prompt);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(customPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseAndSave = (jsonText: string) => {
    setError("");
    setResult(null);
    try {
      const parsed = JSON.parse(jsonText.trim());
      if (!Array.isArray(parsed)) {
        setError("Expected a JSON array of questions.");
        return;
      }
      const valid: BankQuestion[] = [];
      for (const item of parsed) {
        if (
          typeof item.id === "string" &&
          typeof item.subject === "string" &&
          typeof item.text === "string" &&
          Array.isArray(item.choices) &&
          typeof item.correctAnswer === "string"
        ) {
          valid.push({
            id: item.id,
            subject: item.subject,
            topic: item.topic,
            text: item.text,
            imageUrl: item.imageUrl,
            passageId: item.passageId,
            choices: item.choices,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation ?? "",
          });
        }
      }
      if (valid.length === 0) {
        setError("No valid questions found. Make sure each item has id, subject, text, choices, and correctAnswer.");
        return;
      }
      const res = addBankQuestions(valid);
      setResult(res);
      onUploaded();
    } catch {
      setError("Invalid JSON. Please paste a valid JSON array.");
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseAndSave(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); } }}>
      <div className="bg-background border-2 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Upload Questions to Bank
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your test, generate a prompt for Gemini, then paste the JSON back.
              </p>
            </div>
            <button
              onClick={() => { reset(); onClose(); }}
              className="text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none ml-4"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "generate"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("generate")}
            >
              <Sparkles className="h-4 w-4 inline mr-1.5" />
              1. Generate Prompt
            </button>
            <button
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "paste"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("paste")}
            >
              <Upload className="h-4 w-4 inline mr-1.5" />
              2. Paste JSON
            </button>
          </div>

          {activeTab === "generate" && (
            <div className="space-y-4">
              {/* Subject selectors */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Select subjects and topics:</p>
                {AVAILABLE_SUBJECTS.map((subject) => {
                  const isSelected = genSelectedSubjects[subject.id];
                  const hasTopics = (TOPIC_GROUPS[subject.id] ?? []).length > 0;
                  return (
                    <div key={subject.id} className={cn("rounded-lg border p-3", isSelected ? "bg-card" : "bg-muted/30 opacity-60")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) =>
                              setGenSelectedSubjects((prev) => ({ ...prev, [subject.id]: v as boolean }))
                            }
                          />
                          <span className="text-sm font-semibold">{subject.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            className="w-16 text-center"
                            disabled={!isSelected}
                            value={genItemCounts[subject.id]}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setGenItemCounts((prev) => ({
                                ...prev,
                                [subject.id]: isNaN(val) ? 0 : Math.max(1, Math.min(100, val)),
                              }));
                            }}
                          />
                          <span className="text-sm text-muted-foreground">items</span>
                        </div>
                      </div>
                      {hasTopics && isSelected && (
                        <TopicSelector
                          subjectId={subject.id}
                          selectedTopics={genSelectedTopics[subject.id] ?? [ALL_TOPICS_VALUE]}
                          onChange={(topics) =>
                            setGenSelectedTopics((prev) => ({ ...prev, [subject.id]: topics }))
                          }
                          disabled={false}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <Button onClick={buildPrompt} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Prompt
              </Button>

              {generatedPrompt && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Prompt for Gemini</span>
                    <Button size="sm" variant="outline" onClick={copyPrompt} className="gap-1 h-7 text-xs">
                      <Copy className="h-3 w-3" />
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <textarea
                    className="w-full text-xs bg-muted border rounded p-3 font-mono min-h-[160px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    1. Edit the prompt above if needed → 2. Click Copy → 3. Go to <strong>gemini.google.com</strong> → 4. Paste it → 5. Copy the JSON it returns → 6. Switch to "Paste JSON" tab
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "paste" && (
            <div className="space-y-4">
              {/* File upload */}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload .json file
                </Button>
                <span className="text-sm text-muted-foreground">or paste JSON below</span>
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="paste-json" className="text-sm font-medium">Paste JSON array from Gemini</Label>
                <textarea
                  id="paste-json"
                  className="w-full min-h-[140px] rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={'[\n  {\n    "id": "q1",\n    "subject": "language_english",\n    "text": "...",\n    ...\n  }\n]'}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {result && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950/30 rounded p-3">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{result.added}</strong> questions added to bank.
                    {result.skipped > 0 && <span className="text-muted-foreground"> ({result.skipped} duplicates skipped)</span>}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button onClick={() => parseAndSave(pasteText)} disabled={!pasteText.trim()}>
                  Save to Bank
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Paginated Sessions Component ─────────────────────────────────────────────

const SESSIONS_PER_PAGE = 5;

function PaginatedSessions({
  sessions,
  onReview,
}: {
  sessions: Session[];
  onReview: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sessions.length / SESSIONS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) setPage(safePage);

  const start = (safePage - 1) * SESSIONS_PER_PAGE;
  const pageSessions = sessions.slice(start, start + SESSIONS_PER_PAGE);

  return (
    <div>
      <div className="divide-y">
        {pageSessions.map((session, idx) => {
          const correct = session.correctCount ?? (session.answers as any[]).filter((a: any) => a.isCorrect).length;
          const wrong = session.wrongCount ?? (session.answers as any[]).filter((a: any) => !a.isCorrect && !a.isBlank).length;
          const pct = Math.round((correct / session.totalQuestions) * 100);
          const upcatScore = Math.max(0, correct - 0.25 * wrong);
          const sessionNum = sessions.length - start - idx; // newest = highest number, oldest = #1
          return (
            <div
              key={session.id}
              className="flex flex-col gap-2 p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground font-normal">#{sessionNum}</span>
                    <span className="text-primary">{upcatScore.toFixed(2)}</span>
                    <span className="text-muted-foreground font-normal text-xs">/ {session.totalQuestions}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-green-600">✓{correct}</span>
                    <span className="text-red-500">✗{wrong}</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(session.timeTakenSeconds ?? 0)}</span>
                  </div>
                </div>
                <Badge
                  variant={pct >= 75 ? "default" : pct >= 50 ? "secondary" : "destructive"}
                  className="text-xs shrink-0 ml-2"
                >
                  {pct}%
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => onReview(session.id)}
              >
                Review & Explanations
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { setQuestions, setTimeRemaining, setStatus, resetTest, questions, status } = useTest();

  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, boolean>>(
    AVAILABLE_SUBJECTS.reduce((acc, s) => ({ ...acc, [s.id]: false }), {})
  );
  const [itemCounts, setItemCounts] = useState<Record<string, number>>(
    AVAILABLE_SUBJECTS.reduce((acc, s) => ({ ...acc, [s.id]: 10 }), {})
  );
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string[]>>(
    AVAILABLE_SUBJECTS.reduce((acc, s) => ({ ...acc, [s.id]: [ALL_TOPICS_VALUE] }), {})
  );

  const [showUpload, setShowUpload] = useState(false);
  const [bankStats, setBankStats] = useState<{ total: number; unused: number }>({ total: 0, unused: 0 });
  const [startError, setStartError] = useState("");

  const { user } = useAuth();
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [bankSyncing, setBankSyncing] = useState(false);
  const [bankSyncMsg, setBankSyncMsg] = useState("");

  useEffect(() => {
    if (!user) {
      setPastSessions([]);
      return;
    }
    setIsLoadingSessions(true);
    listSessions(user.uid)
      .then(setPastSessions)
      .catch((err) => {
        console.error("[Dashboard] Failed to load past sessions:", err);
        setPastSessions([]);
      })
      .finally(() => setIsLoadingSessions(false));

    // Auto-sync question bank with Firestore on login
    syncBankWithFirestore(user.uid)
      .then(({ merged }) => {
        if (merged > 0) {
          refreshBankStats();
          setBankSyncMsg(`Synced ${merged} question(s) from your account.`);
          setTimeout(() => setBankSyncMsg(""), 4000);
        }
      })
      .catch((err) => {
        console.error("[Dashboard] Bank sync failed:", err);
      });
  }, [user]);

  const refreshBankStats = useCallback(() => {
    setBankStats(getBankStats());
  }, []);

  const handleSyncBank = async () => {
    if (!user) return;
    setBankSyncing(true);
    try {
      await uploadBankToFirestore(user.uid);
      setBankSyncMsg("Question bank saved to your account.");
    } catch {
      setBankSyncMsg("Sync failed. Check your connection.");
    } finally {
      setBankSyncing(false);
      setTimeout(() => setBankSyncMsg(""), 4000);
    }
  };

  useEffect(() => {
    refreshBankStats();
  }, []);

  const totalSeconds = useMemo(
    () => calcTotalSeconds(selectedSubjects, itemCounts),
    [selectedSubjects, itemCounts]
  );

  const totalQuestions = useMemo(() => {
    return Object.entries(selectedSubjects)
      .filter(([, v]) => v)
      .reduce((t, [s]) => t + (itemCounts[s] || 0), 0);
  }, [selectedSubjects, itemCounts]);

  const handleStartTest = () => {
    setStartError("");
    const subjectsToUse = Object.entries(selectedSubjects)
      .filter(([, v]) => v)
      .map(([subject]) => ({
        subject: subject as SubjectId,
        count: itemCounts[subject] || 10,
        topics: (selectedTopics[subject] ?? [ALL_TOPICS_VALUE]).includes(ALL_TOPICS_VALUE)
          ? []
          : selectedTopics[subject],
      }));

    if (subjectsToUse.length === 0) return;

    const picked: BankQuestion[] = [];
    const warnings: string[] = [];

    for (const { subject, count, topics } of subjectsToUse) {
      const qs = pickQuestions(subject, count, topics);
      if (qs.length === 0) {
        warnings.push(`No questions available for ${SUBJECT_LABELS[subject] || subject}.`);
        continue;
      }
      if (qs.length < count) {
        warnings.push(`Only ${qs.length} of ${count} questions available for ${SUBJECT_LABELS[subject] || subject}.`);
      }
      picked.push(...qs);
    }

    if (picked.length === 0) {
      setStartError("No questions available. Please upload questions first.");
      return;
    }

    if (warnings.length > 0) {
      setStartError(warnings.join(" "));
    }

    resetTest();
    setQuestions(picked as any);
    setTimeRemaining(totalSeconds);
    setStatus("running");
    setLocation("/test");
  };

  const handleClearBank = () => {
    clearBank();
    refreshBankStats();
  };

  const handleResetUsed = () => {
    resetUsedIds();
    refreshBankStats();
  };

  const isReady = status === "ready" && questions.length > 0;

  return (
    <Layout>
      <PromptGeneratorPanel
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={refreshBankStats}
      />

      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome to IskolarTrack</h1>
          <p className="text-muted-foreground">
            Prepare for the UPCAT with our high-fidelity mock test environment.
          </p>
          <UpcatCountdown />
        </div>

        {/* Question Bank Status */}
        <Card className="border-2 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Question Bank
                </CardTitle>
                <CardDescription className="mt-1">
                  {bankStats.total === 0
                    ? "No questions uploaded yet. Upload questions from Gemini to get started."
                    : `${bankStats.total} questions total · ${bankStats.unused} unused`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" onClick={() => setShowUpload(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Questions
                </Button>
                {user && bankStats.total > 0 && (
                  <Button size="sm" variant="outline" onClick={handleSyncBank} disabled={bankSyncing} className="gap-2">
                    <Cloud className="h-4 w-4" />
                    {bankSyncing ? "Saving…" : "Sync to Account"}
                  </Button>
                )}
                {bankStats.unused < bankStats.total && bankStats.total > 0 && (
                  <Button size="sm" variant="outline" onClick={handleResetUsed} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Reset Used
                  </Button>
                )}
                {bankStats.total > 0 && (
                  <Button size="sm" variant="outline" onClick={handleClearBank} className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Clear Bank
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {bankStats.total > 0 && (
            <CardContent className="pt-0 pb-3">
              <div className="flex items-center gap-3 text-sm">
                <Progress value={(bankStats.unused / bankStats.total) * 100} className="flex-1 h-2" />
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {bankStats.unused} / {bankStats.total} unused
                </span>
              </div>
              {bankStats.unused === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  All questions have been used. Questions will repeat or upload more.
                </p>
              )}
              {bankSyncMsg && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5" />
                  {bankSyncMsg}
                </p>
              )}
            </CardContent>
          )}
          {!bankStats.total && bankSyncMsg && (
            <CardContent className="pt-0 pb-3">
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5" />
                {bankSyncMsg}
              </p>
            </CardContent>
          )}
        </Card>

        {startError && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>{startError}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Config card ── */}
          <div className="lg:col-span-2">
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle>Configure Mock Test</CardTitle>
                <CardDescription>
                  Select subjects, choose topics, and set the number of items per subject.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {AVAILABLE_SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjects[subject.id];
                  const hasTopics = (TOPIC_GROUPS[subject.id] ?? []).length > 0;
                  const secsPerItem = SECONDS_PER_ITEM[subject.id] ?? 60;
                  const subjectStats = getBankStats(subject.id);

                  return (
                    <div
                      key={subject.id}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        isSelected ? "bg-card" : "bg-muted/30 opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`subject-${subject.id}`}
                            checked={isSelected}
                            onCheckedChange={(v) =>
                              setSelectedSubjects((prev) => ({ ...prev, [subject.id]: v as boolean }))
                            }
                          />
                          <div>
                            <Label
                              htmlFor={`subject-${subject.id}`}
                              className="text-sm font-semibold cursor-pointer"
                            >
                              {subject.label}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {secsPerItem}s per item
                              {subjectStats.total > 0 && (
                                <span className="ml-2 text-primary/70">· {subjectStats.unused} unused in bank</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`count-${subject.id}`}
                            type="number"
                            min={1}
                            max={100}
                            className="w-16 text-center"
                            disabled={!isSelected}
                            value={itemCounts[subject.id]}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setItemCounts((prev) => ({
                                ...prev,
                                [subject.id]: isNaN(val) ? 0 : Math.max(1, Math.min(100, val)),
                              }));
                            }}
                          />
                          <span className="text-sm text-muted-foreground w-10">items</span>
                        </div>
                      </div>

                      {hasTopics && (
                        <TopicSelector
                          subjectId={subject.id}
                          selectedTopics={selectedTopics[subject.id] ?? [ALL_TOPICS_VALUE]}
                          onChange={(topics) =>
                            setSelectedTopics((prev) => ({ ...prev, [subject.id]: topics }))
                          }
                          disabled={!isSelected}
                        />
                      )}

                      {!hasTopics && subject.id.startsWith("reading") && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          Various passages with 2–5 questions each. No topic filter needed.
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row items-center justify-between bg-muted/50 p-6 border-t gap-4">
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-lg">{totalQuestions}</span>
                    <span className="text-muted-foreground">total questions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Estimated time: </span>
                    <span className="font-semibold text-foreground">{formatTime(totalSeconds)}</span>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto font-semibold"
                  onClick={handleStartTest}
                  disabled={totalQuestions === 0 || bankStats.total === 0}
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Start Test
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* ── Past sessions sidebar ── */}
          <div className="space-y-6">
            <UpgCalculator />

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Past Sessions</CardTitle>
                  </div>
                  {pastSessions.length > 0 && (
                    <span className="text-xs text-muted-foreground">{pastSessions.length} session{pastSessions.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingSessions ? (
                  <div className="space-y-3 p-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : pastSessions && pastSessions.length > 0 ? (
                  <PaginatedSessions
                    sessions={pastSessions}
                    onReview={(id) => setLocation(`/review/${id}`)}
                  />
                ) : (
                  <div className="text-center py-10 text-muted-foreground text-sm p-4">
                    <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>No past sessions yet.</p>
                    <p className="mt-1">Start a test to see your history here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
