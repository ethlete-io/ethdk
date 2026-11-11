import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import ts from 'typescript';
import { Problem } from '../problem';
import { SharedDirs } from '../imports';
import { reachableFilesOf } from '../reachable-files';
import { ResolvedProduct } from '../resolve-product';
import { perSource, sourceFileOf } from '../ts-source';

const SCRIPT = /\.[cm]?[jt]sx?$/u;

/** The 1-based lines of every `await` and `for await` that runs while `source` evaluates as a module. */
export const topLevelAwaitLinesOf = perSource((source): number[] => {
  const file = sourceFileOf(source);
  const lines: number[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node)) return;
    if (ts.isAwaitExpression(node) || (ts.isForOfStatement(node) && node.awaitModifier)) {
      lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);

  return [...new Set(lines)];
});

const problemOf = ({ file, source, fix }: { file: string; source: string; fix: string }): Problem[] => {
  const lines = topLevelAwaitLinesOf(source);

  return lines.length === 0
    ? []
    : [
        {
          rule: 'TOP-LEVEL-AWAIT',
          file,
          message: `design module uses top-level await (line ${lines.join(', ')}); WebKit can hang for good when a frame is removed during its evaluation - ${fix}`,
        },
      ];
};

/** A top-level `await` in a module a frame loads: a part, a file it reaches, or an `@ethlete/<lib>/design` module. */
export const topLevelAwaitsOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const { files, sdkDesign } = reachableFilesOf(product);

  return [...files, ...sdkDesign]
    .filter(([file]) => SCRIPT.test(file))
    .flatMap(([file, source]) => problemOf({ file, source, fix: 'await inside render instead' }));
};

/** A top-level `await` in a script below `dir`, the folder of a call or of every call. */
export const callTopLevelAwaitsOf = (dir: string): Problem[] =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => SCRIPT.test(path) && !path.endsWith('.d.ts'))
        .sort()
        .map((path) => resolve(dir, path))
        .flatMap((file) =>
          problemOf({
            file,
            source: readFileSync(file, 'utf8'),
            fix: 'default-export a promise of the drawing instead',
          }),
        )
    : [];
