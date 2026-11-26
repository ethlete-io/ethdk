import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { rowPresenceOf } from './row-presence';

const at = (time: string) => new Date(`2026-10-02T${time}:00`);

const prompt = (time: string, askedBy?: 'human' | 'machine'): CollectedEvent =>
  ({ at: at(time), source: 'agent-prompt', kind: 'agent-prompt', askedBy }) as CollectedEvent;

const input = (time: string): CollectedEvent => ({ at: at(time), source: 'input', kind: 'input-active' });

describe('rowPresenceOf', () => {
  it('counts desk events and human prompts inside the row, and not prompts another program typed', () => {
    const events = [
      input('02:10'),
      input('02:40'),
      prompt('02:20', 'human'),
      prompt('02:30'),
      prompt('02:35', 'machine'),
      input('03:30'),
      prompt('01:00', 'human'),
    ];

    expect(rowPresenceOf({ events, from: at('02:00'), to: at('03:00') })).toEqual({ deskEvents: 2, humanPrompts: 2 });
  });
});
