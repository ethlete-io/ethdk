import { Problem } from './problem';
import { ResolvedProduct } from './resolve-product';

export type BlockerKind =
  'stale-record' | 'open-point' | 'action' | 'embedded' | 'problem' | 'compare' | 'sdk-error' | 'pending';

/** One reason a part is not build-ready; `part` names the embedded part it comes from, if any. */
export type Blocker = { kind: BlockerKind; text: string; part?: string };

/** Whether a part may be built now, or every blocker that keeps it from that. */
export type BuildReady = { ready: true } | { ready: false; blockers: Blocker[] };

/** The slow-rule problems of a part from the last slow run, or `'pending'` while that result is missing or stale. */
export type SlowProblemsOf = (options: { product: ResolvedProduct; part: string }) => Problem[] | 'pending';

/** The rule of a slow problem from `design compare`; it blocks as `compare`. */
export const COMPARE_RULE = 'COMPARE';

/** The rule of a slow problem from the harness SDK-error watch; it blocks as `sdk-error`. */
export const SDK_ERROR_RULE = 'SDK-ERROR';

export const blockerKindOfRule = (rule: string): BlockerKind =>
  rule === COMPARE_RULE ? 'compare' : rule === SDK_ERROR_RULE ? 'sdk-error' : 'problem';

export { slowProblemsOf } from './slow-checks';
