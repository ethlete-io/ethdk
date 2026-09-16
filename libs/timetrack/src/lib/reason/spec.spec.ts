import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMETRACK_SETTINGS } from '../settings/model';
import { reasoningOptionsOf } from './model';
import { agentProcessSpec, languageInstruction } from './spec';

const systemPromptOf = (args: string[]) => args[args.indexOf('--system-prompt') + 1] ?? '';

const specWith = (language?: string) =>
  agentProcessSpec({
    systemPrompt: 'Write in the language the evidence is in.',
    schema: { type: 'object' },
    stdin: '{}',
    ask: 'a ticket',
    ...(language === undefined ? {} : { options: { language } }),
  });

describe('the language every answer is written in', () => {
  it('leaves the prompt untouched while no language is named', () => {
    expect(systemPromptOf(specWith().args)).toBe('Write in the language the evidence is in.');
  });

  it('treats a language of only spaces as none named', () => {
    expect(systemPromptOf(specWith('   ').args)).toBe('Write in the language the evidence is in.');
  });

  it('names the language the user typed, after the prompt rather than inside it', () => {
    const prompt = systemPromptOf(specWith('Deutsch').args);

    expect(prompt.startsWith('Write in the language the evidence is in.')).toBe(true);
    expect(prompt).toContain('Write every word you answer in Deutsch');
  });

  it('says it outranks the rule the prompt already carries, which would otherwise contradict it', () => {
    expect(systemPromptOf(specWith('Deutsch').args)).toContain('overrides any rule above');
  });

  it('keeps an issue key and a branch name out of the translation', () => {
    const prompt = systemPromptOf(specWith('Deutsch').args);

    expect(prompt).toContain('Never translate an issue key');
    expect(prompt).toContain('a branch name');
  });

  it('reaches every call, because every spec is built here', () => {
    const asked = ['the day', 'a ticket', 'a match'] as const;

    for (const ask of asked) {
      const spec = agentProcessSpec({
        systemPrompt: 'p',
        schema: {},
        stdin: '{}',
        ask,
        options: { language: 'Deutsch' },
      });

      expect(systemPromptOf(spec.args)).toContain('in Deutsch');
    }
  });

  it('answers nothing of its own for an empty language', () => {
    expect(languageInstruction('')).toBe('');
  });
});

describe('what a call takes from the settings document', () => {
  it('carries the language through, so a press reaches the prompt with it', () => {
    const settings = {
      ...DEFAULT_TIMETRACK_SETTINGS,
      reasoning: { ...DEFAULT_TIMETRACK_SETTINGS.reasoning, model: 'sonnet', language: 'Deutsch' },
    };

    expect(reasoningOptionsOf(settings)).toEqual({ command: 'claude', model: 'sonnet', language: 'Deutsch' });

    const spec = agentProcessSpec({
      systemPrompt: 'p',
      schema: {},
      stdin: '{}',
      ask: 'a ticket',
      options: reasoningOptionsOf(settings),
    });

    expect(systemPromptOf(spec.args)).toContain('in Deutsch');
    expect(spec.args).toContain('sonnet');
  });
});
