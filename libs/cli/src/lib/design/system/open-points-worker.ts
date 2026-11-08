import { parentPort } from 'worker_threads';
import { OpenPointsRequest, openPointsOf } from './open-points-runner';

const answerOf = (id: number, request: OpenPointsRequest) => {
  try {
    return { id, result: openPointsOf(request) };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
};

parentPort?.on('message', ({ id, request }: { id: number; request: OpenPointsRequest }) =>
  parentPort?.postMessage(answerOf(id, request)),
);
