// @ts-check
'use strict';

const { getReactiveIo } = require('./internals/angular-io');

/**
 * Disallows naming an `input()` / `model()` after a global HTML attribute.
 *
 * A component's host element carries every global attribute natively, so an
 * input named `title`, `id`, `hidden`, `role`, … collides with the real DOM
 * attribute: the browser applies its native behaviour (a `title` tooltip, a
 * duplicated `id`, native `hidden`/`role` semantics) in addition to — or
 * instead of — the component's intent. Rename the input (e.g. `label`,
 * `overlayId`, `isHidden`) so it can't clash.
 *
 * Only the *global* attributes (those valid on any element) are flagged.
 * Element-specific attributes that libraries routinely mirror on purpose
 * (`disabled`, `value`, `placeholder`, `type`, `size`, `min`, `max`, …) are
 * intentionally NOT flagged — they don't apply to an arbitrary host element and
 * mirroring them is a deliberate, well-understood pattern.
 *
 * ❌ title = input('...')
 * ❌ id = input(...)
 * ❌ hidden = input(false)
 * ✅ label = input('...')
 * ✅ disabled = input(false)   // element-specific, intentional mirror
 */

// Global HTML attributes (valid on every element) + `role`, which behaves the
// same way. Element-specific attributes are deliberately excluded — see above.
//
// Microdata (`itemid`, `itemprop`, …) and other niche globals (`is`, `nonce`,
// `part`, `exportparts`, …) are also excluded: they are rarely used, so an input
// named after one is almost never a real collision, whereas the names double as
// common domain terms (e.g. `itemId` on a list item). Keeping them in would
// produce more false positives than caught footguns.
const GLOBAL_HTML_ATTRIBUTES = new Set([
  'accesskey',
  'autocapitalize',
  'autofocus',
  'class',
  'contenteditable',
  'dir',
  'draggable',
  'enterkeyhint',
  'hidden',
  'id',
  'inert',
  'inputmode',
  'lang',
  'popover',
  'role',
  'slot',
  'spellcheck',
  'style',
  'tabindex',
  'title',
  'translate',
]);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow naming an input/model after a global HTML attribute (it collides with the host element).',
      recommended: true,
    },
    schema: [],
    messages: {
      nativeName:
        "Input '{{ name }}' shares its name with the global HTML attribute '{{ name }}', which every host element carries natively. Rename it to avoid the clash.",
    },
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        const io = getReactiveIo(node);
        if (!io) return;
        if (io.kind === 'output') return;

        if (!GLOBAL_HTML_ATTRIBUTES.has(io.name.toLowerCase())) return;

        context.report({
          node: io.keyNode,
          messageId: 'nativeName',
          data: { name: io.name },
        });
      },
    };
  },
};

module.exports = rule;
