import { buildBanner, replaceMarkedBlock } from '../render';
import { body, document, EmitContext, EmittedFile, neutralBodyPath, neutralLinks, pointerTable } from './shared';

export const CODEX_FILE = 'AGENTS.md';

/**
 * `AGENTS.md` supports neither frontmatter nor includes, so the always-loaded rules are inlined and
 * the on-demand skills become a manifest of paths into `.agents/ethlete/` (emitted separately by the
 * neutral target). Everything outside the marker block is left as the repo wrote it.
 */
export const emitCodex = (options: { context: EmitContext; existing: string }): EmittedFile[] => {
  const { context, existing } = options;
  const sections = context.rules.map((item) => body({ item, context, links: neutralLinks(context) }));

  if (context.skills.length > 0) {
    sections.push(
      [
        '## Ethlete reference docs',
        'Read the matching file before starting that kind of work — do not work from memory.',
        pointerTable({ skills: context.skills, context, pathFor: neutralBodyPath }),
      ].join('\n\n'),
    );
  }

  const block = document([buildBanner(context.version), ...sections]).trimEnd();

  return [{ path: CODEX_FILE, contents: replaceMarkedBlock({ existing, block }) }];
};
