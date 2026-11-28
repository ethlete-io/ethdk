import { realpathSync } from 'fs';
import { resolve } from 'path';
import { assetRoot } from './package-root';
import { partKeyOf } from './system/resolve-product';
import { fileOfModuleId, productOfModuleId, sketchOfModuleId, SystemModules } from './system/system-modules';
import { fsUrl } from './vite-paths';

const DEFAULT_EXPORT = /^export default /gm;
const NAMED_EXPORT = /^export (const|(?:async\s+)?function\*?)\s+(?!enum\b)([A-Za-z_$][\w$]*)/gm;

/**
 * The source of a part module whose default export renders with its first element marked as the part `key`, and
 * whose exported `const` and `function` helpers mark their markup the same way, or `null` when the module has no
 * single top-level `export default`.
 */
export const markPartSource = (options: { code: string; key: string; marker: string }) => {
  const { code, key, marker } = options;

  if ((code.match(DEFAULT_EXPORT) ?? []).length !== 1) return null;

  const named = Array.from(code.matchAll(NAMED_EXPORT), ([, , name]) => name ?? '');
  const reexports = named
    .map(
      (name) => `const __etNamed_${name} = __etMarkNamed(${name}, { key: ${JSON.stringify(key)}, part: __etPart });\n`,
    )
    .join('');
  const exported = named.map((name) => `__etNamed_${name} as ${name}`).join(', ');

  return (
    `${code.replace(DEFAULT_EXPORT, 'const __etPart = ').replace(NAMED_EXPORT, '$1 $2')}\n` +
    `import { markNamed as __etMarkNamed, markPart as __etMarkPart } from ${JSON.stringify(marker)};\n` +
    `export default __etMarkPart(__etPart, ${JSON.stringify(key)});\n` +
    (named.length > 0 ? `${reexports}export { ${exported} };\n` : '')
  );
};

const realOf = (file: string) => {
  try {
    return realpathSync(file);
  } catch {
    return null;
  }
};

/** A Vite `transform` that marks the root element of every part a product or a sketch variant draws. */
export const partMarksTransform = (system: SystemModules) => {
  const marker = fsUrl(resolve(assetRoot(), 'mark-part.ts'));
  const reals = new Map<string, string>();
  const cachedRealOf = (file: string) => {
    const real = reals.get(file) ?? realOf(file);

    if (real) reals.set(file, real);

    return real ?? file;
  };

  return (code: string, id: string) => {
    const product = productOfModuleId(id);

    if (!product || id.startsWith('\0')) return null;

    const file = fileOfModuleId(id);
    const parts = system.drawnOf(product, sketchOfModuleId(id))?.parts ?? [];
    const real = cachedRealOf(file);
    const part =
      parts.find((candidate) => candidate.file === file) ??
      parts.find((candidate) => cachedRealOf(candidate.file) === real);

    return part ? markPartSource({ code, key: partKeyOf(part), marker }) : null;
  };
};
