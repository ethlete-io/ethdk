import { parentPort } from 'worker_threads';
import { openSketchListingAt, SketchCheckRequest, SketchCheckResponse } from './sketch-checker';

const answerOf = ({ id, ...request }: SketchCheckRequest): SketchCheckResponse => {
  try {
    const listing = openSketchListingAt(request);

    return typeof listing === 'string' ? { id, error: listing } : { id, result: listing };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
};

parentPort?.on('message', (request: SketchCheckRequest) => parentPort?.postMessage(answerOf(request)));
