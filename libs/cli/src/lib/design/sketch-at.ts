import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { sketchFolderOf, SketchTarget } from './system/sketch/sketch';

/**
 * Copies the sketch folder of `sketch` as `commit` held it into `<dest>/sketches/<layer>-<name>`, straight from
 * git's object store, and answers `dest` as `root`, or why the commit holds no such sketch. The working tree and index stay as they are.
 */
export const extractSketchAt = (options: {
  target: string;
  productDir: string;
  sketch: SketchTarget;
  commit: string;
  dest: string;
}): { root: string } | { problem: string } => {
  const { target, productDir, sketch, commit, dest } = options;
  const run = (args: string[], input?: Buffer) =>
    execFileSync('git', args, { cwd: target, input, maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'pipe'] });

  try {
    const top = run(['rev-parse', '--show-toplevel']).toString().trim();
    const folder = relative(top, resolve(productDir, 'sketches', sketchFolderOf(sketch)))
      .split(sep)
      .join('/');
    const archive = run(['archive', '--format=tar', commit, '--', folder]);

    rmSync(dest, { recursive: true, force: true });
    mkdirSync(resolve(dest, 'sketches'), { recursive: true });
    execFileSync('tar', ['-x', '-C', resolve(dest, 'sketches'), `--strip-components=${folder.split('/').length - 1}`], {
      input: archive,
    });

    return { root: dest };
  } catch (error) {
    const detail =
      error instanceof Error && 'stderr' in error ? String((error as { stderr: Buffer }).stderr).trim() : '';

    return { problem: `no sketch ${sketch.layer}/${sketch.name} in commit ${commit}${detail ? `: ${detail}` : ''}` };
  }
};
