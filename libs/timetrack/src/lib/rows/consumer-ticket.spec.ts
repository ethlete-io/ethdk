import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { AttributedBlock } from './attribute';
import { consumerTickets } from './consumer-ticket';

const LIB_B = '/home/you/dev/lib-b';
const LIB_C = '/home/you/dev/lib-c';
const APP_A = '/home/you/dev/app-a';
const APP_X = '/home/you/dev/app-x';

const at = (time: string) => new Date(`2026-10-09T${time}:00`);

const entry = (options: {
  repoPath: string;
  from: string;
  to: string;
  branch?: string;
  issueKey?: string;
  standInId?: string;
}): AttributedBlock => ({
  block: {
    from: at(options.from),
    to: at(options.to),
    context: { repoPath: options.repoPath, branch: options.branch ?? 'next' },
    evidence: [],
  },
  issueKey: options.issueKey,
  standInId: options.standInId,
  confidence: options.issueKey ? 'certain' : 'weak',
  evidence: [],
});

const DEPENDENCIES = { [APP_A]: [LIB_B, LIB_C], [LIB_C]: [LIB_B], [APP_X]: [LIB_B] };

describe('consumerTickets', () => {
  it('gives every library worked on before the app the ticket of the app work that followed', () => {
    const named = consumerTickets({
      blocks: [
        entry({ repoPath: LIB_B, from: '10:00', to: '11:00' }),
        entry({ repoPath: LIB_C, from: '11:00', to: '12:00' }),
        entry({ repoPath: APP_A, from: '14:30', to: '16:00', branch: 'feat/ABC-7-club-pack', issueKey: 'ABC-7' }),
      ],
      dependencies: DEPENDENCIES,
    });

    expect(named.map((row) => [row.issueKey, row.confidence])).toEqual([
      ['ABC-7', 'weak'],
      ['ABC-7', 'weak'],
      ['ABC-7', 'certain'],
    ]);
    expect(named[1]?.evidence.at(-1)).toMatchObject({
      kind: 'consumer-checkout',
      at: at('14:30'),
      detail: 'used by `app-a`, worked on `feat/ABC-7-club-pack` at 14:30',
    });
    expect(named[0]?.evidence.at(-1)?.detail).toBe('used by `lib-c`, worked on `next` at 11:00');
  });

  it('takes only the next consumer of a shared library, not a later one', () => {
    const named = consumerTickets({
      blocks: [
        entry({ repoPath: LIB_B, from: '10:00', to: '11:00' }),
        entry({ repoPath: APP_X, from: '11:30', to: '12:00', issueKey: 'XYZ-1' }),
        entry({ repoPath: APP_A, from: '13:00', to: '14:00', issueKey: 'ABC-7' }),
      ],
      dependencies: DEPENDENCIES,
    });

    expect(named[0]?.issueKey).toBe('XYZ-1');
  });

  it('leaves the library alone when unnamed consumer work comes next', () => {
    const named = consumerTickets({
      blocks: [
        entry({ repoPath: LIB_B, from: '10:00', to: '11:00' }),
        entry({ repoPath: APP_X, from: '11:30', to: '12:00' }),
        entry({ repoPath: APP_A, from: '13:00', to: '14:00', issueKey: 'ABC-7' }),
      ],
      dependencies: DEPENDENCIES,
    });

    expect(named[0]?.issueKey).toBeUndefined();
  });

  it('leaves the library alone when no consumer work follows that day', () => {
    const before = entry({ repoPath: APP_A, from: '08:00', to: '09:00', issueKey: 'ABC-7' });
    const library = entry({ repoPath: LIB_B, from: '10:00', to: '11:00' });

    expect(consumerTickets({ blocks: [before, library], dependencies: DEPENDENCIES })[1]).toBe(library);
  });

  it('never replaces a key, a stand-in or a rule the library already has', () => {
    const keyed = entry({ repoPath: LIB_B, from: '09:00', to: '09:30', issueKey: 'LIB-1' });
    const waiting = entry({ repoPath: LIB_B, from: '09:30', to: '10:00', standInId: 'stand-in-1' });
    const ruled = entry({ repoPath: LIB_C, from: '10:00', to: '10:30' });
    const rule: AttributionRule = {
      id: 'rule-donor',
      repoPath: LIB_C,
      target: { kind: 'donate' },
      author: 'user',
      createdAt: at('00:00'),
    };
    const named = consumerTickets({
      blocks: [keyed, waiting, ruled, entry({ repoPath: APP_A, from: '11:00', to: '12:00', issueKey: 'ABC-7' })],
      dependencies: DEPENDENCIES,
      rules: [rule],
    });

    expect(named.slice(0, 3)).toEqual([keyed, waiting, ruled]);
  });

  it('files work in a subdirectory of a checkout under that checkout', () => {
    const named = consumerTickets({
      blocks: [
        entry({ repoPath: `${LIB_B}/libs/core`, from: '10:00', to: '11:00' }),
        entry({ repoPath: `${APP_A}/apps/web`, from: '11:30', to: '12:00', issueKey: 'ABC-7' }),
      ],
      dependencies: DEPENDENCIES,
    });

    expect(named[0]?.issueKey).toBe('ABC-7');
  });

  it('names nothing in a checkout no other checkout uses', () => {
    const app = entry({ repoPath: APP_A, from: '10:00', to: '11:00' });

    expect(
      consumerTickets({
        blocks: [app, entry({ repoPath: APP_X, from: '11:00', to: '12:00', issueKey: 'XYZ-1' })],
        dependencies: DEPENDENCIES,
      })[0],
    ).toBe(app);
  });
});
