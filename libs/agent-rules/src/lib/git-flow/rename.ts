import { BranchNameSpec, buildBranchName } from './build';
import { GitFlowConfig } from './config';
import { BranchParseResult, parseBranch } from './parse';

const KEY_PLACEHOLDER = '<KEY>';

export type ConformingName =
  | { ok: true; name: string }
  | {
      ok: false;
      /**
       * `needs-key` is the only reason a caller can act on: file the issue, then ask again with the
       * key it returned.
       */
      reason: 'already-conforms' | 'needs-key' | 'no-shape';
    };

/**
 * The spec that rebuilds a branch whose leaf carries no key at all, which is why `parseBranch` left
 * `suggestedName` unset. Only the kinds the grammar can spell are here — an unrecognised name names
 * no kind, and inventing one would rename the branch to something the user never chose.
 */
const specFor = (options: { parse: BranchParseResult; key: string }): BranchNameSpec | undefined => {
  const { parse, key } = options;
  const subject = parse.subject ?? '';

  switch (parse.kind) {
    case 'main-feature':
      return { kind: 'main-feature', type: parse.type, key, subject };
    case 'hotfix':
      return { kind: 'hotfix', key, subject };
    case 'sub-feature':
      return parse.parent ? { kind: 'sub-feature', parent: parse.parent, key, subject } : undefined;
    case 'release-fix':
      return parse.parent ? { kind: 'release-fix', parent: parse.parent, key, subject } : undefined;
    default:
      return undefined;
  }
};

const candidatesFor = (options: { parse: BranchParseResult; key?: string; config: GitFlowConfig }) => {
  const { parse, key, config } = options;
  const suggested = parse.suggestedName;
  const candidates: string[] = [];

  if (suggested && !suggested.includes(KEY_PLACEHOLDER)) candidates.push(suggested);

  if (key) {
    if (suggested?.includes(KEY_PLACEHOLDER)) candidates.push(suggested.replace(/<KEY>/g, key.toUpperCase()));

    const spec = specFor({ parse, key: key.toUpperCase() });

    if (spec) candidates.push(buildBranchName({ spec, config }));
  }

  return candidates;
};

/**
 * The conforming name a non-conforming branch should take, once an issue key exists for it.
 *
 * A candidate is returned only after it parses as fully conforming, so a rename always lands on a
 * name the grammar accepts — `parseBranch`'s own `suggestedName` does not guarantee that for a
 * nested branch whose leaf names no issue, and half a rename is worse than none.
 */
export const conformingNameFor = (options: { branch: string; key?: string; config: GitFlowConfig }): ConformingName => {
  const { key, config } = options;
  const parse = parseBranch({ branch: options.branch, config });

  if (parse.ok) return { ok: false, reason: 'already-conforms' };

  for (const name of candidatesFor({ parse, key, config })) {
    if (name !== parse.branch && parseBranch({ branch: name, config }).ok) return { ok: true, name };
  }

  if (key) return { ok: false, reason: 'no-shape' };

  // Whether a key would help is answered by trying one, using a prefix this repo accepts so the
  // probe is not rejected by `keyPrefixes` for a reason the real key would not hit.
  const probe = candidatesFor({ parse, key: `${config.keyPrefixes[0] ?? 'KEY'}-1`, config });
  const rebuildable = probe.some((name) => parseBranch({ branch: name, config }).ok);

  return { ok: false, reason: rebuildable ? 'needs-key' : 'no-shape' };
};
