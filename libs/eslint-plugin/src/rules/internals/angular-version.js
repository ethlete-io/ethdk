// @ts-check
'use strict';

const path = require('node:path');

/** @type {Map<string, number | null>} */
const cachedByDirectory = new Map();

/**
 * @param {string} directory
 * @returns {number | null}
 */
const detectAngularMajor = (directory) => {
  const cached = cachedByDirectory.get(directory);
  if (cached !== undefined) return cached;

  let result;

  try {
    const pkg = require(require.resolve('@angular/core/package.json', { paths: [directory, __dirname] }));
    const major = Number.parseInt(String(pkg.version).split('.')[0], 10);
    result = Number.isNaN(major) ? null : major;
  } catch {
    result = null;
  }

  cachedByDirectory.set(directory, result);

  return result;
};

/**
 * The Angular major installed next to the linted file (falling back to the plugin's own resolution).
 * `settings.ethlete.angularMajor` wins over detection.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {number | null}
 */
const getAngularMajor = (context) => {
  const settings = /** @type {any} */ (context.settings);
  const override = settings?.ethlete?.angularMajor;
  if (typeof override === 'number') return override;

  const filename = context.filename;
  const directory = filename && path.isAbsolute(filename) ? path.dirname(filename) : process.cwd();

  return detectAngularMajor(directory);
};

module.exports = { getAngularMajor };
