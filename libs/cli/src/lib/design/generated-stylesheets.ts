import { execFile } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DesignConfig, DesignGeneratedStylesheets, workRootOf } from './paths';
import { SketchVariant, SystemModules } from './system/system-modules';

/**
 * Each stylesheet a product generates from a part (`generated` in its config) mapped to the output of the
 * generator run against one sketch variant's own stylesheet of that part. Empty for a merged frame and for a
 * variant that keeps the merged part stylesheet.
 */
export const createGeneratedStylesheets = (options: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
}) => {
  const { target, config, system } = options;
  const runs = new Map<string, Promise<string>>();
  const textOf = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

  const generate = (entry: DesignGeneratedStylesheets, partCss: string) => {
    const key = createHash('sha1')
      .update(JSON.stringify([entry.command, entry.stylesheets, readFileSync(partCss, 'utf8')]))
      .digest('hex')
      .slice(0, 16);
    const known = runs.get(key);

    if (known) return known;

    // Per process, so two servers of one checkout never read a folder the other is writing.
    const out = resolve(workRootOf(target), 'generated', `${key}-${process.pid}`);
    const [command = '', ...args] = entry.command;
    const run = promisify(execFile)(command, [...args, '--part', partCss, '--out', out], { cwd: target }).then(
      () => out,
      (error: Error & { stderr?: string }) => {
        throw new Error(
          `design-explore: \`${entry.command.join(' ')}\` failed for ${partCss}: ${error.stderr || error.message}`,
        );
      },
    );

    runs.set(key, run);
    run.catch(() => runs.delete(key));

    return run;
  };

  return (options: { product: string; sketch: SketchVariant | null }) => {
    const { product, sketch } = options;
    const entries = (sketch && config.products?.[product]?.generated) || [];

    return Promise.all(
      entries.map((entry) => {
        const merged = system.partOf({ product, part: entry.part })?.css;
        const drawn = system.partOf({ product, part: entry.part, sketch })?.css;

        if (!merged || !drawn || !existsSync(drawn) || readFileSync(drawn, 'utf8') === textOf(merged)) return [];

        return generate(entry, drawn).then((out) =>
          entry.stylesheets.map((stylesheet) => [resolve(target, stylesheet), resolve(out, stylesheet)] as const),
        );
      }),
    ).then((pairs) => new Map<string, string>(pairs.flat()));
  };
};
