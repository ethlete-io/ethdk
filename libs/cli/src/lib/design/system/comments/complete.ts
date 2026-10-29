import { cpSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve, sep } from 'path';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from '../sketch/overlay';
import { findSketch, parseTarget, withAuthor, writeSketchFile } from '../sketch/sketch';
import { madeByOf, withMadeBy, withNote } from '../sketch/part-definition';
import { addressComment, DesignComment, findComment } from './comment';

/**
 * Completes a handled comment thread: replaces the `note` of the part it was made on with `note`, then marks the thread addressed
 * with that note, for the user to resolve. A thread on a sketch variant sets the note in the variant's own copy of the part, never in
 * the product, and changes no part file when the variant does not hold the part; otherwise a part taken from the base is copied into the product first.
 * With `author`, its model id is stored where the comment sat unless it is there already: in the authors of
 * the sketch variant, or in the `madeBy` of the part. Answers with the addressed comment, or with why nothing changed.
 */
export const completeComment = (options: {
  products: ResolvedProduct[];
  id: string;
  note: string;
  author?: string;
}): DesignComment | string => {
  const { products, id, note, author } = options;

  if (note.trim() === '') return 'done needs --note with the note that explains the whole shape of the part';

  const found = findComment({ products: products.map(({ name, dir }) => ({ name, dir })), id });

  if (typeof found === 'string') return found;

  const product = products.find(({ name }) => name === found.product);
  const part = product?.parts.find((candidate) => partKeyOf(candidate) === found.part);

  if (!product || !part) return `${found.part} is no part of ${found.product} - the note has nowhere to go`;

  if (found.sketch) {
    const target = parseTarget(found.sketch.target);
    const sketch =
      typeof target === 'string'
        ? null
        : findSketch({ productDir: product.dir, product: product.name, sketch: target });

    if (!sketch || typeof sketch === 'string') return `${found.sketch.target} is no sketch of ${product.name}`;

    const drawn = overlaySketch({ product, sketch, variant: found.sketch.variant }).parts.find(
      (candidate) => partKeyOf(candidate) === found.part,
    );

    if (drawn && drawn.file.startsWith(`${sketch.dir}${sep}`)) {
      const noted = withNote(readFileSync(drawn.file, 'utf8'), note);

      if (noted === null) return `${drawn.file} holds no definePart({ note: '…' }) to set the note on`;

      writeFileSync(drawn.file, noted);
    }

    if (author) {
      const authored = withAuthor({ sketch, variant: found.sketch.variant, author });

      if (authored !== sketch) writeSketchFile(authored);
    }

    return addressComment({ products: [{ name: product.name, dir: product.dir }], id, author, note });
  }

  const source = readFileSync(part.file, 'utf8');
  const withNoted = withNote(source, note);
  const madeBy = madeByOf(source);
  const noted =
    withNoted !== null && author && !madeBy.includes(author) ? withMadeBy(withNoted, [...madeBy, author]) : withNoted;

  if (noted === null) return `${part.file} holds no definePart({ note: '…' }) to set the note on`;

  const partDir = resolve(product.dir, part.layer, part.name);

  if (part.origin === 'base') cpSync(dirname(part.file), partDir, { recursive: true });

  writeFileSync(resolve(partDir, `${part.name}.ts`), noted);

  return addressComment({ products: [{ name: product.name, dir: product.dir }], id, author, note });
};
