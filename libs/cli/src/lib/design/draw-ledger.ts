export const QUEUE_PATH = '/__design/queue';

export const KEPT_FAILURES = 20;

export type DrawFailure = { part: string; state: string; status: number; message: string; at: string };

export type QueueReport = {
  queued: number;
  rendering: number;
  oldestMs: number | null;
  failedTotal: number;
  failed: DrawFailure[];
};

type Asked = { since: number; drawing: boolean };

/**
 * Counts the drawings every draw queue of a design server holds, and keeps the last `KEPT_FAILURES` shots
 * that failed, newest first.
 */
export const createDrawLedger = (now: () => number = Date.now) => {
  const asked = new Set<Asked>();
  const failed: DrawFailure[] = [];
  let failedTotal = 0;

  return {
    /** Records a drawing as queued; `start` marks it drawing and `end` drops it. */
    ask: () => {
      const entry: Asked = { since: now(), drawing: false };

      asked.add(entry);

      return {
        start: () => {
          entry.drawing = true;
        },
        end: () => {
          asked.delete(entry);
        },
      };
    },
    fail: (failure: Omit<DrawFailure, 'at'>) => {
      failedTotal++;
      failed.unshift({ ...failure, at: new Date(now()).toISOString() });
      failed.splice(KEPT_FAILURES);
    },
    report: (): QueueReport => {
      const entries = [...asked];
      const rendering = entries.filter((entry) => entry.drawing).length;
      const oldest = Math.min(...entries.map((entry) => entry.since));

      return {
        queued: entries.length - rendering,
        rendering,
        oldestMs: entries.length ? now() - oldest : null,
        failedTotal,
        failed: [...failed],
      };
    },
  };
};

export type DrawLedger = ReturnType<typeof createDrawLedger>;
