import { cpSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { withNote } from '../sketch/part-definition';
import { deleteComment, DesignComment, findComment } from './comment';

/**
 * Completes a handled comment thread: replaces the `note` of the part it was made on, in its product, with
 * `note`, then deletes the thread. A part the product only takes from its base is copied into the product first.
 * Answers with the deleted comment, or with why nothing changed.
 */
export const completeComment = (options: {
  products: ResolvedProduct[];
  id: string;
  note: string;
}): DesignComment | string => {
  const { products, id, note } = options;

  if (note.trim() === '') return 'done needs --note with the note that explains the whole shape of the part';

  const found = findComment({ products: products.map(({ name, dir }) => ({ name, dir })), id });

  if (typeof found === 'string') return found;

  const product = products.find(({ name }) => name === found.product);
  const part = product?.parts.find((candidate) => partKeyOf(candidate) === found.part);

  if (!product || !part) return `${found.part} is no part of ${found.product} - the note has nowhere to go`;

  const noted = withNote(readFileSync(part.file, 'utf8'), note);

  if (noted === null) return `${part.file} holds no definePart({ note: '…' }) to set the note on`;

  const partDir = resolve(product.dir, part.layer, part.name);

  if (part.origin === 'base') cpSync(dirname(part.file), partDir, { recursive: true });

  writeFileSync(resolve(partDir, `${part.name}.ts`), noted);

  return deleteComment({ products: [{ name: product.name, dir: product.dir }], id });
};
