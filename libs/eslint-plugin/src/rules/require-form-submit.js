// @ts-check
'use strict';

/**
 * Checks that a `<form>` handles its own submission.
 *
 *   <form (ngSubmit)="save()">          ✔
 *   <form [etForm]="form">              ✔ signal forms - the directive submits the field tree
 *   <form>                              ✘ pressing Enter in a field does nothing, or reloads the page
 *
 * A form declaring native submission (`action`, `ngNoForm`, `method="dialog"`) is left alone - it is
 * handled by the platform rather than by a handler.
 */

/** @param {any} node @param {string} name */
const attribute = (node, name) => node.attributes?.find(/** @param {any} a */ (a) => a.name === name);

/** @param {any} node @param {string} name */
const hasBinding = (node, name) =>
  node.inputs?.some(/** @param {any} i */ (i) => i.name === name) ||
  node.attributes?.some(/** @param {any} a */ (a) => a.name === name);

/** @param {any} node */
const handlesSubmit = (node) =>
  node.outputs?.some(/** @param {any} o */ (o) => o.name === 'submit' || o.name === 'ngSubmit') ||
  hasBinding(node, 'etForm') ||
  hasBinding(node, 'formRoot');

/** @param {any} node */
const submitsNatively = (node) =>
  hasBinding(node, 'action') || hasBinding(node, 'ngNoForm') || attribute(node, 'method')?.value === 'dialog';

/** @type {import('eslint').Rule.RuleModule} */
const requireFormSubmit = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a `<form>` to handle its own submission.',
    },
    schema: [],
    messages: {
      missingSubmitHandler:
        'This `<form>` handles no submission - pressing Enter in a field either does nothing or reloads the page. Bind `[etForm]` (signal forms), `(ngSubmit)` (reactive forms) or `(submit)`, or use a plain element if this is not a form.',
    },
  },
  create(context) {
    const parserServices = /** @type {any} */ (context.sourceCode.parserServices);

    if (!parserServices?.convertNodeSourceSpanToLoc) return {};

    /** @param {any} node */
    const report = (node, messageId) =>
      context.report({
        loc: parserServices.convertNodeSourceSpanToLoc(node.startSourceSpan ?? node.sourceSpan),
        messageId,
      });

    return {
      /** @param {any} node */
      Element(node) {
        if (node.name === 'form') {
          if (!handlesSubmit(node) && !submitsNatively(node)) report(node, 'missingSubmitHandler');
        }
      },
    };
  },
};

module.exports = requireFormSubmit;
