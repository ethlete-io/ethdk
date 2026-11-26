import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { test } from 'node:test';

const studio = join(import.meta.dirname, '..', '..', '.ethlete', 'design', 'studio');

// Tom's decision (B793 Q1): every page shows its bottom-bar actions as icon buttons with a tooltip.
const ACTIONS = {
  'flows.ts': ['add'],
  'inventory.ts': ['reload'],
  'start.ts': ['other'],
  'system.ts': ['comment', 'toggle'],
};

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.ts') ? [path] : [];
  });

const sources = walk(studio).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

const literalAt = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return '';
};

const definition = (name, own) => {
  for (const { text } of [{ text: own }, ...sources]) {
    const match = new RegExp(`(?:const|let) ${name} = (?:await )?([\\w.]+)\\(`).exec(text);
    if (match) return { callee: match[1], text, at: match.index + match[0].length };
  }
  return undefined;
};

const functionBody = (name, own) => {
  for (const { text } of [{ text: own }, ...sources]) {
    const at = text.search(new RegExp(`const ${name} = (?:async )?\\(`));
    if (at >= 0) return text.slice(at);
  }
  return undefined;
};

const iconLiteralOf = (name, own, seen = new Set()) => {
  const found = definition(name, own);
  assert.ok(found, `no definition of "${name}"`);
  const { callee, text, at } = found;
  if (callee === 'button.render' || callee === 'iconButton') {
    return { callee, literal: literalAt(text, text.indexOf('{', at - 1)) };
  }
  assert.ok(!seen.has(callee), `cannot resolve "${name}"`);
  seen.add(callee);
  const body = functionBody(callee, own);
  assert.ok(body, `no function "${callee}" behind "${name}"`);
  const inner = /(button\.render|iconButton)\(\{/.exec(body);
  assert.ok(inner, `"${callee}" builds no button`);
  return { callee: inner[1], literal: literalAt(body, inner.index + inner[0].length - 1) };
};

const editedBySketch = (path) => {
  const rel = path.slice(studio.length + 1).split('/');
  return rel[0] === 'pages' && sources.some((source) => source.path.includes(`/sketches/pages-${rel[1]}.edit/`));
};

const toolbars = sources.filter(
  ({ path, text }) => basename(path) in ACTIONS && text.includes('data-sk-toolbar') && !editedBySketch(path),
);

test('the toolbar sources are found', () => {
  assert.deepEqual(new Set(toolbars.map(({ path }) => basename(path))), new Set(Object.keys(ACTIONS)));
});

for (const { path, text } of toolbars) {
  for (const name of ACTIONS[basename(path)]) {
    test(`${path.slice(studio.length + 1)}: toolbar action "${name}" is an icon button with an aria label`, () => {
      const block = text.slice(text.indexOf('data-sk-toolbar'));
      assert.match(
        block.slice(0, block.indexOf('</div>')),
        new RegExp(`\\b${name}\\b`),
        `"${name}" not in the toolbar`,
      );
      const { callee, literal } = iconLiteralOf(name, text);
      if (callee === 'button.render') assert.match(literal, /iconOnly:\s*true/, `"${name}" is a text button`);
      assert.match(literal, /ariaLabel:/, `"${name}" has no ariaLabel`);
    });
  }
}
