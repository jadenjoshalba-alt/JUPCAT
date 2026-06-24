import { useState, useEffect } from "react";

const UPCAT_DATE = { year: 2026, month: 7, day: 1 }; // August 1, 2026 (month is 0-indexed)
const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

function getPHTDateComponents(nowMs: number) {
  const phtMs = nowMs + PHT_OFFSET_MS;
  const d = new Date(phtMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}

function calcDaysLeft(nowMs: number): number {
  const { year, month, day } = getPHTDateComponents(nowMs);
  const todayPHT = Date.UTC(year, month, day);
  const upcatPHT = Date.UTC(UPCAT_DATE.year, UPCAT_DATE.month, UPCAT_DATE.day);
  return Math.max(0, Math.floor((upcatPHT - todayPHT) / 86_400_000));
}

function msUntilNextMidnightPHT(nowMs: number): number {
  const { year, month, day } = getPHTDateComponents(nowMs);
  const nextMidnightPHT_utc = Date.UTC(year, month, day + 1) - PHT_OFFSET_MS;
  return Math.max(0, nextMidnightPHT_utc - nowMs);
}

export function useUpcatCountdown() {
  const [daysLeft, setDaysLeft] = useState(() => calcDaysLeft(Date.now()));

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNextUpdate() {
      const now = Date.now();
      setDaysLeft(calcDaysLeft(now));
      const delay = msUntilNextMidnightPHT(now) + 500;
      timeoutId = setTimeout(scheduleNextUpdate, delay);
    }

    const delay = msUntilNextMidnightPHT(Date.now()) + 500;
    timeoutId = setTimeout(scheduleNextUpdate, delay);

    return () => clearTimeout(timeoutId);
  }, []);

  return daysLeft;
}
