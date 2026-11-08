import { parentPort } from 'worker_threads';
import { openSketchListingAt, ruleProblemsAt, SketchCheckRequest, SketchCheckResponse } from './sketch-checker';

const answerOf = ({ id, kind, ...request }: SketchCheckRequest): SketchCheckResponse => {
  try {
    const listing = kind === 'rules' ? ruleProblemsAt(request) : openSketchListingAt(request);

    return typeof listing === 'string' ? { id, error: listing } : { id, result: listing };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
};

parentPort?.on('message', (request: SketchCheckRequest) => parentPort?.postMessage(answerOf(request)));
