import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackProjectLink } from '../model/project-link';
import { TimetrackExclusionRule } from '../store/exclusion';
import { AgentSessionCursor } from './collect';
import { AgentLogPass } from './ports';
import { TimetrackCursorRepairStore, repairStoredCursors$, sanitizeAgentSessionCursors } from './cursor-privacy';

const link = (path: string, target: TimetrackProjectLink['target']): TimetrackProjectLink => ({
  id: path,
  path,
  target,
  createdAt: new Date('2026-08-01T00:00:00Z'),
});

const LINKS = [
  link('/home/tom/dev/fut-frontend', { kind: 'project', projectKey: 'FIP' }),
  link('/home/tom/dev/side', { kind: 'private' }),
];

const RULES: TimetrackExclusionRule[] = [
  { kind: 'title-pattern', pattern: 'onlinebanking' },
  { kind: 'app-id', appId: 'org.keepassxc.KeePassXC' },
];

const cursor = (over: Partial<AgentSessionCursor> = {}): AgentSessionCursor => ({
  id: 'log-a',
  nextLine: 120,
  after: new Date('2026-08-17T09:00:00Z'),
  title: 'a session',
  cwd: '/home/tom/dev/fut-frontend',
  session: { sessionId: 's-1', model: 'opus' },
  ...over,
});

const sanitized = (over: Partial<AgentSessionCursor> = {}) => {
  const [only] = sanitizeAgentSessionCursors({ cursors: [cursor(over)], links: LINKS, rules: RULES });

  if (!only) throw new Error('sanitizeAgentSessionCursors returned no cursor');

  return only;
};

describe('sanitizeAgentSessionCursors', () => {
  it('keeps a cursor no rule reaches as it was', () => {
    const untouched = cursor();

    expect(sanitizeAgentSessionCursors({ cursors: [untouched], links: LINKS, rules: RULES })[0]).toBe(untouched);
  });

  it('drops the title, the checkout and the session of a private checkout', () => {
    expect(sanitized({ cwd: '/home/tom/dev/side' })).toEqual({
      id: 'log-a',
      nextLine: 120,
      after: new Date('2026-08-17T09:00:00Z'),
    });
  });

  it('drops them for a checkout below a private directory too', () => {
    expect(sanitized({ cwd: '/home/tom/dev/side/experiment' }).cwd).toBeUndefined();
  });

  it('keeps the read-through instant of a private checkout, so a backfill pass stays converged', () => {
    const readThrough = new Date('2026-08-17T10:00:00Z');

    expect(sanitized({ cwd: '/home/tom/dev/side', readThrough }).readThrough).toEqual(readThrough);
  });

  it('drops the title a rule denies and keeps the checkout', () => {
    const result = sanitized({ title: 'Onlinebanking — transfers' });

    expect(result.title).toBeUndefined();
    expect(result.cwd).toBe('/home/tom/dev/fut-frontend');
  });

  it('drops everything when the rule denies the checkout itself', () => {
    const result = sanitizeAgentSessionCursors({
      cursors: [cursor({ cwd: '/home/tom/dev/onlinebanking-ui' })],
      links: LINKS,
      rules: RULES,
    })[0];

    expect(result).toEqual({ id: 'log-a', nextLine: 120, after: new Date('2026-08-17T09:00:00Z') });
  });

  it('redacts the query string of a URL in a title it keeps', () => {
    expect(sanitized({ title: 'Reset at https://mail.example.com/r?token=abc' }).title).toBe(
      'Reset at https://mail.example.com/r',
    );
  });

  it('keeps a cursor of an unlinked checkout whole, so a later link can re-read its log', () => {
    expect(sanitized({ cwd: '/home/tom/dev/unlinked' }).cwd).toBe('/home/tom/dev/unlinked');
  });

  it('leaves a cursor that names no checkout to its title alone', () => {
    expect(sanitized({ cwd: undefined, title: 'a session' })).toEqual(cursor({ cwd: undefined }));
  });
});

describe('repairStoredCursors$', () => {
  const PASSES: AgentLogPass[] = ['agent-session', 'codex-session'];

  const storeOf = (byPass: Partial<Record<AgentLogPass, AgentSessionCursor[]>>) => {
    const written: { pass: AgentLogPass; cursors: readonly AgentSessionCursor[] }[] = [];
    const store: TimetrackCursorRepairStore = {
      cursors$: (pass) => of(byPass[pass] ?? []),
      writeCursors$: vi.fn((options) => {
        written.push(options);

        return of(undefined);
      }),
    };

    return { store, written };
  };

  it('writes back only the cursors it changed', async () => {
    const { store, written } = storeOf({
      'agent-session': [cursor(), cursor({ id: 'log-b', cwd: '/home/tom/dev/side' })],
    });

    await expect(
      firstValueFrom(repairStoredCursors$({ store, passes: PASSES, links: LINKS, rules: RULES })),
    ).resolves.toEqual({ scanned: 2, rewritten: 1 });

    expect(written).toEqual([
      { pass: 'agent-session', cursors: [{ id: 'log-b', nextLine: 120, after: new Date('2026-08-17T09:00:00Z') }] },
    ]);
  });

  it('writes nothing when every stored cursor is already clean', async () => {
    const { store, written } = storeOf({ 'agent-session': [cursor()] });

    await expect(
      firstValueFrom(repairStoredCursors$({ store, passes: PASSES, links: LINKS, rules: RULES })),
    ).resolves.toEqual({ scanned: 1, rewritten: 0 });

    expect(written).toEqual([]);
  });

  it('counts every pass it was given', async () => {
    const { store } = storeOf({ 'agent-session': [cursor()], 'codex-session': [cursor({ id: 'log-c' })] });

    await expect(
      firstValueFrom(repairStoredCursors$({ store, passes: PASSES, links: LINKS, rules: RULES })),
    ).resolves.toEqual({ scanned: 2, rewritten: 0 });
  });
});
