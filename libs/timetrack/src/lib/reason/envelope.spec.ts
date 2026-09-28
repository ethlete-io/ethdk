import { describe, expect, it } from 'vitest';
import { agentOutputDocument } from './envelope';

/** Captured from `codex exec` 0.157.0, run with the arguments `agentProcessSpec` builds for codex. */
const CODEX_ANSWER = [
  '{"type":"thread.started","thread_id":"01a0e843-20ca-7f32-af69-820bbe7e67ae"}',
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`."}}',
  '{"type":"turn.started"}',
  '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"{\\"answers\\":[{\\"id\\":\\"c1\\",\\"issueKey\\":\\"FIP-2201\\",\\"reason\\":\\"The branch \\\\\\"refactor/hub-query-v3\\\\\\" identifies hub query rewrite work.\\"}]}"}}',
  '{"type":"turn.completed","usage":{"input_tokens":6291,"cached_input_tokens":4864,"cache_write_input_tokens":0,"output_tokens":43,"reasoning_output_tokens":0}}',
].join('\n');

/** Captured from the same CLI: a reply that narrates first and answers in its last message. */
const CODEX_NARRATED = [
  '{"type":"thread.started","thread_id":"01a0e841-ca64-72d3-a97c-13151408f482"}',
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`."}}',
  '{"type":"turn.started"}',
  '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"I’ll inspect the available tools and attempt to read `./s.txt` directly."}}',
  '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"{\\"content\\":null,\\"tools\\":[\\"functions.exec\\",\\"functions.wait\\",\\"functions.request_user_input\\"]}"}}',
  '{"type":"turn.completed","usage":{"input_tokens":12014,"cached_input_tokens":9728,"cache_write_input_tokens":0,"output_tokens":343,"reasoning_output_tokens":265}}',
].join('\n');

/** Captured from the same CLI, asked for a model the account does not offer. */
const CODEX_FAILED = [
  '{"type":"thread.started","thread_id":"01a0e840-ccce-7c73-b678-c07767942e4e"}',
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `no-such-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}',
  '{"type":"turn.started"}',
  '{"type":"error","message":"{\\"type\\":\\"error\\",\\"status\\":400,\\"error\\":{\\"type\\":\\"invalid_request_error\\",\\"message\\":\\"The \'no-such-model\' model is not supported when using Codex with a ChatGPT account.\\"}}"}',
  '{"type":"turn.failed","error":{"message":"{\\"type\\":\\"error\\",\\"status\\":400,\\"error\\":{\\"type\\":\\"invalid_request_error\\",\\"message\\":\\"The \'no-such-model\' model is not supported when using Codex with a ChatGPT account.\\"}}"}}',
].join('\n');

type Answers = { answers: { id: string; issueKey: string | null; reason: string }[] };

const isAnswers = (value: unknown): value is Answers =>
  !!value && typeof value === 'object' && Array.isArray((value as Partial<Answers>).answers);

const isAnything = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

describe('reading a codex run', () => {
  it('reads the answer out of the event stream', () => {
    expect(agentOutputDocument({ stdout: CODEX_ANSWER, isValid: isAnswers, command: 'codex' }).answers).toEqual([
      {
        id: 'c1',
        issueKey: 'FIP-2201',
        reason: 'The branch "refactor/hub-query-v3" identifies hub query rewrite work.',
      },
    ]);
  });

  it('takes the last message, not the narration before it', () => {
    expect(agentOutputDocument({ stdout: CODEX_NARRATED, isValid: isAnything, command: 'codex' })).toEqual({
      content: null,
      tools: ['functions.exec', 'functions.wait', 'functions.request_user_input'],
    });
  });

  it('fails a run whose turn failed, with the reason codex gave', () => {
    expect(() => agentOutputDocument({ stdout: CODEX_FAILED, isValid: isAnything, command: 'codex' })).toThrow(
      /not supported when using Codex/,
    );
  });

  it('fails an answer of the wrong shape, so the caller retries', () => {
    expect(() => agentOutputDocument({ stdout: CODEX_NARRATED, isValid: isAnswers, command: 'codex' })).toThrow(
      'the agent returned an answer of the wrong shape',
    );
  });

  it("does not read a codex stream as Claude's envelope", () => {
    expect(() => agentOutputDocument({ stdout: CODEX_ANSWER, isValid: isAnswers })).toThrow();
  });
});
