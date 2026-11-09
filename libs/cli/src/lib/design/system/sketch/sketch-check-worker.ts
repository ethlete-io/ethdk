import { parentPort } from 'worker_threads';
import { cachedCheckOf } from './sketch-check-cache';
import { openSketchListingAt, ruleProblemsAt, SketchCheckRequest, SketchCheckResponse } from './sketch-checker';

const checkOf = cachedCheckOf(({ kind, ...request }: Omit<SketchCheckRequest, 'id'>) =>
  kind === 'rules' ? ruleProblemsAt(request) : openSketchListingAt(request),
);

const answerOf = ({ id, ...request }: SketchCheckRequest): SketchCheckResponse => {
  try {
    const listing = checkOf(request);

    return typeof listing === 'string' ? { id, error: listing } : { id, result: listing };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
};

parentPort?.on('message', (request: SketchCheckRequest) => parentPort?.postMessage(answerOf(request)));
