import { IngestEnvelope } from '@ethlete/timetrack';
import { PostOutcome } from './reporter';

/** How long a post may take before the app counts as not running. It is a socket on this machine. */
const TIMEOUT_MS = 5_000;

/**
 * Posts one envelope to the local endpoint.
 *
 * A refused token is told apart from an unreachable app: the first means this reporter is holding a
 * stale address and has to read the discovery file again, and the second means the app is simply not
 * running, which is the ordinary state of an editor open before anything else.
 */
export const postEnvelope = async (options: {
  endpoint: string;
  token: string;
  envelope: IngestEnvelope;
}): Promise<PostOutcome> => {
  try {
    const response = await fetch(options.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${options.token}` },
      body: JSON.stringify(options.envelope),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 403) return 'unauthorized';

    return response.ok ? 'accepted' : 'unreachable';
  } catch {
    return 'unreachable';
  }
};
