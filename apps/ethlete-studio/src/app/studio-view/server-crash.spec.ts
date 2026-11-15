import { serverCrashOf } from './server-crash';

const CRASH = {
  time: new Date(2027, 2, 2, 23, 5, 59).toISOString(),
  pid: 3500017,
  port: 4482,
  path: '/checkout/.ethlete/cache/design-server-crash.log',
  stack: ['Error: write EPIPE', '    at afterWriteDispatched (node:internal/stream_base_commons:159:15)'],
};

describe('serverCrashOf', () => {
  it('shows the crash time as a local German date and keeps the rest of the entry', () => {
    expect(serverCrashOf(CRASH)).toEqual({ ...CRASH, time: '02.03.2027, 23:05:59' });
  });

  it('keeps a time it cannot read as it is', () => {
    expect(serverCrashOf({ ...CRASH, time: 'yesterday' })?.time).toBe('yesterday');
  });

  it('reads no crash as none', () => {
    expect(serverCrashOf(null)).toBeNull();
  });
});
