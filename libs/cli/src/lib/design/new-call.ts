import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { callsRootOf, readConfig } from './paths';
import { writeStatus } from './status';

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

/** The values of `CallStage` in `design/define-call.ts`; a spec keeps the two lists equal. */
export const CALL_STAGES = ['themes', 'ci', 'wireframe', 'component', 'element', 'page', 'prototype'];
const KEY = /^[a-z][a-z0-9-]*$/;

const titled = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1).replace(/-/g, ' ')}`;

const callFile = (options: { slug: string; keys: string[]; stage: string | null }) => {
  const { slug, keys, stage } = options;
  const variants = keys
    .map(
      (key) =>
        `    {\n      key: '${key}',\n      name: 'Variant ${key}',\n      claim: 'What this variant argues.',\n` +
        `      cost: 'What it costs.',\n      load: () => import('./variant-${key}'),\n    },`,
    )
    .join('\n');
  const eyebrow = `${titled(slug.split('/')[0] ?? '')} · ${stage ? titled(stage) : 'Call'}`;

  return `import { defineCall } from '@design-explore';

export default defineCall({
${stage ? `  stage: '${stage}',\n` : ''}  eyebrow: '${eyebrow}',
  headline: 'The open question, in one sentence',
  intro: 'What the call is about, and what the variants share.',
  frameWidth: 720,
  variants: [
${variants}
  ],
});
`;
};

const FIXTURE_FILE = `export const FIXTURE = {
  title: 'The data every variant shares',
};
`;

const PLACEHOLDER_STYLES = `  styles: css\`
    .placeholder {
      margin: 0;
      padding: 24px;
      font-family: system-ui, sans-serif;
    }
  \`,`;

const variantFile = (key: string) => `import { css, drawing, html } from '@design-explore';
import { FIXTURE } from './fixture';

export default drawing({
  body: html\`<p class="placeholder">\${FIXTURE.title} · variant ${key}</p>\`,
${PLACEHOLDER_STYLES}
});
`;

const ngVariantFile = (key: string) => `import { css, drawing, html, ng } from '@design-explore';
import { FIXTURE } from './fixture';

const button = await ng(html\`<button et-button type="button">\${FIXTURE.title} · variant ${key}</button>\`, {
  imports: ['BUTTON_IMPORTS'],
});

export default drawing({
  body: html\`<div class="placeholder">\${button}</div>\`,
${PLACEHOLDER_STYLES}
});
`;

/**
 * Writes a call that renders at once: `call.ts`, a shared `fixture.ts` and one drawing per variant
 * key. Refuses a slug whose folder exists, so it never overwrites a drawing.
 */
export const newCall = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const slug = argv.find(
    (argument, index) => !argument.startsWith('--') && !['--variants', '--stage'].includes(argv[index - 1] ?? ''),
  );
  const listed = argv[argv.indexOf('--variants') + 1];
  const stage = argv.includes('--stage') ? (argv[argv.indexOf('--stage') + 1] ?? '') : null;
  const keys = argv.includes('--variants') ? (listed ?? '').split(',').filter(Boolean) : ['a', 'b'];

  if (!slug) {
    console.error(`usage: ${invocation} new <project>/<group>/<name> [--variants a,b] [--stage <stage>]`);

    return 2;
  }

  const segments = slug.split('/');

  if (segments.length < 2 || !segments.every((segment) => SEGMENT.test(segment))) {
    console.error(
      `BAD SLUG "${slug}" - use lowercase segments joined by "/", led by the project, e.g. app/checkout/01-summary.`,
    );

    return 2;
  }

  if (keys.length === 0 || !keys.every((key) => KEY.test(key)) || new Set(keys).size !== keys.length) {
    console.error(`BAD VARIANTS "${listed ?? ''}" - give distinct lowercase keys, e.g. --variants a,b,c.`);

    return 2;
  }

  if (stage !== null && !CALL_STAGES.includes(stage)) {
    console.error(`BAD STAGE "${stage}" - use one of ${CALL_STAGES.join(', ')}.`);

    return 2;
  }

  const folder = join(callsRootOf(target), ...segments);
  const project = segments[0] as string;
  const projects = readConfig(target)?.projects ?? {};
  const rendersComponents = Boolean(projects[project]?.providers);

  if (existsSync(folder)) {
    console.error(`CALL EXISTS - ${relative(target, folder)} is already there. Pick another slug.`);

    return 1;
  }

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'call.ts'), callFile({ slug, keys, stage }));
  writeFileSync(join(folder, 'fixture.ts'), FIXTURE_FILE);

  for (const key of keys) {
    writeFileSync(join(folder, `variant-${key}.ts`), rendersComponents ? ngVariantFile(key) : variantFile(key));
  }

  writeStatus({ checkout: target, slug, state: 'scaffolded' });

  if (!(project in projects)) {
    console.warn(
      `note: config.json names no project "${project}", so its drawings get no styles and no \`providers\`, ` +
        'and the variants draw plain html instead of real components through ng().',
    );
  } else if (!rendersComponents) {
    console.warn(
      `note: project "${project}" sets no \`providers\` in config.json, so the variants draw plain html. ` +
        'Name a providers module to render real components through ng().',
    );
  }

  console.log(
    [
      `wrote ${relative(target, folder)}: call.ts, fixture.ts, ${keys.map((key) => `variant-${key}.ts`).join(', ')}`,
      `next: ${invocation} check --call ${slug}`,
    ].join('\n'),
  );

  return 0;
};
