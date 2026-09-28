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
    const asked = ['the day', 'a ticket', 'a match', 'a worklog'] as const;

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

describe('a run through codex', () => {
  const codexSpec = (options?: { model?: string; language?: string }) =>
    agentProcessSpec({
      systemPrompt: 'Map the day.',
      schema: { type: 'object', required: ['answers'] },
      stdin: '{"contexts":[]}',
      ask: 'the day',
      options: { command: 'codex', ...options },
    });

  const configValue = (args: string[], key: string) =>
    args.find((arg, index) => args[index - 1] === '-c' && arg.startsWith(`${key}=`))?.slice(key.length + 1);

  it('runs one read-only, non-interactive exec that reads its prompt from stdin', () => {
    const spec = codexSpec();

    expect(spec.command).toBe('codex');
    expect(spec.args.slice(0, 2)).toEqual(['exec', '--json']);
    expect(spec.args).toContain('--ephemeral');
    expect(spec.args.slice(spec.args.indexOf('--sandbox'), spec.args.indexOf('--sandbox') + 2)).toEqual([
      '--sandbox',
      'read-only',
    ]);
    expect(configValue(spec.args, 'approval_policy')).toBe('"never"');
    expect(spec.args.at(-1)).toBe('-');
    expect(spec.stdin).toBe('{"contexts":[]}');
  });

  it('switches off the tools that reach the machine', () => {
    const disabled = codexSpec().args.filter((_, index, args) => args[index - 1] === '--disable');

    expect(disabled).toEqual(expect.arrayContaining(['shell_tool', 'unified_exec', 'code_mode_host', 'multi_agent']));
  });

  it('sends none of the flags only claude knows', () => {
    const { args } = codexSpec({ model: 'gpt-5.6-luna' });

    for (const flag of ['--print', '--safe-mode', '--system-prompt', '--output-format', '--json-schema', '--tools']) {
      expect(args).not.toContain(flag);
    }
  });

  it('carries the prompt, the language and the schema as developer instructions', () => {
    const instructions = JSON.parse(
      configValue(codexSpec({ language: 'Deutsch' }).args, 'developer_instructions') ?? '""',
    );

    expect(instructions.startsWith('Map the day.')).toBe(true);
    expect(instructions).toContain('in Deutsch');
    expect(instructions).toContain('{"type":"object","required":["answers"]}');
  });

  it('leaves the model to the CLI when none is configured', () => {
    expect(codexSpec().args).not.toContain('--model');
    expect(codexSpec({ model: 'gpt-5.6-luna' }).args).toContain('gpt-5.6-luna');
  });
});
