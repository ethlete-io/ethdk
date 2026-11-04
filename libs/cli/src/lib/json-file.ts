import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { formattedTextOf } from './design/system/prettier';

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
