import { RenderIssue } from './render-check';

export const PATH_DEPTH = 4;

const tagOf = (name: string) => /^[a-z0-9-]+/u.exec(name)?.[0] ?? name;

const frameNeutralPathOf = ({ path, part, framed }: { path: string; part: string; framed: boolean }) => {
  const names = path.split(' > ');
  const marked = names.findIndex((name) => name.endsWith(`[data-et-part=${part}]`));
  const cut =
    marked < 0 ? (names.length === PATH_DEPTH ? [0] : []) : framed ? [marked - 1, marked] : [marked, marked + 1];

  return names.map((name, index) => (cut.includes(index) ? tagOf(name) : name)).join(' > ');
};

export const isControlInput = (issue: RenderIssue) => issue.rule === 'CONTROL-PART-INPUT';

const isDetailFree = (issue: RenderIssue) => isControlInput(issue) || issue.rule === 'OVERFLOW';

/**
 * The identity two render issues share when they are the same issue: product, part, rule, detail and
 * element path. An overflow matches without its detail, which holds pixel sizes. `inFrame` names whether the
 * drawing had the part's demo frame, so a path compares across the demo frame move; `null` keeps the path as
 * drawn.
 */
export const sameRenderIssueKeyOf = (issue: RenderIssue, inFrame: boolean | null) =>
  JSON.stringify([
    issue.product,
    issue.part,
    issue.rule,
    isDetailFree(issue) ? null : issue.detail,
    inFrame === null ? issue.path : frameNeutralPathOf({ path: issue.path, part: issue.part, framed: inFrame }),
  ]);
