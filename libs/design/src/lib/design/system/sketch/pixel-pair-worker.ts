import { parentPort } from 'worker_threads';
import { pixelPairOf } from './change-box';
import { PixelPairAnswer, PixelPairJob } from './pixel-pair';

parentPort?.on('message', ({ id, a, b }: PixelPairJob) => {
  let answer: PixelPairAnswer;

  try {
    answer = { id, pair: pixelPairOf(Buffer.from(a), Buffer.from(b)) };
  } catch (error) {
    answer = { id, error: error instanceof Error ? error.message : String(error) };
  }

  parentPort?.postMessage(answer);
});
