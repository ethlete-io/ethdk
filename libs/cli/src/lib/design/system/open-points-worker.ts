import { parentPort } from 'worker_threads';
import { buildReadyDataOf, openPointsOf, WorkerRequest } from './open-points-runner';
import { replaceHeldEdits } from './sketch/held-edits';

const answerOf = (id: number, message: WorkerRequest) => {
  replaceHeldEdits(message.held);

  try {
    return { id, result: 'request' in message ? openPointsOf(message.request) : buildReadyDataOf(message.inputs) };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
};

parentPort?.on('message', ({ id, ...message }: { id: number } & WorkerRequest) =>
  parentPort?.postMessage(answerOf(id, message)),
);
