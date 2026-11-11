import { coloursIn } from '../colour';
import { cssBlocksOf, declarationValueOf } from '../css-source';
import { Problem } from '../problem';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { perSource, textsOf } from '../ts-source';
import { isExemptFrom } from './exemptions';

const valueColoursOf = (css: string) =>
  cssBlocksOf(css).declarations.flatMap((declaration) => coloursIn(declarationValueOf(declaration) ?? ''));

const cssColoursOf = perSource(valueColoursOf);

const textColoursOf = (text: string) => {
  const whole = coloursIn(text.trim());

  return whole.length === 1 && whole[0] === text.trim() ? whole : valueColoursOf(text);
};

const sourceColoursOf = perSource((source) => textsOf(source).flatMap(textColoursOf));

const problemsOf = (file: string, colours: string[]): Problem[] =>
  [...new Set(colours)].map((colour) => ({
    rule: 'HARD-CODED-COLOUR',
    file,
    message: `${colour} outside foundations - use a foundations token`,
  }));

const partProblemsOf = (part: ResolvedPart) => [
  ...problemsOf(part.file, sourceColoursOf(part.source)),
  ...(part.css && part.cssSource ? problemsOf(part.css, cssColoursOf(part.cssSource)) : []),
];

/**
 * A hex colour or colour function in a declaration value of a part outside foundations, in its
 * CSS or in the markup and inline CSS of its TS. A fallback inside `var()` counts.
 */
export const hardCodedColoursOf = (product: ResolvedProduct): Problem[] =>
  product.parts.filter((part) => !isExemptFrom('HARD-CODED-COLOUR', part)).flatMap(partProblemsOf);
