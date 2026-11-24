import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { noteOf, stateSentencesOf } from '../sketch/part-definition';

const SELF_DECLARED = [
  /^\W*(placeholder|platzhalter)\b/iu,
  /\b(is|are|only|just|still|for now|nur|vorerst|noch|ist|sind)\s+(a\s+|an\s+|ein\s+|eine\s+)?(placeholders?|platzhalter)\b/iu,
  /\b(placeholders?|platzhalter)\s+(until|for now|only|bis|vorerst)\b/iu,
];

const declaresPlaceholder = (text: string) => SELF_DECLARED.some((pattern) => pattern.test(text));

/** An own part whose `note` or a state sentence says the part or state is only a placeholder. */
export const placeholderStatesOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => part.origin !== 'base')
    .flatMap((part): Problem[] => {
      const sentences = stateSentencesOf(part.source);
      const states =
        typeof sentences === 'string'
          ? []
          : Object.entries(sentences)
              .filter(([, sentence]) => declaresPlaceholder(sentence))
              .map(([state]) => state);
      const note = noteOf(part.source);

      return [
        ...(states.length > 0
          ? [
              {
                rule: 'PLACEHOLDER',
                file: part.file,
                states,
                message: `the sentence of ${states.join(', ')} calls the state a placeholder - draw what the state names before ready`,
              },
            ]
          : []),
        ...(note !== null && declaresPlaceholder(note)
          ? [
              {
                rule: 'PLACEHOLDER',
                file: part.file,
                message: 'the note calls the part a placeholder - draw it before ready',
              },
            ]
          : []),
      ];
    });
