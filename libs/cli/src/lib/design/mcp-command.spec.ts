import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
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
      'call',
      'check',
      'shot',
      'motion_shots',
      'sketch_new',
      'sketch_report',
      'part_ready',
      'sketch_ready',
      'sketch_merge',
      'sketch_discard',
      'sketch_variant',
      'sketch_round',
      'sketch_list',
      'sketch_check',
      'sketch_preview',
      'sketch_rebase',
      'comment_reply',
      'inbox',
      'inbox_done',
    ]);
    expect(tools['call']).toEqual(['call', 'variant']);
    expect(tools['motion_shots']).toEqual(['part', 'motion']);
    expect(tools['sketch_ready']).toEqual(['part', 'by']);
    expect(tools['part_ready']).toEqual(['part', 'by']);
    expect(tools['sketch_variant']).toEqual(['part', 'variant', 'from', 'by']);
    expect(tools['comment_reply']).toEqual(['id', 'text', 'by']);
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

  it('reads a call: its source, its fixture, the variant file and the frame URL, without running a command', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-mcp-call-'));
    const dir = join(target, '.ethlete/design/calls/app/one');
    const run = vi.fn<ToolRunner>();

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'call.ts'), 'export default { headline: "One" };\n');
    vi.stubEnv('DE_URL', 'http://localhost:4999');

    const bare = await call({ target, run, name: 'call', args: { call: 'app/one', variant: 'b' } });

    writeFileSync(join(dir, 'fixture.ts'), 'export const rows = [1, 2];\n');

    const full = await call({ target, run, name: 'call', args: { call: 'app/one', variant: 'b' } });
    const gone = await call({ target, run, name: 'call', args: { call: 'app/two', variant: 'a' } });

    vi.unstubAllEnvs();

    expect(run).not.toHaveBeenCalled();
    expect(full.result.isError).toBe(false);
    expect(full.result.content[0]?.text).toContain(`The file you draw into: ${join(dir, 'variant-b.ts')}`);
    expect(full.result.content[0]?.text).toContain(
      'Its frame: http://localhost:4999/frame.html?call=app%2Fone&variant=b',
    );
    expect(full.result.content[0]?.text).toContain('headline: "One"');
    expect(full.result.content[1]?.text).toContain('export const rows = [1, 2];');
    expect(bare.result.content[1]?.text).toBe('The call app/one carries no fixture.ts.');
    expect(gone.result.isError).toBe(true);
  });

  it('checks a call: lints its variant, types the calls and writes the receipt the server was given', async () => {
    const run = vi.fn<ToolRunner>(async () => ({ code: 0, stdout: 'ok', stderr: '' }));

    await mcpAnswerOf({
      target: '/w',
      run,
      receipt: '/tmp/r.json',
      request: { id: 1, method: 'tools/call', params: { name: 'check', arguments: { call: 'app/one', variant: 'b' } } },
    });
    await mcpAnswerOf({ target: '/w', run, request: { id: 2, method: 'tools/call', params: { name: 'check' } } });

    expect(run.mock.calls.map(([argv]) => argv)).toEqual([
      [
        'check',
        '--call',
        'app/one',
        '--variant',
        'b',
        '--tsconfig',
        '--lint',
        '/w/.ethlete/design/calls/app/one/variant-b.ts',
        '--receipt',
        '/tmp/r.json',
      ],
      ['check'],
    ]);
  });

  it('maps the sketch and comment tools onto their commands and arguments', async () => {
    const run = vi.fn<ToolRunner>(async () => ({ code: 0, stdout: 'ok', stderr: '' }));
    const argvOf = async (name: string, args: Record<string, unknown>) => {
      run.mockClear();
      await call({ target: '/w', run, name, args });

      return run.mock.calls[0]?.[0];
    };

    expect(await argvOf('sketch_variant', { part: 'elements/hero', variant: 'c', from: 'a', by: 'm' })).toEqual([
      'sketch',
      'variant',
      'elements/hero',
      'c',
      '--from',
      'a',
      '--by',
      'm',
    ]);
    expect(
      await argvOf('sketch_round', { part: 'elements/hero', round: '2', title: 'T', drops: 'x,y', by: 'm' }),
    ).toEqual(['sketch', 'round', 'elements/hero', '2', '--title', 'T', '--drops', 'x,y', '--by', 'm']);
    expect(await argvOf('sketch_list', {})).toEqual(['sketch', 'list', '--json']);
    expect(await argvOf('sketch_check', { part: 'elements/hero' })).toEqual(['sketch', 'check', 'elements/hero']);
    expect(await argvOf('sketch_check', {})).toEqual(['sketch', 'check']);
    expect(await argvOf('sketch_preview', { part: 'elements/hero', variant: 'a' })).toEqual([
      'sketch',
      'preview',
      'elements/hero',
      'a',
    ]);
    expect(await argvOf('sketch_rebase', { part: 'elements/hero', by: 'm' })).toEqual([
      'sketch',
      'rebase',
      'elements/hero',
      '--by',
      'm',
    ]);
    expect(await argvOf('comment_reply', { id: 'c1', text: 'hi', by: 'm', question: true })).toEqual([
      'comment',
      'reply',
      'c1',
      'hi',
      '--by',
      'm',
      '--question',
    ]);
  });

  it('reaches the real sketch list, check and variant commands', async () => {
    const target = acme();
    const run = inProcessRunner(target);

    await call({
      target,
      run,
      name: 'sketch_new',
      args: { part: 'elements/hero', variants: 'a,b', by: 'm', product: 'acme' },
    });

    const variant = await call({
      target,
      run,
      name: 'sketch_variant',
      args: { part: 'elements/hero', variant: 'c', from: 'a', by: 'm', product: 'acme' },
    });
    const list = await call({ target, run, name: 'sketch_list', args: {} });

    expect(variant.result.isError).toBe(false);
    expect(list.result.content[0]?.text).toContain('"c"');
  });
});
