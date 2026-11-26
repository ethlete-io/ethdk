import { leakMessageOf, openSpecTmp } from './spec-tmp.mjs';

// A git hook exports GIT_DIR and GIT_INDEX_FILE; a spec, or the script it tests, would run its temp-repo git on the hook's repo.
for (const key of Object.keys(process.env).filter((name) => name.startsWith('GIT_'))) delete process.env[key];

const spec = process.env['NODE_TEST_CONTEXT'] ? process.argv[1] : undefined;

if (spec) {
  const tmp = openSpecTmp();
  const check = () => {
    const left = tmp.close();

    if (left.length === 0) return;
    process.stderr.write(`${leakMessageOf(spec, left)}\n`);
    process.exitCode = 1;
  };

  process.env['TMPDIR'] = tmp.dir;
  process.on('exit', check);
  // The check must be the last exit listener: a spec that removes its temp dirs on exit has not left them.
  process.on('newListener', (event, listener) => {
    if (event !== 'exit' || listener === check) return;
    process.nextTick(() => {
      process.removeListener('exit', check);
      process.on('exit', check);
    });
  });
}
