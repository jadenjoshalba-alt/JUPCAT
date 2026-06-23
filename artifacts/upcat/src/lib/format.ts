export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const SUBJECT_LABELS: Record<string, string> = {
  language_english: "Language Proficiency (English)",
  language_filipino: "Language Proficiency (Filipino)",
  math: "Mathematics",
  science: "Science",
  reading_english: "Reading Comprehension (English)",
  reading_filipino: "Reading Comprehension (Filipino)",
};

// Seconds per item per subject type
export const SECONDS_PER_ITEM: Record<string, number> = {
  language_english: 22,
  language_filipino: 22,
  math: 60,
  science: 40,
  reading_english: 45,
  reading_filipino: 45,
};

export function calcTotalSeconds(
  selectedSubjects: Record<string, boolean>,
  itemCounts: Record<string, number>
): number {
  return Object.entries(selectedSubjects)
    .filter(([, selected]) => selected)
    .reduce((total, [subj]) => {
      const secs = SECONDS_PER_ITEM[subj] ?? 60;
      return total + (itemCounts[subj] || 0) * secs;
    }, 0);
}
