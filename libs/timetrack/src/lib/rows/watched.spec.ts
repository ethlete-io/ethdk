import { describe, expect, it } from 'vitest';
import { CollectedEvent, PromptAskedBy } from '../model/event';
import { watchPrompts, watchedAt } from './watched';

const DAY = '2026-09-22';

const at = (clock: string) => new Date(`${DAY}T${clock}:00.000Z`);

const prompt = (options: { clock: string; sessionId: string; askedBy?: PromptAskedBy }): CollectedEvent => ({
  at: at(options.clock),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: options.sessionId,
  promptId: `${options.sessionId}-${options.clock}`,
  cwd: '/home/you/dev/abc-frontend',
  ...(options.askedBy ? { askedBy: options.askedBy } : {}),
});

describe('watchPrompts', () => {
  it('drops a prompt the agent gave itself, because nobody typed it', () => {
    const prompts = watchPrompts([
      prompt({ clock: '10:00', sessionId: 'a' }),
      prompt({ clock: '10:30', sessionId: 'b', askedBy: 'machine' }),
      prompt({ clock: '11:00', sessionId: 'c', askedBy: 'human' }),
    ]);

    expect(prompts.map((entry) => entry.sessionId)).toEqual(['a', 'c']);
  });

  it('orders the prompts oldest first, whatever order the day held them in', () => {
    const prompts = watchPrompts([
      prompt({ clock: '11:00', sessionId: 'b' }),
      prompt({ clock: '10:00', sessionId: 'a' }),
    ]);

    expect(prompts.map((entry) => entry.sessionId)).toEqual(['a', 'b']);
  });
});

describe('watchedAt', () => {
  const prompts = watchPrompts([
    prompt({ clock: '10:17', sessionId: 'a' }),
    prompt({ clock: '11:18', sessionId: 'b' }),
    prompt({ clock: '12:00', sessionId: 'c' }),
  ]);

  it('answers with the session the user prompted last', () => {
    expect(watchedAt({ prompts, among: new Set(['a', 'b']), at: at('11:25') })).toBe('b');
  });

  it('holds a session until the user prompts another one', () => {
    expect(watchedAt({ prompts, among: new Set(['a', 'b']), at: at('11:00') })).toBe('a');
  });

  it('answers among the sessions running, so a prompt to a session that stopped decides nothing', () => {
    expect(watchedAt({ prompts, among: new Set(['a', 'b']), at: at('12:30') })).toBe('b');
  });

  it('answers nothing before the first prompt of the sessions running', () => {
    expect(watchedAt({ prompts, among: new Set(['a', 'b']), at: at('09:00') })).toBeUndefined();
  });
});
