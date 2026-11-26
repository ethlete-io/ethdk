import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';

/** The Prettier CLI of the target checkout, else the one this package resolves, else `null`. */
export const prettierBinOf = (target: string) => {
  const from = [join(target, 'package.json'), __filename].find((file) => {
    try {
      return !!createRequire(file).resolve('prettier/package.json');
    } catch {
      return false;
    }
  });

  return from ? resolve(dirname(createRequire(from).resolve('prettier/package.json')), 'bin/prettier.cjs') : null;
};

/** `text` formatted with the target's Prettier config as if it were `file`; the text as is when Prettier is missing. */
export const formattedTextOf = (options: {
  target: string;
  file: string;
  text: string;
}): string | { error: string } => {
  const bin = prettierBinOf(options.target);

  if (!bin) return options.text;

  const formatted = spawnSync(process.execPath, [bin, '--stdin-filepath', options.file, '--log-level', 'warn'], {
    cwd: options.target,
    input: options.text,
    encoding: 'utf8',
  });

  if (formatted.error || formatted.status !== 0)
    return { error: (formatted.stderr || formatted.error?.message || 'prettier failed').trim() };

  return formatted.stdout;
};

/** `text` (JSON) formatted as `file` by the target checkout's Prettier; unchanged without Prettier or when it fails. */
export const formattedJsonTextOf = (options: { target: string; file: string; text: string }) => {
  const formatted = formattedTextOf({ ...options, file: resolve(options.target, options.file) });

  return typeof formatted === 'string' ? formatted : options.text;
};

/** `value` serialized as JSON and written to `file`, formatted like {@link formattedJsonTextOf}. */
export const writeJsonFile = (options: { file: string; value: unknown }) => {
  const file = resolve(options.file);
  const target = dirname(file);

  mkdirSync(target, { recursive: true });
  writeFileSync(
    file,
    formattedJsonTextOf({ target, file, text: `${JSON.stringify(options.value, null, 2)}\n` }),
    'utf8',
  );
};
