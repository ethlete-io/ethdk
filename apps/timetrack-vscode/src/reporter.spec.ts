import { INGEST_PROTOCOL_VERSION, IngestEnvelope, IngestRecord } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { MAX_HELD, PostOutcome, createReporter } from './reporter';

const DISCOVERY = { version: INGEST_PROTOCOL_VERSION, port: 51234, token: 'a'.repeat(64) };

const record = (atMs: number): IngestRecord => ({
  atMs,
  kind: 'editor-heartbeat',
  repoPath: '/home/tom/dev/sdk',
  editing: true,
});

type Posted = { endpoint: string; token: string; envelope: IngestEnvelope };

const harness = (options: { outcomes?: PostOutcome[]; discovery?: unknown[] } = {}) => {
  const outcomes = [...(options.outcomes ?? [])];
  const files = [...(options.discovery ?? [DISCOVERY])];
  const posts: Posted[] = [];
  let reads = 0;
  const reporter = createReporter({
    readDiscovery: async () => {
      reads += 1;

      return files.length > 1 ? files.shift() : files[0];
    },
    post: async (post) => {
      posts.push(post);

      return outcomes.shift() ?? 'accepted';
    },
  });

  return { reporter, posts, reads: () => reads };
};

describe('createReporter', () => {
  it('posts a record to the endpoint the discovery file names', async () => {
    const { reporter, posts } = harness();

    expect(await reporter.report(record(1))).toBe('accepted');
    expect(posts[0]?.endpoint).toBe('http://127.0.0.1:51234/ingest');
    expect(posts[0]?.token).toBe(DISCOVERY.token);
    expect(posts[0]?.envelope).toEqual({ reporter: 'vscode', events: [record(1)] });
  });

  it('reads the discovery file once while the app keeps taking what it posts', async () => {
    const { reporter, reads } = harness();

    await reporter.report(record(1));
    await reporter.report(record(2));

    expect(reads()).toBe(1);
  });

  it('holds what it could not deliver and sends it with the next one', async () => {
    const { reporter, posts } = harness({ outcomes: ['unreachable'] });

    await reporter.report(record(1));

    expect(reporter.held()).toBe(1);

    await reporter.report(record(2));

    expect(reporter.held()).toBe(0);
    expect(posts[1]?.envelope.events).toEqual([record(1), record(2)]);
  });

  it('reads the file again after a refused token, so a restarted app is found', async () => {
    const restarted = { ...DISCOVERY, port: 51999, token: 'b'.repeat(64) };
    const { reporter, posts } = harness({ outcomes: ['unauthorized'], discovery: [DISCOVERY, restarted] });

    await reporter.report(record(1));
    await reporter.report(record(2));

    expect(posts[1]?.endpoint).toBe('http://127.0.0.1:51999/ingest');
    expect(posts[1]?.token).toBe(restarted.token);
  });

  it('never grows past what it may hold', async () => {
    const { reporter } = harness({ outcomes: Array.from({ length: MAX_HELD + 10 }, (): PostOutcome => 'unreachable') });

    for (let index = 0; index < MAX_HELD + 10; index += 1) await reporter.report(record(index));

    expect(reporter.held()).toBe(MAX_HELD);
  });

  it('drops the oldest rather than the newest when it is full', async () => {
    const { reporter, posts } = harness({
      outcomes: Array.from({ length: MAX_HELD + 1 }, (): PostOutcome => 'unreachable'),
    });

    for (let index = 0; index < MAX_HELD + 1; index += 1) await reporter.report(record(index));
    await reporter.report(record(999));

    expect(posts.at(-1)?.envelope.events.at(-1)).toEqual(record(999));
    expect(posts.at(-1)?.envelope.events.at(0)).toEqual(record(1));
  });

  it('posts nothing at all for a window with nothing to report', async () => {
    const { reporter, posts } = harness();

    expect(await reporter.report(null)).toBe('idle');
    expect(posts).toEqual([]);
  });

  it('still flushes what it is holding when the window has nothing new to say', async () => {
    const { reporter, posts } = harness({ outcomes: ['unreachable'] });

    await reporter.report(record(1));

    expect(await reporter.report(null)).toBe('accepted');
    expect(posts[1]?.envelope.events).toEqual([record(1)]);
  });

  it('holds rather than posting while no app has written a discovery file', async () => {
    const { reporter, posts } = harness({ discovery: [null] });

    expect(await reporter.report(record(1))).toBe('unreachable');
    expect(posts).toEqual([]);
    expect(reporter.held()).toBe(1);
  });

  it('refuses a discovery file from a protocol it does not know', async () => {
    const { reporter, posts } = harness({ discovery: [{ ...DISCOVERY, version: INGEST_PROTOCOL_VERSION + 1 }] });

    expect(await reporter.report(record(1))).toBe('unreachable');
    expect(posts).toEqual([]);
  });
});
