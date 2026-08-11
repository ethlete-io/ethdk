// @ts-check
'use strict';

/**
 * Checks the two ends of the same wire: that a `<form>` handles its own submission, and that a
 * submit control reaches a form at all.
 *
 *   <form (ngSubmit)="save()">          ✔
 *   <form>                              ✘ pressing Enter in a field does nothing, or reloads the page
 *
 *   <form …><button type="submit">      ✔
 *   <button type="submit" form="edit">  ✔ associated by id, outside the form's subtree
 *   <button type="submit">              ✘ submits nothing
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
  node.outputs?.some(/** @param {any} o */ (o) => o.name === 'submit' || o.name === 'ngSubmit');

/** @param {any} node */
const submitsNatively = (node) =>
  hasBinding(node, 'action') || hasBinding(node, 'ngNoForm') || attribute(node, 'method')?.value === 'dialog';

/** @param {any} node */
const isSubmitControl = (node) =>
  (node.name === 'button' || node.name === 'input') && attribute(node, 'type')?.value === 'submit';

/** @type {import('eslint').Rule.RuleModule} */
const requireFormSubmit = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a `<form>` to handle its own submission, and a submit control to reach a form.',
    },
    schema: [],
    messages: {
      missingSubmitHandler:
        'This `<form>` handles no submission - pressing Enter in a field either does nothing or reloads the page. Bind `(ngSubmit)` (reactive forms) or `(submit)`, or use a plain element if this is not a form.',
      submitOutsideForm:
        'A `type="submit"` control outside a `<form>` submits nothing. Put it inside the form, or associate it with one by id: `form="the-form-id"`.',
    },
  },
  create(context) {
    const parserServices = /** @type {any} */ (context.sourceCode.parserServices);

    if (!parserServices?.convertNodeSourceSpanToLoc) return {};

    let formDepth = 0;

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
          formDepth++;

          if (!handlesSubmit(node) && !submitsNatively(node)) report(node, 'missingSubmitHandler');

          return;
        }

        if (formDepth > 0 || !isSubmitControl(node) || hasBinding(node, 'form')) return;

        report(node, 'submitOutsideForm');
      },

      /** @param {any} node */
      'Element:exit'(node) {
        if (node.name === 'form') formDepth--;
      },
    };
  },
};

module.exports = requireFormSubmit;
