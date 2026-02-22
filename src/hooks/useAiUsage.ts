import { useCallback, useMemo, useState } from 'react';

interface AiDailyUsage {
  date: string;
  requests: number;
  failures: number;
}

const STORAGE_KEY = 'pdf-reader-ai-usage';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readUsage(): AiDailyUsage {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { date: today, requests: 0, failures: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<AiDailyUsage>;
    if (parsed.date !== today) {
      return { date: today, requests: 0, failures: 0 };
    }
    return {
      date: today,
      requests: Number.isFinite(parsed.requests) ? Math.max(0, Math.floor(parsed.requests ?? 0)) : 0,
      failures: Number.isFinite(parsed.failures) ? Math.max(0, Math.floor(parsed.failures ?? 0)) : 0,
    };
  } catch {
    return { date: today, requests: 0, failures: 0 };
  }
}

function writeUsage(usage: AiDailyUsage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Ignore storage failures.
  }
}

export function useAiUsage() {
  const [usage, setUsage] = useState<AiDailyUsage>(readUsage);

  const syncToday = useCallback(() => {
    const today = todayKey();
    setUsage((prev) => {
      if (prev.date === today) {
        return prev;
      }
      const next = { date: today, requests: 0, failures: 0 };
      writeUsage(next);
      return next;
    });
  }, []);

  const recordRequest = useCallback((success: boolean) => {
    setUsage((prev) => {
      const today = todayKey();
      const base = prev.date === today ? prev : { date: today, requests: 0, failures: 0 };
      const next = {
        date: today,
        requests: base.requests + 1,
        failures: base.failures + (success ? 0 : 1),
      };
      writeUsage(next);
      return next;
    });
  }, []);

  const resetToday = useCallback(() => {
    const next = { date: todayKey(), requests: 0, failures: 0 };
    writeUsage(next);
    setUsage(next);
  }, []);

  const failureRate = useMemo(() => {
    if (usage.requests === 0) {
      return 0;
    }
    return usage.failures / usage.requests;
  }, [usage.failures, usage.requests]);

  return {
    usage,
    syncToday,
    recordRequest,
    resetToday,
    failureRate,
  };
}
