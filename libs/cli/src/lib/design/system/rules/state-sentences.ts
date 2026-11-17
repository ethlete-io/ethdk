import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { stateNamesOf, stateSentencesOf } from '../sketch/part-definition';

const RULE = 'STATE-SENTENCE';

const missingOf = (source: string): string[] | 'all' | null => {
  const sentences = stateSentencesOf(source);

  if (sentences === 'none') return /\bdefinePart\s*[<(]/u.test(source) ? 'all' : null;
  if (sentences === 'unknown') return null;

  const states = stateNamesOf(source) ?? Object.keys(sentences);

  return states.filter((state) => !sentences[state]?.trim());
};

/** Each own part of `product` that does not give every state one sentence in `definePart({ describe })`. */
export const missingStateSentencesOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => part.origin !== 'base')
    .flatMap((part): Problem[] => {
      const missing = missingOf(part.source);

      if (missing === null || (missing !== 'all' && missing.length === 0)) return [];

      const states = missing === 'all' ? (stateNamesOf(part.source) ?? []) : missing;

      return [
        {
          rule: RULE,
          file: part.file,
          ...(states.length > 0 && { states }),
          message:
            missing === 'all'
              ? 'no state has a sentence: add describe: { <state>: "<what it shows and what to check>" } for every state (ADR 0330)'
              : `state without a sentence in describe: ${missing.join(', ')} (ADR 0330)`,
        },
      ];
    });
