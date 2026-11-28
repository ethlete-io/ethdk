export type YieldTurn = () => Promise<void>;

let current: YieldTurn | null = null;
let held = 0;

/** Runs `run` as a design run that hands its turn to `turn` whenever it calls `yieldRun` between two parts. */
export const withRunYield = async <T>(turn: YieldTurn | undefined, run: () => Promise<T>) => {
  const outer = current;

  current = turn ?? null;

  try {
    return await run();
  } finally {
    current = outer;
  }
};

/**
 * Lets the resident design process run the requests waiting for it before this run draws its next part. Call it only
 * where the run has no draw in flight: everything the run writes while it waits goes to the waiting request.
 */
export const yieldRun = async () => {
  const turn = current;

  if (!turn || held > 0) return;

  current = null;

  try {
    await turn();
  } finally {
    current = turn;
  }
};

/** Runs `run` with `yieldRun` a no-op until it settles, for draws that run beside another draw of the same run. */
export const withoutYield = async <T>(run: () => Promise<T>) => {
  held += 1;

  try {
    return await run();
  } finally {
    held -= 1;
  }
};
