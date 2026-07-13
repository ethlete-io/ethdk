// @ts-check
'use strict';

/**
 * Shared detection for Angular signal-based inputs and outputs.
 *
 * This repo declares component I/O exclusively via the signal factory functions
 * (no `@Input()` / `@Output()` decorators):
 *
 *   foo = input(...)                 → input
 *   foo = input.required<T>(...)     → input
 *   foo = model(...)                 → model  (two-way input)
 *   foo = model.required<T>(...)     → model
 *   foo = output<T>()                → output
 *   foo = outputFromObservable(...)  → output
 *
 * `getReactiveIo` maps a class `PropertyDefinition` node onto one of those kinds
 * (or null when the property is not a reactive I/O declaration).
 */

/** Factory identifier → I/O kind. */
const IO_FACTORIES = {
  input: 'input',
  model: 'model',
  output: 'output',
  outputFromObservable: 'output',
};

/**
 * Resolves the factory function name of a call expression, handling both the
 * plain form (`input(...)`) and the `.required` member form
 * (`input.required(...)`).
 *
 * @param {any} callee
 * @returns {string | null}
 */
const getFactoryName = (callee) => {
  if (!callee) return null;

  if (callee.type === 'Identifier') return callee.name;

  // input.required(...) / model.required(...)
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'required'
  ) {
    return callee.object.name;
  }

  return null;
};

/**
 * Classifies a class property as an Angular signal input/model/output.
 *
 * @param {any} node  PropertyDefinition
 * @returns {{ kind: 'input' | 'model' | 'output', name: string, keyNode: any } | null}
 */
const getReactiveIo = (node) => {
  if (!node || node.type !== 'PropertyDefinition') return null;
  if (node.computed || node.key.type !== 'Identifier') return null;

  const value = node.value;
  if (!value || value.type !== 'CallExpression') return null;

  const factory = getFactoryName(value.callee);
  if (!factory) return null;

  const kind = /** @type {Record<string, 'input' | 'model' | 'output'>} */ (IO_FACTORIES)[factory];
  if (!kind) return null;

  return { kind, name: node.key.name, keyNode: node.key };
};

module.exports = { getReactiveIo };
