// @ts-check
'use strict';

/**
 * Disallows class members that are declared but never read within the class body.
 *
 * Only checks members that CANNOT be accessed from outside the class at compile
 * time — so false positives (e.g. template usage) are avoided:
 *
 * - `private` members — always checked. Private members are only accessible
 *   within the class body, so if they are never read there they are dead code.
 *
 * - `protected` members — checked only when the class has an Angular decorator
 *   other than `@Component` (i.e. `@Directive`, `@Pipe`, `@Injectable`).
 *   For `@Component`, protected members may be read in the HTML template file
 *   which is invisible to static analysis, so protected is skipped there.
 *   For plain (non-Angular) classes, protected members may be used in a
 *   subclass in another file, so they are also skipped.
 *
 * Members referenced in `host:` binding expressions in the class decorator are
 * excluded from the check for `protected` (since they are accessed by Angular
 * at runtime via the host binding mechanism).
 *
 * BAD:
 *   private document = inject(DOCUMENT); // fetched but never used
 *   private unusedFlag = false;
 *
 * GOOD:
 *   private document = inject(DOCUMENT);
 *   createElement() { return this.document.createElement('div'); }
 */

const ANGULAR_DECORATORS = new Set(['Component', 'Directive', 'Pipe', 'Injectable']);

/**
 * Extract all identifier-like tokens from a template expression string.
 * Used for `host:` binding values like `'myMember ? "on" : "off"'`.
 * @param {string} str
 * @returns {string[]}
 */
const extractIdentifiers = (str) => str.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) ?? [];

/**
 * Returns info about the Angular decorators applied to a class node.
 * @param {any} classNode
 * @returns {{ isComponent: boolean, isAngularClass: boolean }}
 */
const getDecoratorInfo = (classNode) => {
  const decorators = classNode.decorators ?? [];
  let isComponent = false;
  let isAngularClass = false;

  for (const dec of decorators) {
    const expr = dec.expression;
    const name =
      expr?.type === 'CallExpression' && expr.callee?.type === 'Identifier'
        ? expr.callee.name
        : expr?.type === 'Identifier'
          ? expr.name
          : null;

    if (name && ANGULAR_DECORATORS.has(name)) {
      isAngularClass = true;
      if (name === 'Component') isComponent = true;
    }
  }

  return { isComponent, isAngularClass };
};

/**
 * Returns names of class members referenced in `host:` binding value strings
 * found in any decorator argument on the class.
 * @param {any} classNode
 * @returns {Set<string>}
 */
const getHostBoundMembers = (classNode) => {
  /** @type {Set<string>} */
  const result = new Set();
  const decorators = classNode.decorators ?? [];

  for (const dec of decorators) {
    const expr = dec.expression;
    if (expr?.type !== 'CallExpression') continue;

    const arg = expr.arguments?.[0];
    if (!arg || arg.type !== 'ObjectExpression') continue;

    const hostProp = arg.properties.find(
      /** @param {any} p */
      (p) => p.type === 'Property' && (p.key?.name === 'host' || p.key?.value === 'host'),
    );
    if (!hostProp || hostProp.value?.type !== 'ObjectExpression') continue;

    for (const binding of hostProp.value.properties) {
      if (binding.type !== 'Property') continue;
      /** @type {any} */
      const val = binding.value;
      if (val?.type !== 'Literal' || typeof val.value !== 'string') continue;
      for (const id of extractIdentifiers(val.value)) result.add(id);
    }
  }

  return result;
};

/** @type {import('eslint').Rule.RuleModule} */
const noUnusedClassMember = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow class members that are declared but never read within the class body.',
      recommended: true,
    },
    messages: {
      noUnused:
        "'{{name}}' is declared but its value is never read within this class. " +
        'Remove it, or widen its accessibility if it is intentionally used externally.',
    },
    schema: [],
  },
  create(context) {
    /**
     * Stack of class frames. Each frame tracks which members are candidates and
     * which have been seen in a `this.x` expression.
     *
     * @type {Array<{
     *   classBody: import('eslint').Rule.Node,
     *   isComponent: boolean,
     *   isAngularClass: boolean,
     *   hostBound: Set<string>,
     *   candidates: Map<string, import('eslint').Rule.Node>,
     *   usedNames: Set<string>,
     * }>}
     */
    const classStack = [];

    /**
     * @param {any} node
     */
    const registerMember = (node) => {
      const frame = classStack[classStack.length - 1];
      if (!frame) return;
      // Only register members that belong directly to this class body
      if (node.parent !== frame.classBody) return;

      if (node.static) return;

      const key = node.key;
      if (!key || key.type !== 'Identifier') return;
      if (node.type === 'MethodDefinition' && node.kind === 'constructor') return;

      const name = key.name;
      const accessibility = node.accessibility;
      const { isComponent, isAngularClass, hostBound } = frame;

      if (accessibility === 'private') {
        frame.candidates.set(name, node);
      } else if (accessibility === 'protected' && isAngularClass && !isComponent) {
        if (!hostBound.has(name)) frame.candidates.set(name, node);
      }
    };

    return {
      ClassBody(node) {
        const classNode = node.parent;
        const { isComponent, isAngularClass } = getDecoratorInfo(classNode);
        const hostBound = getHostBoundMembers(classNode);
        classStack.push({
          classBody: node,
          isComponent,
          isAngularClass,
          hostBound,
          candidates: new Map(),
          usedNames: new Set(),
        });
      },

      'ClassBody:exit'() {
        const frame = classStack.pop();
        if (!frame) return;
        for (const [name, memberNode] of frame.candidates) {
          if (!frame.usedNames.has(name)) {
            context.report({ node: memberNode, messageId: 'noUnused', data: { name } });
          }
        }
      },

      PropertyDefinition: registerMember,
      MethodDefinition: registerMember,

      MemberExpression(node) {
        // Only care about `this.name` (non-computed direct property access)
        if (node.computed) return;
        if (node.object?.type !== 'ThisExpression') return;
        if (node.property?.type !== 'Identifier') return;

        // Mark used in the innermost class frame. Arrow functions don't push a
        // new frame so they correctly share the enclosing class's `this`.
        // Regular nested classes push a new frame so their `this.x` won't
        // accidentally mark an outer class member as used.
        const frame = classStack[classStack.length - 1];
        if (frame) frame.usedNames.add(node.property.name);
      },
    };
  },
};

module.exports = noUnusedClassMember;
