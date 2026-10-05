import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

type RunHookOptions = {
  model: string;
  prompt?: string;
  sessionId?: string;
  threadId?: string;
  threadSource?: 'subagent' | 'user';
  tokens: number;
  window: number;
};

const hookPath = resolve(__dirname, '../../content/hooks/context-warning.py');

const runHook = (options: RunHookOptions) => {
  const {
    model,
    prompt,
    sessionId = randomUUID(),
    threadId = randomUUID(),
    threadSource = 'user',
    tokens,
    window,
  } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-context-warning-'));
  const transcriptPath = join(root, 'rollout.jsonl');
  const transcript = [
    {
      type: 'session_meta',
      payload: {
        id: threadId,
        session_id: sessionId,
        thread_source: threadSource,
        ...(threadSource === 'subagent'
          ? { source: { subagent: { thread_spawn: { parent_thread_id: sessionId } } } }
          : { source: 'cli' }),
      },
    },
    { payload: { model } },
    { payload: { last_token_usage: { total_tokens: tokens }, model_context_window: window } },
  ];

  writeFileSync(transcriptPath, transcript.map((entry) => JSON.stringify(entry)).join('\n'), 'utf8');

  return execFileSync('python3', [hookPath, '--agent', 'codex'], {
    encoding: 'utf8',
    input: JSON.stringify({ cwd: root, prompt, session_id: sessionId, transcript_path: transcriptPath }),
  });
};

type RunClaudeHookOptions = {
  agentId?: string;
  event?: string;
  model?: string;
  permissionMode?: string;
  prompt?: string;
  sessionId?: string;
  tokens: number;
  turn?: object[];
  withTranscript?: boolean;
};

const runClaudeHook = (options: RunClaudeHookOptions) => {
  const {
    agentId,
    event,
    model = 'claude-opus-5',
    permissionMode = 'auto',
    prompt,
    sessionId = randomUUID(),
    tokens,
    turn = [],
    withTranscript = true,
  } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-context-warning-'));
  const transcriptPath = join(root, 'transcript.jsonl');

  if (withTranscript) {
    writeFileSync(
      transcriptPath,
      [...turn, { type: 'assistant', message: { model, usage: { input_tokens: tokens } } }]
        .map((entry) => `${JSON.stringify(entry)}\n`)
        .join(''),
      'utf8',
    );
  }

  const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    input: JSON.stringify({
      cwd: root,
      ...(agentId ? { agent_id: agentId } : {}),
      ...(event ? { hook_event_name: event } : {}),
      permission_mode: permissionMode,
      ...(prompt ? { prompt } : {}),
      session_id: sessionId,
      transcript_path: transcriptPath,
    }),
  });

  return output ? (JSON.parse(output) as ClaudeHookOutput) : null;
};

type ClaudeHookOutput = {
  hookSpecificOutput: { additionalContext: string; hookEventName: string };
  systemMessage?: string;
};

describe('context-warning Codex limits', () => {
  it.each(['gpt-5.6-sol', 'gpt-5.5', 'gpt-5.4'])('uses the 272k pricing boundary for %s', (model) => {
    const output = runHook({ model, tokens: 200_000, window: 1_050_000 });

    expect(output).toContain('272k long-context pricing boundary');
  });

  it('uses the reported window for GPT-5.4 mini', () => {
    const output = runHook({ model: 'gpt-5.4-mini', tokens: 200_000, window: 400_000 });

    expect(output).toBe('');
  });

  it('identifies sub-agent pressure without telling the main agent to hand off', () => {
    const output = runHook({
      model: 'gpt-5.6-sol',
      threadSource: 'subagent',
      tokens: 240_000,
      window: 1_050_000,
    });

    expect(output).toContain('This warning applies to a sub-agent thread, not the parent/main agent');
    expect(output).toContain('send the parent agent detailed findings');
    expect(output).toContain(
      "Do not create a user-facing session handoff or claim that the main agent's context is full",
    );
    expect(output).not.toContain('Tell the user:');
  });

  it('tracks warning tiers independently for root and sub-agent threads in one session', () => {
    const sessionId = randomUUID();
    const subagentOutput = runHook({
      model: 'gpt-5.6-sol',
      sessionId,
      threadId: randomUUID(),
      threadSource: 'subagent',
      tokens: 240_000,
      window: 1_050_000,
    });
    const rootOutput = runHook({
      model: 'gpt-5.6-sol',
      sessionId,
      threadId: randomUUID(),
      tokens: 240_000,
      window: 1_050_000,
    });

    expect(subagentOutput).not.toBe('');
    expect(rootOutput).toContain('Tell the user:');
  });
});

describe('context-warning handoff mode', () => {
  it('turns handoff mode on at the warn tier and says how to work under it', () => {
    const output = runClaudeHook({ tokens: 150_000 });

    expect(output?.hookSpecificOutput.additionalContext).toContain('Handoff mode is active from here on');
    expect(output?.hookSpecificOutput.additionalContext).toContain('~50k tokens left');
    expect(output?.systemMessage).toContain('🟡');
  });

  it('offers the finish-first choice at the critical tier in auto mode', () => {
    const context = runClaudeHook({ tokens: 175_000 })?.hookSpecificOutput.additionalContext ?? '';

    expect(context).toContain('Choose one of two');
    expect(context).toContain('If you can name every step that is left');
    expect(context).toContain('"Nearly done" means you can name the last steps now');
  });

  it('offers the same choice at the critical tier without auto mode', () => {
    const context =
      runClaudeHook({ permissionMode: 'default', tokens: 175_000 })?.hookSpecificOutput.additionalContext ?? '';

    expect(context).toContain('Choose one of two');
    expect(context).toContain('recommend the user run /');
  });

  it('takes the choice away at the final tier', () => {
    const context = runClaudeHook({ tokens: 195_000 })?.hookSpecificOutput.additionalContext ?? '';

    expect(context).toContain('The finish-first choice from the last warning is gone');
    expect(context).not.toContain('Choose one of two');
  });

  it('repeats a short reminder on every later prompt, without warning the user again', () => {
    const sessionId = randomUUID();

    runClaudeHook({ sessionId, tokens: 150_000 });
    const held = runClaudeHook({ sessionId, tokens: 155_000 });

    expect(held?.systemMessage).toBeUndefined();
    expect(held?.hookSpecificOutput.additionalContext).toContain('Handoff mode is active: ~45k tokens left');
    expect(held?.hookSpecificOutput.additionalContext).not.toContain('You were already told to hand off');
  });

  it('adds a stop instruction to the reminder once a handoff was already asked for', () => {
    const sessionId = randomUUID();

    runClaudeHook({ sessionId, tokens: 175_000 });
    const held = runClaudeHook({ sessionId, tokens: 176_000 });

    expect(held?.hookSpecificOutput.additionalContext).toContain('You were already told to hand off');
  });

  it('stays silent below the warn tier', () => {
    expect(runClaudeHook({ tokens: 100_000 })).toBeNull();
  });

  it('reminds a sub-agent about its own budget, not a session handoff', () => {
    const sessionId = randomUUID();
    const threadId = randomUUID();
    const options = { model: 'gpt-5.6-sol', sessionId, threadId, threadSource: 'subagent', window: 1_050_000 } as const;

    runHook({ ...options, tokens: 200_000 });
    const held = runHook({ ...options, tokens: 205_000 });

    expect(held).toContain('Handoff mode is active for this sub-agent thread, not the parent/main agent');
    expect(held).toContain('Do not create a user-facing session handoff.');
  });
});

describe('context-warning mid-run delivery', () => {
  it('states the budget at session start, before a transcript exists', () => {
    const context =
      runClaudeHook({ event: 'SessionStart', tokens: 0, withTranscript: false })?.hookSpecificOutput
        .additionalContext ?? '';

    expect(context).toContain('Context budget for this session: 200k tokens');
    expect(context).toContain('You will be warned at 70%, 85% and 95%');
  });

  it('names the window at session start once the model is known', () => {
    const context = runClaudeHook({ event: 'SessionStart', tokens: 1_000 })?.hookSpecificOutput.additionalContext ?? '';

    expect(context).toContain("long-context pricing boundary of this model's 1M window");
  });

  it('warns on a tool batch, so a run with no user prompt still learns its token count', () => {
    const output = runClaudeHook({ event: 'PostToolBatch', tokens: 150_000 });

    expect(output?.hookSpecificOutput.hookEventName).toBe('PostToolBatch');
    expect(output?.hookSpecificOutput.additionalContext).toContain('Handoff mode is active from here on');
  });

  it('warns once per tier on tool batches, not on every batch', () => {
    const sessionId = randomUUID();

    runClaudeHook({ event: 'PostToolBatch', sessionId, tokens: 150_000 });

    expect(runClaudeHook({ event: 'PostToolBatch', sessionId, tokens: 155_000 })).toBeNull();
  });

  it('stays silent on a tool batch inside a sub-agent, whose tokens it cannot read', () => {
    expect(runClaudeHook({ agentId: 'agent-1', event: 'PostToolBatch', tokens: 195_000 })).toBeNull();
  });
});

describe('context-warning end of turn', () => {
  it('lets a turn end below the critical tier', () => {
    expect(runClaudeHook({ event: 'Stop', tokens: 150_000 })).toBeNull();
  });

  it('demands a named choice of three when a turn ends over the critical tier', () => {
    const output = runClaudeHook({ event: 'Stop', tokens: 175_000 });
    const context = output?.hookSpecificOutput.additionalContext ?? '';

    expect(output?.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(context).toContain('Do not end the turn without taking one of these');
    expect(context).toContain('1. Finish the task now');
    expect(context).toContain('2. Hand off');
    expect(context).toContain('3. Cross the boundary on purpose');
  });

  it('withdraws the finish option at the final tier but keeps the deliberate crossing', () => {
    const context = runClaudeHook({ event: 'Stop', tokens: 195_000 })?.hookSpecificOutput.additionalContext ?? '';

    expect(context).toContain('The finish-first option is withdrawn at this tier');
    expect(context).not.toContain('Finish the task now');
    expect(context).toContain('2. Cross the boundary on purpose');
  });

  it('demands the choice once per tier, so a turn can still end', () => {
    const sessionId = randomUUID();

    runClaudeHook({ event: 'Stop', sessionId, tokens: 175_000 });

    expect(runClaudeHook({ event: 'Stop', sessionId, tokens: 176_000 })).toBeNull();
  });

  it('demands the choice again once the next tier is crossed', () => {
    const sessionId = randomUUID();

    runClaudeHook({ event: 'Stop', sessionId, tokens: 175_000 });

    expect(runClaudeHook({ event: 'Stop', sessionId, tokens: 195_000 })).not.toBeNull();
  });

  it('still demands a choice at the end of a turn that a tool batch already warned about', () => {
    const sessionId = randomUUID();

    runClaudeHook({ event: 'PostToolBatch', permissionMode: 'default', sessionId, tokens: 175_000 });

    expect(runClaudeHook({ event: 'Stop', permissionMode: 'default', sessionId, tokens: 176_000 })).not.toBeNull();
  });
});

const humanPrompt = (content: string) => ({
  type: 'user',
  origin: { kind: 'human' },
  message: { role: 'user', content },
});
const toolUse = (name: string, input: object) => ({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name, input }] },
});
const slashCommand = (args: string) =>
  humanPrompt(
    `<command-message>handoff</command-message>\n<command-name>/handoff</command-name>\n<command-args>${args}</command-args>`,
  );

describe('context-warning during a handoff', () => {
  it('stays silent on the prompt and at the end of a turn that requested a handoff', () => {
    const sessionId = randomUUID();

    expect(
      runClaudeHook({ event: 'UserPromptSubmit', prompt: '/handoff my-task', sessionId, tokens: 175_000 }),
    ).toBeNull();
    expect(runClaudeHook({ event: 'PostToolBatch', sessionId, tokens: 176_000 })).toBeNull();
    expect(runClaudeHook({ event: 'Stop', sessionId, tokens: 195_000 })).toBeNull();
  });

  it('re-arms on the next prompt', () => {
    const sessionId = randomUUID();
    const permissionMode = 'default';

    runClaudeHook({ event: 'UserPromptSubmit', prompt: '/handoff', permissionMode, sessionId, tokens: 175_000 });
    runClaudeHook({ event: 'UserPromptSubmit', prompt: 'next task', permissionMode, sessionId, tokens: 176_000 });

    expect(runClaudeHook({ event: 'Stop', permissionMode, sessionId, tokens: 177_000 })).not.toBeNull();
  });

  it('keeps warning a session that resumes from a handoff', () => {
    const sessionId = randomUUID();
    const permissionMode = 'default';

    expect(
      runClaudeHook({
        event: 'UserPromptSubmit',
        prompt: '/handoff resume my-task',
        permissionMode,
        sessionId,
        tokens: 175_000,
      }),
    ).not.toBeNull();
    expect(
      runClaudeHook({
        event: 'Stop',
        permissionMode,
        sessionId,
        tokens: 176_000,
        turn: [slashCommand('resume my-task')],
      }),
    ).not.toBeNull();
  });

  it('reads the handoff request from the transcript', () => {
    expect(runClaudeHook({ event: 'Stop', tokens: 175_000, turn: [slashCommand('my-task')] })).toBeNull();
  });

  it('stays silent for the rest of a turn that invoked the skill or wrote a handoff file', () => {
    const skill = toolUse('Skill', { skill: 'handoff', args: 'my-task' });
    const write = toolUse('Write', { file_path: '/repo/.claude/handoffs/my-task.md', content: '' });

    expect(runClaudeHook({ event: 'Stop', tokens: 175_000, turn: [humanPrompt('fix it'), skill] })).toBeNull();
    expect(runClaudeHook({ event: 'Stop', tokens: 175_000, turn: [humanPrompt('fix it'), write] })).toBeNull();
    expect(
      runClaudeHook({ event: 'Stop', tokens: 175_000, turn: [humanPrompt('fix it'), write, humanPrompt('go on')] }),
    ).not.toBeNull();
  });

  it('stays silent at the end of a turn whose auto-mode save it ordered', () => {
    const sessionId = randomUUID();

    expect(runClaudeHook({ event: 'PostToolBatch', sessionId, tokens: 175_000 })?.systemMessage).toContain(
      'saving a handoff',
    );
    expect(runClaudeHook({ event: 'Stop', sessionId, tokens: 195_000 })).toBeNull();
  });

  it('stays silent on a Codex handoff prompt', () => {
    const options = { model: 'gpt-5.6-sol', tokens: 240_000, window: 1_050_000 } as const;

    expect(runHook({ ...options, prompt: 'handoff my-task' })).toBe('');
    expect(runHook({ ...options, prompt: 'handoff resume my-task' })).toContain('Tell the user:');
  });
});
