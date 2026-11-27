import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { cloneOwnersOf, localClonesOf } from './clone';

const SDK = '/home/human/dev/sdk';
const CLIENT = '/home/human/dev/client/app-frontend';
const CLONE = '/home/human/dev/scratch/b757-app-scratch';

const session = (options: { cwd: string; workedIn: string; sessionId?: string }) =>
  ({
    at: new Date('2026-11-26T01:15:00Z'),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.sessionId ?? 'session-1',
    cwd: options.cwd,
    workedIn: options.workedIn,
  }) as CollectedEvent;

const roots = { paths: [SDK, CLIENT, CLONE], worktrees: {} };

describe('localClonesOf', () => {
  it('maps a checkout whose origin is another checkout on this machine to that checkout', () => {
    expect(
      localClonesOf({
        [SDK]: 'github.com/ethlete/sdk',
        [CLIENT]: 'gitlab.com/client/app-frontend',
        [CLONE]: CLIENT.toLowerCase(),
        '/home/human/dev/scratch/gone': '/home/human/dev/elsewhere',
      }),
    ).toEqual({ [CLONE]: CLIENT });
  });
});

describe('cloneOwnersOf', () => {
  it('files a clone under the checkout whose agent session worked in it', () => {
    // A scratch clone made by an SDK agent is SDK work, not the client's and not a column of its own.
    expect(
      cloneOwnersOf({
        events: [
          session({ cwd: SDK, workedIn: `${CLONE}/apps/web/main.ts` }),
          session({ cwd: SDK, workedIn: `${CLONE}/` }),
          session({ cwd: CLIENT, workedIn: `${CLONE}/`, sessionId: 'session-2' }),
        ],
        clones: { [CLONE]: CLIENT },
        roots,
      }),
    ).toEqual({ [CLONE]: SDK });
  });

  it('leaves a clone unfiled when only sessions started in it worked there, or two checkouts tie', () => {
    expect(
      cloneOwnersOf({ events: [session({ cwd: CLONE, workedIn: `${CLONE}/` })], clones: { [CLONE]: CLIENT }, roots }),
    ).toEqual({});
    expect(
      cloneOwnersOf({
        events: [
          session({ cwd: SDK, workedIn: `${CLONE}/` }),
          session({ cwd: CLIENT, workedIn: `${CLONE}/`, sessionId: 'session-2' }),
        ],
        clones: { [CLONE]: CLIENT },
        roots,
      }),
    ).toEqual({});
  });

  it('files nothing a session did in a checkout that is no clone', () => {
    expect(cloneOwnersOf({ events: [session({ cwd: SDK, workedIn: `${CLIENT}/` })], clones: {}, roots })).toEqual({});
  });
});
