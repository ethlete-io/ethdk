import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { designCommand } from './design-command';
import { mcpAnswerOf, ToolRunner } from './mcp-command';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-mcp-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  return target;
};

const inProcessRunner =
  (target: string): ToolRunner =>
  async (argv) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((line: unknown) => void stdout.push(String(line)));
    const error = vi.spyOn(console, 'error').mockImplementation((line: unknown) => void stderr.push(String(line)));

    try {
      const code = await designCommand({ root: target, argv, invocation: 'et design' });

      return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  };

const call = (options: { target: string; run: ToolRunner; name: string; args: Record<string, unknown> }) =>
  mcpAnswerOf({
    target: options.target,
    run: options.run,
    request: { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: options.name, arguments: options.args } },
  } as never) as Promise<{ result: { content: { type: string; text?: string; data?: string }[]; isError: boolean } }>;

describe('et design mcp', () => {
  it('answers initialize in the protocol the client asked for, and no notification', async () => {
    const run = vi.fn<ToolRunner>();

    expect(
      await mcpAnswerOf({
        target: '/w',
        run,
        request: { id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      }),
    ).toMatchObject({ id: 1, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } } });
    expect(await mcpAnswerOf({ target: '/w', run, request: { method: 'notifications/initialized' } })).toBeNull();
    expect(await mcpAnswerOf({ target: '/w', run, request: { id: 2, method: 'nope' } })).toMatchObject({
      error: { code: -32601 },
    });
  });

  it('lists one tool per core operation, each with its required inputs', async () => {
    const answer = (await mcpAnswerOf({ target: '/w', run: vi.fn(), request: { id: 1, method: 'tools/list' } })) as {
      result: { tools: { name: string; inputSchema: { required: string[] } }[] };
    };
    const tools = Object.fromEntries(answer.result.tools.map((tool) => [tool.name, tool.inputSchema.required]));

    expect(Object.keys(tools)).toEqual([
      'parts',
      'check',
      'shot',
      'motion_shots',
      'sketch_new',
      'sketch_report',
      'sketch_ready',
      'sketch_merge',
      'sketch_discard',
      'inbox',
      'inbox_done',
    ]);
    expect(tools['motion_shots']).toEqual(['part', 'motion']);
    expect(tools['sketch_ready']).toEqual(['part', 'by']);
  });

  it('refuses a call without a required input and runs nothing', async () => {
    const run = vi.fn<ToolRunner>();
    const answer = await call({ target: '/w', run, name: 'sketch_ready', args: { part: 'components/button' } });

    expect(answer.result).toEqual({ content: [{ type: 'text', text: 'sketch_ready needs by' }], isError: true });
    expect(run).not.toHaveBeenCalled();
  });

  it('returns the shot as an image, from the path the command prints', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-mcp-shot-'));
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    writeFileSync(join(target, 'sheet.png'), png);

    const run = vi.fn<ToolRunner>(async () => ({ code: 0, stdout: `${join(target, 'sheet.png')}\n`, stderr: '' }));
    const answer = await call({
      target,
      run,
      name: 'shot',
      args: { part: 'components/button', state: 'hover', preset: 'phone', color: 'brand', product: 'acme' },
    });

    expect(run).toHaveBeenCalledWith([
      'shot',
      'components/button',
      '--state',
      'hover',
      '--preset',
      'phone',
      '--color',
      'brand',
      '--product',
      'acme',
      '--states',
    ]);
    expect(answer.result.isError).toBe(false);
    expect(answer.result.content[1]).toEqual({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
  });

  it('returns the motion sheet image and its JSON', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-mcp-motion-'));
    const report = '{ "motion": "open" }\n';

    writeFileSync(join(target, 'm.png'), Buffer.from([1, 2, 3]));
    writeFileSync(join(target, 'm.json'), report);

    const run = vi.fn<ToolRunner>(async () => ({
      code: 0,
      stdout: 'm.png\nm.json\nfull: ends at 200 ms, 1 track, keyframes at 0, 50, 100, 150, 200 ms\n',
      stderr: '',
    }));
    const answer = await call({
      target,
      run,
      name: 'motion_shots',
      args: { part: 'elements/panel', motion: 'open', mode: 'full' },
    });

    expect(run).toHaveBeenCalledWith(['motion', 'shots', 'elements/panel', 'open', '--mode', 'full']);
    expect(answer.result.content.map((item) => item.type)).toEqual(['text', 'image', 'text']);
    expect(answer.result.content[2]?.text).toBe(report);
  });

  it('runs the real commands: opens and discards a sketch, and reads the inbox as JSON', async () => {
    const target = acme();
    const run = inProcessRunner(target);
    const opened = await call({
      target,
      run,
      name: 'sketch_new',
      args: { part: 'elements/hero', variants: 'a,b', by: 'claude-opus-5-5', product: 'acme' },
    });

    expect(opened.result.isError).toBe(false);

    const failed = await call({ target, run, name: 'sketch_discard', args: { part: 'components/nope', by: 'x' } });

    expect(failed.result.isError).toBe(true);

    const discarded = await call({
      target,
      run,
      name: 'sketch_discard',
      args: { part: 'elements/hero', by: 'claude-opus-5-5' },
    });

    expect(discarded.result.isError).toBe(false);

    const inbox = await call({ target, run, name: 'inbox', args: {} });

    expect(inbox.result.isError).toBe(false);
    expect(JSON.parse(inbox.result.content[0]?.text ?? '')).toEqual({ items: [], waitingForUser: [] });
  });
});
