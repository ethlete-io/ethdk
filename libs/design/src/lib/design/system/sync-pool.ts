import { MessageChannel, MessagePort, receiveMessageOnPort, Worker, workerData } from 'worker_threads';

/** What a pool worker gets as `workerData`: the port its jobs come on and the counter it bumps after each answer. */
export type PoolWorkerData = { port: MessagePort; answered: Int32Array };

type Reply<TAnswer> = { index: number; answer?: TAnswer; error?: string };

/** A pool of workers that runs jobs in parallel while the calling thread blocks, so the caller's code stays synchronous. */
export type SyncPool<TJob, TAnswer> = { run: (jobs: TJob[]) => TAnswer[]; stop: () => void };

/**
 * Starts `size` workers with `start`, which must pass the given `workerData` and `transferList` on to `new Worker`; the
 * worker entry calls `answerPoolJobs`. `run` throws when a job throws or no worker answers for `stallMs`.
 */
export const startSyncPool = <TJob, TAnswer>(options: {
  size: number;
  start: (data: PoolWorkerData, transferList: MessagePort[]) => Worker;
  stallMs?: number;
}): SyncPool<TJob, TAnswer> => {
  const { size, start, stallMs = 60_000 } = options;
  const answered = new Int32Array(new SharedArrayBuffer(4));
  const slots = Array.from({ length: size }, () => {
    const { port1, port2 } = new MessageChannel();
    const worker = start({ port: port2, answered }, [port2]);

    worker.unref();

    return { worker, port: port1 };
  });

  const run = (jobs: TJob[]) => {
    const answers: TAnswer[] = [];
    let next = 0;
    let done = 0;
    const give = (port: MessagePort) => {
      if (next >= jobs.length) return;

      port.postMessage({ index: next, job: jobs[next] });
      next++;
    };

    for (const { port } of slots) give(port);

    while (done < jobs.length) {
      const seen = Atomics.load(answered, 0);

      for (const { port } of slots) {
        for (let received = receiveMessageOnPort(port); received; received = receiveMessageOnPort(port)) {
          const reply = received.message as Reply<TAnswer>;

          if (reply.error !== undefined) throw new Error(reply.error);

          answers[reply.index] = reply.answer as TAnswer;
          done++;
          give(port);
        }
      }

      if (done < jobs.length && Atomics.wait(answered, 0, seen, stallMs) === 'timed-out')
        throw new Error(`no pool worker answered in ${stallMs} ms`);
    }

    return answers;
  };

  const stop = () => {
    for (const { worker, port } of slots) {
      port.close();
      void worker.terminate();
    }
  };

  return { run, stop };
};

/** Answers the jobs of a `startSyncPool` pool in a worker with `answerOf`. */
export const answerPoolJobs = <TJob, TAnswer>(answerOf: (job: TJob) => TAnswer) => {
  const { port, answered } = workerData as PoolWorkerData;

  port.on('message', ({ index, job }: { index: number; job: TJob }) => {
    let reply: Reply<TAnswer>;

    try {
      reply = { index, answer: answerOf(job) };
    } catch (error) {
      reply = { index, error: error instanceof Error ? error.message : String(error) };
    }

    port.postMessage(reply);
    Atomics.add(answered, 0, 1);
    Atomics.notify(answered, 0);
  });
};
