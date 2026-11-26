import { parentPort } from 'worker_threads';
import { MergeRequest, MergeResponse, studioMergeOf } from './merge-runner';

const answerOf = (request: MergeRequest): MergeResponse => {
  try {
    return { result: studioMergeOf(request) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

parentPort?.once('message', (request: MergeRequest) => parentPort?.postMessage(answerOf(request)));
