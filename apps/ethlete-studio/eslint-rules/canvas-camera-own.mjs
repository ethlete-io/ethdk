import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CLAMP_WORDS = new Set(['pan', 'camera']);
const STATE_WORDS = new Set([...CLAMP_WORDS, 'zoom', 'offset']);
const STATE_FACTORIES = new Set(['signal', 'linkedSignal', 'model']);
const STATE_SUBJECTS = new Set(['BehaviorSubject', 'ReplaySubject']);
const CAMERA_EVENTS = ['wheel', 'mousewheel', 'pointermove', 'mousemove', 'touchmove', 'gesturestart', 'gesturechange'];
const EVENT_BINDING = new RegExp(`\\((${CAMERA_EVENTS.join('|')})[.)]`);
const EVENT_PROPERTY = new RegExp(`^on(${CAMERA_EVENTS.join('|')})$`);

const wordsOf = (name) =>
  name
    .replace(/\$/g, '')
    .split(/(?=[A-Z])|_/)
    .map((word) => word.toLowerCase());

const namesCamera = (name, words = CLAMP_WORDS) =>
  typeof name === 'string' && wordsOf(name).some((word) => words.has(word));

const keyName = (key) => (key?.type === 'Identifier' ? key.name : key?.type === 'Literal' ? String(key.value) : null);

const typesCamera = (type) => {
  if (!type || typeof type !== 'object') return false;
  if (type.type === 'TSTypeReference' && type.typeName?.type === 'Identifier' && namesCamera(type.typeName.name))
    return true;

  return Object.entries(type).some(
    ([key, value]) =>
      key !== 'parent' &&
      (Array.isArray(value)
        ? value.some((item) => item?.type?.startsWith('TS') && typesCamera(item))
        : value?.type?.startsWith?.('TS') && typesCamera(value)),
  );
};

const callTypesCamera = (node) =>
  node?.type === 'CallExpression' && (node.typeArguments?.params ?? []).some((param) => typesCamera(param));

const calleeName = (node) => {
  const callee = node.type === 'NewExpression' || node.type === 'CallExpression' ? node.callee : null;

  if (callee?.type === 'Identifier') return callee.name;
  if (callee?.type === 'MemberExpression' && !callee.computed) return callee.property.name;

  return null;
};

const isCameraContext = (node) => {
  if (node.type === 'VariableDeclarator')
    return (
      (node.id.type === 'Identifier' && (namesCamera(node.id.name) || typesCamera(node.id.typeAnnotation))) ||
      callTypesCamera(node.init)
    );
  if (node.type === 'PropertyDefinition')
    return namesCamera(keyName(node.key)) || typesCamera(node.typeAnnotation) || callTypesCamera(node.value);
  if (node.type === 'MethodDefinition') return namesCamera(keyName(node.key));
  if (node.type === 'FunctionDeclaration') return namesCamera(node.id?.name);

  return false;
};

const ownerOf = (node) => {
  let owner = null;

  for (let current = node; current; current = current.parent) {
    if (current.type === 'PropertyDefinition' || current.type === 'MethodDefinition') return keyName(current.key);
    if (current.type === 'FunctionDeclaration' && current.id) owner = current.id.name;
    if (current.type === 'VariableDeclarator' && current.id.type === 'Identifier') owner = current.id.name;
  }

  return owner ?? '<module>';
};

const readsCamera = (node) => {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'Identifier') return namesCamera(node.name);
  if (node.type === 'MemberExpression')
    return (!node.computed && namesCamera(node.property.name)) || readsCamera(node.object);
  if (node.type === 'Property') return readsCamera(node.value);
  if (/^(Arrow)?Function(Expression|Declaration)$/.test(node.type)) return false;

  return Object.entries(node).some(
    ([key, value]) =>
      key !== 'parent' &&
      key !== 'typeArguments' &&
      key !== 'typeAnnotation' &&
      (Array.isArray(value) ? value.some((item) => readsCamera(item)) : value?.type && readsCamera(value)),
  );
};

const isClampCall = (node) => {
  const callee = node.callee;

  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Math' &&
    ['min', 'max'].includes(callee.property.name)
  )
    return true;

  return /clamp/i.test(calleeName(node) ?? '');
};

/** @type {import('eslint').Rule.RuleModule} */
export const canvasCameraOwn = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keeps the canvas camera (pan, zoom, their listeners and limits) in components/design-canvas, out of the design parts.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          known: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      state:
        "'{{name}}' holds camera state in a design part. components/design-canvas owns pan and zoom; read the camera from it instead of keeping a copy.",
      listener:
        "A '{{event}}' listener in a design part. components/design-canvas owns the pan and zoom input; mount the canvas instead.",
      clamp:
        'Clamp math on camera values in a design part. components/design-canvas owns the pan and zoom limits; a clamp here stops the canvas at an edge it does not know.',
      staleKnown: "Known camera violation '{{entry}}' no longer occurs here. Remove it from the known list.",
    },
  },

  create(context) {
    const filename = context.filename.replace(/\\/g, '/');
    const knownMap = context.options[0]?.known ?? {};
    const knownFile = Object.keys(knownMap).find((suffix) => filename.endsWith(suffix));
    const known = new Set(knownFile ? knownMap[knownFile] : []);
    const used = new Set();

    const report = (node, messageId, data = {}) => {
      const entry = `${ownerOf(node)}:${messageId}`;

      if (known.has(entry)) {
        used.add(entry);

        return;
      }

      context.report({ node, messageId, data });
    };

    const checkState = (node, name, value, mutable) => {
      if (!namesCamera(name, STATE_WORDS) || !value) return;

      const factory = calleeName(value);
      const isState =
        (value.type === 'CallExpression' && STATE_FACTORIES.has(factory)) ||
        (value.type === 'NewExpression' && STATE_SUBJECTS.has(factory)) ||
        (mutable && ['ObjectExpression', 'Literal'].includes(value.type));

      if (isState) report(node, 'state', { name });
    };

    const checkEventText = (node, text) => {
      const binding = EVENT_BINDING.exec(text);

      if (binding) report(node, 'listener', { event: binding[1] });
    };

    return {
      PropertyDefinition(node) {
        checkState(node, keyName(node.key), node.value, !node.readonly);
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier') return;

        checkState(node, node.id.name, node.init, node.parent.kind === 'let');
      },
      CallExpression(node) {
        const event = node.arguments.find(
          (arg) => arg.type === 'Literal' && typeof arg.value === 'string' && CAMERA_EVENTS.includes(arg.value),
        );

        if (event) report(node, 'listener', { event: event.value });
        if (!isClampCall(node)) return;

        const named = namesCamera(calleeName(node) ?? '', STATE_WORDS);
        let inCameraContext = false;

        for (let current = node.parent; current && !inCameraContext; current = current.parent)
          inCameraContext = isCameraContext(current);

        if (named || inCameraContext || node.arguments.some((arg) => readsCamera(arg))) report(node, 'clamp');
      },
      Literal(node) {
        if (typeof node.value !== 'string') return;

        checkEventText(node, node.value);
        if (node.parent?.type === 'Property' && keyName(node.parent.key) === 'templateUrl') {
          const template = resolve(dirname(filename), node.value);

          if (existsSync(template)) checkEventText(node, readFileSync(template, 'utf8'));
        }
      },
      TemplateElement(node) {
        checkEventText(node, node.value.cooked ?? node.value.raw);
      },
      MemberExpression(node) {
        if (!node.computed && EVENT_PROPERTY.test(node.property.name ?? ''))
          report(node, 'listener', { event: node.property.name.slice(2) });
      },
      'Program:exit'(node) {
        for (const entry of known)
          if (!used.has(entry)) context.report({ node, messageId: 'staleKnown', data: { entry } });
      },
    };
  },
};
