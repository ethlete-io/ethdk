const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export const listingHold = (holdMs, wait = sleep) => {
  const pending = new Set();
  let job = 0;
  let running = false;

  return {
    startJob: () => {
      job++;
      running = false;
    },
    startRun: () => {
      running = true;
    },
    hold: async () => {
      const held = { job, running };

      pending.add(held);
      try {
        await wait(holdMs);
      } finally {
        pending.delete(held);
      }
    },
    check: (result) =>
      result.ok && [...pending].some((held) => held.job === job && held.running)
        ? {
            ok: false,
            detail: `ended while a held listing was pending: its wait is shorter than the ${holdMs} ms hold; wait longer or set holdListings: false (${result.detail})`,
          }
        : result,
  };
};
