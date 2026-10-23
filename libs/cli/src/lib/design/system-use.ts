import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { CALL_STAGES } from './new-call';
import { callsRootOf, DESIGN_DIR } from './paths';

const STAGES_ON_THE_SYSTEM = new Set(['element', 'page', 'prototype']);

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

/** Whether a variant of the call imports anything from its project's design system. */
export const drawsFromSystem = (options: { target: string; slug: string }) => {
  const { target, slug } = options;
  const project = slug.split('/')[0] ?? '';
  const system = resolve(target, DESIGN_DIR, 'system', project);
  const folder = resolve(callsRootOf(target), slug);

  if (!existsSync(folder)) return false;

  return readdirSync(folder)
    .filter((name) => /^variant-.*\.ts$/.test(name))
    .some((name) =>
      [...readFileSync(resolve(folder, name), 'utf8').matchAll(SPECIFIER)]
        .map((match) => match[1] ?? '')
        .filter((specifier) => specifier.startsWith('.'))
        .some((specifier) => {
          const inside = relative(system, resolve(dirname(resolve(folder, name)), specifier));

          return !inside.startsWith('..') && !isAbsolute(inside);
        }),
    );
};

/** The warning for a call whose stage builds on the design system but draws nothing from it. */
export const systemWarningOf = (options: { target: string; slug: string; stage: string | null }) => {
  const { target, slug, stage } = options;

  if (!stage || !STAGES_ON_THE_SYSTEM.has(stage) || drawsFromSystem({ target, slug })) return null;

  return (
    `WARNING ${slug} is a ${stage} call but no variant imports from ` +
    `${DESIGN_DIR}/system/${slug.split('/')[0]}/ - it draws no design-system entry, so its parts ` +
    `may not match the system.`
  );
};

/** The warning for an inventory on a call that is no wireframe call. */
export const inventoryWarningOf = (options: { slug: string; stage: string | null; hasInventory: boolean }) => {
  const { slug, stage, hasInventory } = options;

  if (!hasInventory || stage === 'wireframe') return null;

  return `WARNING ${slug} has an inventory, but only a wireframe call takes one.`;
};

/** The warning for a call that declares no stage and so sits outside the design process. */
export const stageWarningOf = (options: { slug: string; stage: string | null }) => {
  const { slug, stage } = options;

  if (stage) return null;

  return `WARNING ${slug} has no stage. Set one of ${CALL_STAGES.join(', ')}, so the call joins the design process.`;
};
