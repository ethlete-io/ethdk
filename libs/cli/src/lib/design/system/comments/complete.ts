import { cpSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { findSketch, parseTarget, withAuthor, writeSketchFile } from '../sketch/sketch';
import { madeByOf, withMadeBy, withNote } from '../sketch/part-definition';
import { deleteComment, DesignComment, findComment } from './comment';

/**
 * Completes a handled comment thread: replaces the `note` of the part it was made on, in its product, with
 * `note`, then deletes the thread. A part the product only takes from its base is copied into the product first.
 * With `author`, its model id is stored where the comment sat unless it is there already: in the authors of
 * the sketch variant, or in the `madeBy` of the part. Answers with the deleted comment, or with why nothing changed.
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

  const source = readFileSync(part.file, 'utf8');
  const withNoted = withNote(source, note);
  const madeBy = madeByOf(source);
  const onPart = author && !found.sketch && !madeBy.includes(author);
  const noted = withNoted !== null && onPart ? withMadeBy(withNoted, [...madeBy, author]) : withNoted;

  if (noted === null) return `${part.file} holds no definePart({ note: '…' }) to set the note on`;

  const partDir = resolve(product.dir, part.layer, part.name);

  if (part.origin === 'base') cpSync(dirname(part.file), partDir, { recursive: true });

  writeFileSync(resolve(partDir, `${part.name}.ts`), noted);

  if (author && found.sketch) {
    const target = parseTarget(found.sketch.target);
    const sketch =
      typeof target === 'string'
        ? null
        : findSketch({ productDir: product.dir, product: product.name, sketch: target });

    if (sketch && typeof sketch !== 'string') {
      const authored = withAuthor({ sketch, variant: found.sketch.variant, author });

      if (authored !== sketch) writeSketchFile(authored);
    }
  }

  return deleteComment({ products: [{ name: product.name, dir: product.dir }], id });
};
