import { ResolvedProduct } from '../resolve-product';

/** Per product folder, each part whose direct edit draws as before, with the part hash it was drawn at. */
export type HeldEdits = Record<string, Record<string, string>>;

let held: HeldEdits = {};

/**
 * Keeps in memory that the direct edit of `part` at part hash `hash` draws as before, so the design server does not
 * show it as an open point; `merged.json` keeps its hash until a sketch merge records it.
 */
export const holdEdit = ({ product, part, hash }: { product: ResolvedProduct; part: string; hash: string }) => {
  held = { ...held, [product.dir]: { ...held[product.dir], [part]: hash } };
};

/** The held direct edits of a product, by part. */
export const heldEditsOf = (product: ResolvedProduct): Record<string, string> => held[product.dir] ?? {};

/** Every held direct edit, to hand to the open-points worker. */
export const allHeldEdits = (): HeldEdits => held;

/** Replaces every held direct edit with `next`, as the open-points worker does with the server's. */
export const replaceHeldEdits = (next: HeldEdits) => {
  held = next;
};
