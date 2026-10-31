import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { createInterface } from 'readline';
import { callsRootOf, DEFAULT_PORT, portOf, readConfig } from './paths';
import { buildStampOf } from './stamp';

export const MCP_USAGE = 'mcp';

export const MCP_PROTOCOL_VERSION = '2025-06-18';

type ToolInput = { name: string; flag?: string; description: string; required?: boolean; type?: 'string' | 'integer' };

/** What the server was started with: the workspace, and where `check` on a call writes its receipt. */
export type ToolContext = { target: string; receipt?: string };

type ToolSpec = {
  name: string;
  description: string;
  command: string[];
  positional?: ToolInput[];
  values?: ToolInput[];
  switches?: ToolInput[];
  extra?: (args: Record<string, unknown>, context: ToolContext) => string[];
  read?: (args: Record<string, string>, context: ToolContext) => ToolResult;
};

type ToolResult = { content: { type: 'text'; text: string }[]; isError: boolean };

export type ToolRun = { code: number; stdout: string; stderr: string };

export type ToolRunner = (argv: string[]) => Promise<ToolRun>;

const BY: ToolInput = {
  name: 'by',
  flag: '--by',
  description: 'The exact model id of the agent that writes, e.g. claude-opus-5-5.',
  required: true,
};

const PART: ToolInput = { name: 'part', description: 'The part, as <layer>/<name>.', required: true };

const PRODUCT: ToolInput = {
  name: 'product',
  flag: '--product',
  description: 'The product. Optional when the workspace has only one.',
};

const CALL: ToolInput = { name: 'call', flag: '--call', description: 'The call slug, e.g. studio/01-workbench.' };

const VARIANT: ToolInput = { name: 'variant', flag: '--variant', description: 'The variant key of the call.' };

const variantFileOf = (options: { target: string; call: string; variant: string }) =>
  resolve(callsRootOf(options.target), options.call, `variant-${options.variant}.ts`);

const frameBaseOf = (target: string) => {
  const config = readConfig(target);

  return process.env['DE_URL'] ?? `http://localhost:${config ? portOf(config) : DEFAULT_PORT}`;
};

const readCall = (args: Record<string, string>, context: ToolContext): ToolResult => {
  const call = args['call'] ?? '';
  const variant = args['variant'] ?? '';
  const dir = resolve(callsRootOf(context.target), call);
  const callFile = resolve(dir, 'call.ts');
  const fixtureFile = resolve(dir, 'fixture.ts');

  if (!existsSync(callFile)) return { content: [{ type: 'text', text: `${callFile} does not exist.` }], isError: true };

  const search = new URLSearchParams({ call, variant });

  return {
    content: [
      {
        type: 'text',
        text: [
          `The call: ${call}`,
          `The variant under study: ${variant}`,
          `The file you draw into: ${variantFileOf({ target: context.target, call, variant })}`,
          `Its frame: ${frameBaseOf(context.target)}/frame.html?${search}`,
          '',
          readFileSync(callFile, 'utf8'),
        ].join('\n'),
      },
      {
        type: 'text',
        text: existsSync(fixtureFile)
          ? `fixture.ts, the data every variant draws. Never change it:\n\n${readFileSync(fixtureFile, 'utf8')}`
          : `The call ${call} carries no fixture.ts.`,
      },
    ],
    isError: false,
  };
};

const callCheckArgvOf = (args: Record<string, unknown>, context: ToolContext) => {
  const call = args['call'];
  const variant = args['variant'];

  if (typeof call !== 'string' || call === '') return [];

  return [
    '--tsconfig',
    ...(typeof variant === 'string' && variant !== ''
      ? ['--lint', variantFileOf({ target: context.target, call, variant })]
      : []),
    ...(context.receipt ? ['--receipt', context.receipt] : []),
  ];
};

const SIZE: ToolInput[] = [
  { name: 'preset', flag: '--preset', description: 'A preset of the product, e.g. phone.' },
  { name: 'width', flag: '--width', description: 'A width in px instead of a preset.', type: 'integer' },
  { name: 'scale', flag: '--scale', description: 'The device scale, 1 to 4.', type: 'integer' },
  { name: 'surface', flag: '--surface', description: 'The surface theme to draw on.' },
  { name: 'color', flag: '--color', description: 'The colour theme to draw with.' },
  {
    name: 'scheme',
    flag: '--scheme',
    description: 'The colour scheme to draw in, light or dark; a surface theme alone does not switch it.',
  },
];

/** The tools of `et design mcp`: each runs the `et design` command of the same name. */
export const MCP_TOOLS: ToolSpec[] = [
  {
    name: 'parts',
    description: "List each product's parts as JSON: origin, note, states, widths, presets and problems.",
    command: ['system', '--json'],
  },
  {
    name: 'call',
    description:
      'Read a call before you draw a variant of it: call.ts, fixture.ts (the data every variant draws, never change ' +
      'it), the variant file you draw into and the URL of its frame.',
    command: [],
    values: [
      { ...CALL, required: true },
      { ...VARIANT, required: true },
    ],
    read: readCall,
  },
  {
    name: 'check',
    description:
      "Check a product's design system, or every product without one. With a call, lint its variant, type-check " +
      'the calls and render the call in a browser instead: run it after every edit of a variant. Exits with an ' +
      'error on findings.',
    command: ['check'],
    values: [CALL, VARIANT],
    extra: callCheckArgvOf,
  },
  {
    name: 'shot',
    description:
      'Draw the states of a part, the same way as the Studio screenshots, and return the contact sheet image.',
    command: ['shot'],
    positional: [PART],
    values: [
      { name: 'state', flag: '--state', description: 'The states to draw, a comma list. All states without it.' },
      { name: 'interaction', flag: '--interaction', description: 'An interaction to force, e.g. hover.' },
      ...SIZE,
    ],
    switches: [{ name: 'variants', flag: '--variants', description: "Draw every variant of the part's open sketch." }],
  },
  {
    name: 'motion_shots',
    description:
      'Draw a motion of a part at each keyframe time, in full and reduced motion. Returns the contact sheet image and the JSON of its tracks.',
    command: ['motion', 'shots'],
    positional: [PART, { name: 'motion', description: 'The motion name of the part.', required: true }],
    values: [
      { name: 'variant', flag: '--variant', description: 'A variant of the open sketch on the part.' },
      { name: 'mode', flag: '--mode', description: 'full or reduced. Both without it.' },
      ...SIZE,
    ],
  },
  {
    name: 'sketch_new',
    description: 'Open a sketch on a part, new or existing. Each variant starts as a copy of the part.',
    command: ['sketch', 'new'],
    positional: [PART],
    values: [
      { name: 'variants', flag: '--variants', description: 'The variant keys, a comma list: a,b.', required: true },
      { name: 'like', flag: '--like', description: 'Start each variant as a copy of this part instead.' },
      { name: 'round', flag: '--round', description: 'The title of the first round.' },
      { name: 'note', flag: '--note', description: 'What the sketch tries.' },
      BY,
    ],
  },
  {
    name: 'sketch_report',
    description: 'Tell Studio what you build on a variant now, e.g. "phone, outline state".',
    command: ['sketch', 'report'],
    positional: [PART, { name: 'text', description: 'What you build now.', required: true }],
    values: [{ name: 'variant', flag: '--variant', description: 'The variant key.', required: true }, BY],
  },
  {
    name: 'part_ready',
    description: 'Mark a part ready. It draws the part and refuses while the part has open points.',
    command: ['ready'],
    positional: [PART],
    values: [BY],
  },
  {
    name: 'part_go',
    description: 'Release a part for implementation at its current design. A design change after it needs a new go.',
    command: ['go'],
    positional: [PART],
    values: [BY],
  },
  {
    name: 'sketch_ready',
    description: 'Mark a sketch ready for the user to pick.',
    command: ['sketch', 'ready'],
    positional: [PART],
    values: [BY],
  },
  {
    name: 'sketch_merge',
    description: 'Merge the variant the user picked. Studio runs it on the click of the user.',
    command: ['sketch', 'merge'],
    positional: [PART],
    values: [{ name: 'note', flag: '--note', description: 'The reason, the note of the part.' }, BY],
  },
  {
    name: 'sketch_discard',
    description: 'Drop a sketch. Studio runs it on the click of the user.',
    command: ['sketch', 'discard'],
    positional: [PART],
    values: [BY],
  },
  {
    name: 'sketch_variant',
    description: 'Add a variant to the open sketch, as a copy of another, in the running round or a new one.',
    command: ['sketch', 'variant'],
    positional: [PART, { name: 'variant', description: 'The key of the new variant.', required: true }],
    values: [
      { name: 'from', flag: '--from', description: 'The variant to copy.', required: true },
      { name: 'round', flag: '--round', description: 'The title of a new round.' },
      { name: 'note', flag: '--note', description: 'Why the running round lost. Needed with round.' },
      BY,
    ],
  },
  {
    name: 'sketch_round',
    description: 'Set the title, note or dropped states of a round of the open sketch.',
    command: ['sketch', 'round'],
    positional: [PART, { name: 'round', description: 'The round to change.', required: true }],
    values: [
      { name: 'title', flag: '--title', description: 'The title of the round.' },
      { name: 'note', flag: '--note', description: 'The note of the round.' },
      { name: 'drops', flag: '--drops', description: 'The states the round drops on purpose, a comma list.' },
      BY,
    ],
  },
  {
    name: 'sketch_list',
    description: 'List the open sketches as JSON.',
    command: ['sketch', 'list', '--json'],
  },
  {
    name: 'sketch_check',
    description: 'Check each variant of a sketch laid over the product, or of every open sketch without a part.',
    command: ['sketch', 'check'],
    positional: [{ name: 'part', description: 'The part, as <layer>/<name>.' }],
  },
  {
    name: 'sketch_preview',
    description: 'List the elements and pages a merge of a variant changes.',
    command: ['sketch', 'preview'],
    positional: [PART, { name: 'variant', description: 'The variant key.', required: true }],
  },
  {
    name: 'sketch_rebase',
    description: 'After bringing each variant up to date with the product, record the product as it is now.',
    command: ['sketch', 'rebase'],
    positional: [PART],
    values: [BY],
  },
  {
    name: 'comment_reply',
    description: 'Answer a comment thread as the agent. A question waits for the answer of the user.',
    command: ['comment', 'reply'],
    positional: [
      { name: 'id', description: 'The comment id.', required: true },
      { name: 'text', description: 'The reply.', required: true },
    ],
    values: [BY],
    switches: [{ name: 'question', flag: '--question', description: 'Mark the reply as a question for the user.' }],
  },
  {
    name: 'inbox',
    description: 'List the comment threads and sketches that wait for the agent, then those that wait for the user.',
    command: ['inbox', '--json'],
  },
  {
    name: 'inbox_done',
    description: 'Set the note of the part a comment thread is about, then mark the thread addressed.',
    command: ['inbox', 'done'],
    positional: [{ name: 'id', description: 'The comment id.', required: true }],
    values: [{ name: 'note', flag: '--note', description: 'The new note of the part.', required: true }, BY],
  },
];

const inputsOf = (tool: ToolSpec) => [
  ...(tool.positional ?? []),
  ...(tool.values ?? []),
  ...(tool.switches ?? []).map((input) => ({ ...input, type: 'boolean' as const })),
  ...(tool.read ? [] : [PRODUCT]),
];

const inputSchemaOf = (tool: ToolSpec) => {
  const inputs = inputsOf(tool);

  return {
    type: 'object',
    properties: Object.fromEntries(
      inputs.map((input) => [input.name, { type: input.type ?? 'string', description: input.description }]),
    ),
    required: inputs.filter((input) => input.required).map((input) => input.name),
  };
};

/** The `et design` arguments a tool call runs, or why it cannot run. */
export const toolArgvOf = (options: {
  tool: ToolSpec;
  args: Record<string, unknown>;
  context: ToolContext;
}): string[] | string => {
  const { tool, args, context } = options;
  const missing = inputsOf(tool).filter((input) => input.required && (args[input.name] ?? '') === '');

  if (missing.length > 0) return `${tool.name} needs ${missing.map((input) => input.name).join(', ')}`;

  const valueOf = (input: ToolInput) => args[input.name];

  return [
    ...tool.command,
    ...(tool.positional ?? []).flatMap((input) => (valueOf(input) === undefined ? [] : [String(valueOf(input))])),
    ...[...(tool.values ?? []), PRODUCT].flatMap((input) =>
      valueOf(input) === undefined || valueOf(input) === '' ? [] : [input.flag ?? '', String(valueOf(input))],
    ),
    ...(tool.name === 'shot' ? ['--states'] : []),
    ...(tool.switches ?? []).flatMap((input) => (valueOf(input) === true ? [input.flag ?? ''] : [])),
    ...(tool.extra?.(args, context) ?? []),
  ];
};

const filesOf = (options: { target: string; stdout: string; extension: string }) =>
  options.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith(options.extension))
    .map((line) => (isAbsolute(line) ? line : resolve(options.target, line)))
    .filter((file) => existsSync(file));

const resultOf = (target: string, run: ToolRun) => ({
  content: [
    { type: 'text', text: [run.stdout.trim(), run.stderr.trim()].filter(Boolean).join('\n') || `exit ${run.code}` },
    ...filesOf({ target, stdout: run.stdout, extension: '.png' }).map((file) => ({
      type: 'image',
      data: readFileSync(file).toString('base64'),
      mimeType: 'image/png',
    })),
    ...filesOf({ target, stdout: run.stdout, extension: '.json' }).map((file) => ({
      type: 'text',
      text: readFileSync(file, 'utf8'),
    })),
  ],
  isError: run.code !== 0,
});

const stringArgsOf = (args: unknown) =>
  Object.fromEntries(
    Object.entries((args as Record<string, unknown> | undefined) ?? {}).map(([key, value]) => [key, String(value)]),
  );

type Request = { id?: unknown; method?: string; params?: Record<string, unknown> };

/** The answer to one JSON-RPC request of an MCP client; `null` for a notification. */
export const mcpAnswerOf = async (options: { target: string; request: Request; run: ToolRunner; receipt?: string }) => {
  const { target, request, run, receipt } = options;

  if (request.id === undefined || request.id === null) return null;

  const answer = (result: unknown) => ({ jsonrpc: '2.0', id: request.id, result });

  if (request.method === 'initialize') {
    const asked = request.params?.['protocolVersion'];

    return answer({
      protocolVersion: typeof asked === 'string' ? asked : MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'ethlete-design', version: buildStampOf().version },
    });
  }

  if (request.method === 'ping') return answer({});

  if (request.method === 'tools/list') {
    return answer({
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: inputSchemaOf(tool),
      })),
    });
  }

  if (request.method === 'tools/call') {
    const name = request.params?.['name'];
    const tool = MCP_TOOLS.find((candidate) => candidate.name === name);

    if (!tool) return { jsonrpc: '2.0', id: request.id, error: { code: -32602, message: `unknown tool "${name}"` } };

    const argv = toolArgvOf({
      tool,
      args: (request.params?.['arguments'] as Record<string, unknown> | undefined) ?? {},
      context: { target, receipt },
    });

    if (typeof argv === 'string') return answer({ content: [{ type: 'text', text: argv }], isError: true });

    if (tool.read) return answer(tool.read(stringArgsOf(request.params?.['arguments']), { target, receipt }));

    return answer(resultOf(target, await run(argv)));
  }

  return {
    jsonrpc: '2.0',
    id: request.id,
    error: { code: -32601, message: `${request.method} is not a method of this server` },
  };
};

/** Runs `et design <argv>` of this same CLI in the workspace, in its own process so its output stays off the protocol. */
export const cliRunnerOf =
  (target: string): ToolRunner =>
  (argv) =>
    new Promise((done) => {
      const child = spawn(process.execPath, [process.argv[1] ?? '', 'design', ...argv], {
        cwd: target,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.on('error', (error) => done({ code: 1, stdout: '', stderr: error.message }));
      child.on('close', (code) =>
        done({ code: code ?? 1, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() }),
      );
    });

/**
 * `et design mcp` serves the design tools to an MCP client over stdio. The workspace is the working directory;
 * each tool runs the `et design` command of the same name there. With `receipt`, `check` on a call writes its receipt
 * to that path.
 */
export const designMcp = (options: { target: string; run?: ToolRunner; receipt?: string }) => {
  const { target, receipt } = options;
  const run = options.run ?? cliRunnerOf(target);
  const lines = createInterface({ input: process.stdin });
  const pending = new Set<Promise<void>>();

  lines.on('line', (line) => {
    let request: Request;

    try {
      request = JSON.parse(line) as Request;
    } catch {
      return;
    }

    const answered = mcpAnswerOf({ target, request, run, receipt }).then((answer) => {
      if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
    });

    pending.add(answered);
    void answered.finally(() => pending.delete(answered));
  });

  return new Promise<number>((done) => lines.on('close', () => void Promise.all([...pending]).then(() => done(0))));
};
