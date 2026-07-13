// @ts-check
'use strict';

const { getReactiveIo } = require('./internals/angular-io');

/**
 * Nudges `output()` names toward the present tense, matching native DOM events.
 *
 * Native events are named in the present tense after the thing that happens:
 * `input`, `change`, `select`, `mousedown`, `dragstart`. Components should read
 * the same way in a template — `(playerSelect)`, not `(playerSelected)`. A
 * past-tense name describes a state after the fact rather than the event.
 *
 * ❌ playerSelected = output<...>()
 * ❌ filesRejected = output<...>()
 * ✅ playerSelect = output<...>()
 * ✅ filesReject = output<...>()
 *
 * Detection is heuristic: the final camel-case segment is flagged when it ends
 * in `-ed` (the dominant past-participle pattern), excluding an allowlist of
 * base-form words that merely happen to end that way (`succeed`, `feed`,
 * `speed`, …). Irregular past tenses that don't end in `-ed` (`sent`, `shown`,
 * `built`, …) are NOT detected — this rule catches the common case, not every
 * one. No auto-fix: de-conjugating a verb reliably (and renaming the matching
 * template bindings) is out of scope, so the corrected name is left to the
 * author.
 */

// Base-form / noun words ending in "-ed" that are not past participles.
const NON_PAST_ED_WORDS = new Set([
  'succeed',
  'proceed',
  'exceed',
  'feed',
  'need',
  'breed',
  'bleed',
  'speed',
  'seed',
  'weed',
  'embed',
  'shed',
  'wed',
  'indeed',
]);

/**
 * Returns the final camel-case segment of an identifier, lower-cased.
 * `filesRejected` → `rejected`, `removed` → `removed`.
 *
 * @param {string} name
 */
const lastWord = (name) => {
  const segments = name.split(/(?=[A-Z])/);
  return segments[segments.length - 1].toLowerCase();
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer present-tense output names (like native DOM events) over past-tense ones.',
      recommended: true,
    },
    schema: [],
    messages: {
      pastTense:
        "Output '{{ name }}' looks past tense ('{{ word }}'). Name outputs after the present-tense event like native DOM events (e.g. 'change', 'select'), not their past participle ('changed', 'selected').",
    },
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        const io = getReactiveIo(node);
        if (!io || io.kind !== 'output') return;

        const word = lastWord(io.name);
        if (word.length <= 2 || !word.endsWith('ed')) return;
        if (NON_PAST_ED_WORDS.has(word)) return;

        context.report({
          node: io.keyNode,
          messageId: 'pastTense',
          data: { name: io.name, word },
        });
      },
    };
  },
};

module.exports = rule;
