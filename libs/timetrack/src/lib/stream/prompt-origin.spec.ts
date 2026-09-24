import { describe, expect, it } from 'vitest';
import { CollectedEvent, InputEvent } from '../model/event';
import { promptOriginAt } from './prompt-origin';

const input = (kind: InputEvent['kind'], at: string): CollectedEvent => ({ at: new Date(at), source: 'input', kind });

const at = (time: string) => new Date(`2026-09-15T${time}Z`);

describe('promptOriginAt', () => {
  it('cannot tell on a day that recorded no short input idleness', () => {
    const events: CollectedEvent[] = [{ at: at('09:00:00'), source: 'idle', kind: 'idle-start' }];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('unknown');
  });

  it('reads a prompt typed while input was running as a desk prompt', () => {
    const events = [input('input-active', '2026-09-15T09:00:00Z')];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('desk');
  });

  it('reads a prompt with input stopping in the minute before it as a desk prompt', () => {
    const events = [input('input-active', '2026-09-15T09:00:00Z'), input('input-idle', '2026-09-15T09:59:30Z')];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('desk');
  });

  it('reads a prompt with input returning in the minute before it as a desk prompt', () => {
    const events = [input('input-idle', '2026-09-15T09:00:00Z'), input('input-active', '2026-09-15T09:59:50Z')];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('desk');
  });

  it('reads a prompt nobody touched the seat for as a remote prompt', () => {
    const events = [
      input('input-active', '2026-09-15T09:00:00Z'),
      input('input-idle', '2026-09-15T09:30:00Z'),
      input('input-active', '2026-09-15T11:00:00Z'),
    ];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('remote');
  });

  it('reads input that stopped just over a minute before the prompt as remote', () => {
    const events = [
      input('input-active', '2026-09-15T09:00:00Z'),
      input('input-idle', '2026-09-15T09:58:59Z'),
      input('input-active', '2026-09-15T10:30:00Z'),
    ];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('remote');
  });

  it('does not read a restarted notifier going idle again as input', () => {
    const events = [
      input('input-idle', '2026-09-15T09:00:00Z'),
      input('input-idle', '2026-09-15T09:59:30Z'),
      input('input-active', '2026-09-15T10:30:00Z'),
    ];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('remote');
  });

  it('cannot tell before the first transition says what the seat was doing', () => {
    const events = [input('input-idle', '2026-09-15T09:59:30Z')];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('unknown');
  });

  it('reads the events in time order whatever order they arrive in', () => {
    const events = [
      input('input-active', '2026-09-15T10:30:00Z'),
      input('input-idle', '2026-09-15T09:30:00Z'),
      input('input-active', '2026-09-15T09:00:00Z'),
    ];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('remote');
  });

  it('cannot tell when no returning input shows the app watched the seat through the prompt', () => {
    const events = [input('input-active', '2026-09-15T09:00:00Z'), input('input-idle', '2026-09-15T09:30:00Z')];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('unknown');
  });

  it('cannot tell when the app was closed and restarted after the seat went idle', () => {
    const events = [
      input('input-active', '2026-09-15T09:00:00Z'),
      input('input-idle', '2026-09-15T09:30:00Z'),
      input('input-idle', '2026-09-15T10:31:00Z'),
      input('input-active', '2026-09-15T11:00:00Z'),
    ];

    expect(promptOriginAt({ events, at: at('10:00:00') })).toBe('unknown');
    expect(promptOriginAt({ events, at: at('10:45:00') })).toBe('remote');
  });

  it('widens the window when asked to', () => {
    const events = [input('input-active', '2026-09-15T09:00:00Z'), input('input-idle', '2026-09-15T09:55:00Z')];

    expect(promptOriginAt({ events, at: at('10:00:00'), windowMs: 10 * 60_000 })).toBe('desk');
  });
});
