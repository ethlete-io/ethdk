import { existsSync } from 'fs';
import { availableParallelism } from 'os';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf } from '../../package-root';
import { PixelPair } from './change-box';

export type PixelPairJob = { id: number; a: ArrayBuffer; b: ArrayBuffer };

export type PixelPairAnswer = { id: number; pair?: PixelPair; error?: string };

type Pending = { resolve: (pair: PixelPair) => void; reject: (error: Error) => void };

type Slot = { worker: Worker; pending: Map<number, Pending> };

const POOL_SIZE = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));

const slots: Slot[] = [];
let nextId = 0;

const startWorker = () => {
  const built = packageFileOf(resolve(__dirname, 'pixel-pair-worker.js'));

  return existsSync(built)
    ? new Worker(built)
    : new Worker(resolve(__dirname, 'pixel-pair-worker.ts'), {
        execArgv: [
          '--import',
          pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href,
        ],
      });
};

const startSlot = () => {
  const slot: Slot = { worker: startWorker(), pending: new Map() };
  const fail = (error: Error) => {
    if (slots.includes(slot)) slots.splice(slots.indexOf(slot), 1);
    slot.pending.forEach(({ reject }) => reject(error));
    slot.pending.clear();
  };

  slot.worker.unref();
  slot.worker.on('message', ({ id, pair, error }: PixelPairAnswer) => {
    const pending = slot.pending.get(id);

    slot.pending.delete(id);
    if (slot.pending.size === 0) slot.worker.unref();
    if (pair) pending?.resolve(pair);
    else pending?.reject(new Error(error ?? 'the pixel pair worker gave no answer'));
  });
  slot.worker.on('error', fail);
  slot.worker.on('exit', (code) => fail(new Error(`the pixel pair worker exited with ${code}`)));
  slots.push(slot);

  return slot;
};

const idlestSlot = () => {
  const idlest = slots.reduce<Slot | undefined>(
    (best, slot) => (!best || slot.pending.size < best.pending.size ? slot : best),
    undefined,
  );

  return idlest && (idlest.pending.size === 0 || slots.length >= POOL_SIZE) ? idlest : startSlot();
};

const ownCopyOf = (png: Buffer) => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;

/**
 * `pixelPairOf` of two PNG pictures, run in a pool of worker threads, so decoding them never blocks the thread that
 * answers requests.
 */
export const comparePixelPair = (a: Buffer, b: Buffer): Promise<PixelPair> =>
  a.equals(b)
    ? Promise.resolve({ same: true, change: null })
    : new Promise<PixelPair>((settle, reject) => {
        const slot = idlestSlot();
        const id = nextId++;
        const job: PixelPairJob = { id, a: ownCopyOf(a), b: ownCopyOf(b) };

        slot.pending.set(id, { resolve: settle, reject });
        slot.worker.ref();
        slot.worker.postMessage(job, [job.a, job.b]);
      });
