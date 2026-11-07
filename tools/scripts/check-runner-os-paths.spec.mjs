import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linuxPathFindings } from './check-runner-os-paths.mjs';

test('flags a Linux path in an unguarded step', () => {
  const text = ['steps:', '  - run: |', '      id=$(cat /etc/machine-id)'].join('\n');

  assert.deepEqual(linuxPathFindings(text), [{ line: 3, text: 'id=$(cat /etc/machine-id)' }]);
});

test('allows a path in a Linux case branch', () => {
  const text = [
    '  - run: |',
    '      case "$RUNNER_OS" in',
    '        Linux) id=$(cat /etc/machine-id) ;;',
    '      esac',
  ].join('\n');

  assert.deepEqual(linuxPathFindings(text), []);
});

test('allows a path in a step guarded by runner.os', () => {
  const text = ["  - if: runner.os == 'Linux'", '    run: cat /proc/cpuinfo'].join('\n');

  assert.deepEqual(linuxPathFindings(text), []);
});

test('a guard on another step does not cover the next step', () => {
  const text = ["  - if: runner.os == 'Linux'", '    run: echo ok', '  - run: cat /proc/cpuinfo'].join('\n');

  assert.equal(linuxPathFindings(text).length, 1);
});

test('ignores comments and non-Linux paths', () => {
  const text = ['  - run: |', '      # reads /etc/hosts', '      echo ./etc/x', '      cat /usr/bin/env'].join('\n');

  assert.deepEqual(linuxPathFindings(text), []);
});
