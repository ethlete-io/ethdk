import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specTypecheckProblem } from './check-spec-typecheck.mjs';

const target = (command) => ({ targets: { typecheck: { executor: 'nx:run-commands', options: { command } } } });

test('a typecheck of only the app config is a problem', () => {
  assert.match(
    specTypecheckProblem('apps/x', target('ngc -p apps/x/tsconfig.app.json --noEmit')),
    /does not check apps\/x\/tsconfig.spec.json/,
  );
});

test('a typecheck that includes the spec config passes', () => {
  assert.equal(
    specTypecheckProblem(
      'apps/x',
      target('ngc -p apps/x/tsconfig.app.json --noEmit && tsc -p apps/x/tsconfig.spec.json --noEmit'),
    ),
    null,
  );
});

test('a project without a typecheck target is a problem', () => {
  assert.notEqual(specTypecheckProblem('apps/x', {}), null);
});
