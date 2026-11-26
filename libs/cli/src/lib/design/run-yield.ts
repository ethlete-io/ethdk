export type YieldTurn = () => Promise<void>;

let current: YieldTurn | null = null;

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

  if (!turn) return;

  current = null;

  try {
    await turn();
  } finally {
    current = turn;
  }
};
