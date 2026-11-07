import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import ts from 'typescript';
import { Problem } from '../problem';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';
import { sourceFileOf } from '../ts-source';
import { appSourcesOf, selectorOf } from './implemented-components';

const ASYNC_SOURCE =
  /\b(?:invokeHost|hostOnly)\$\s*[<(]|\bfetch\s*\(|\bthis\.http\.\w+\s*[<(]|\binject\(\s*HttpClient\s*\)/u;
const PENDING_DRAWN = /\b(?:pending|busy|loading|spinner|progress-spinner)\b|aria-busy/iu;
const SIGNAL_READ =
  /^(?:computed|signal|linkedSignal|input|model|output|outputFromObservable|toSignal|viewChild|viewChildren|contentChild|contentChildren)\b/u;
const OWN_FEEDBACK = new Set(['pickFolder$']);
const OPENS_OVERLAY = /\.open\s*\(\s*[A-Z]\w*Component\b/u;
const NOT_A_HANDLER = new Set([
  ...OWN_FEEDBACK,
  'set',
  'update',
  'get',
  'has',
  'add',
  'delete',
  'push',
  'map',
  'filter',
  'find',
  'tap',
]);
const MAX_DEPTH = 16;

type Source = { path: string; text: string };
type Body = { owner: string; text: string };

const add = <T>(map: Map<string, T[]>, entry: [string, T]) => map.set(entry[0], [...(map.get(entry[0]) ?? []), entry[1]]);

const ownerOf = (path: string) => path.replace(/\.(?:ts|html)$/u, '');

const nameOf = (name: ts.PropertyName | ts.BindingName | undefined) =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) ? name.text : null;

const balancedFrom = (text: string, open: number) => {
  let depth = 0;

  for (let index = open; index < text.length; index++) {
    if (text[index] === '(') depth++;
    if (text[index] === ')' && --depth === 0) return text.slice(open, index + 1);
  }

  return text.slice(open);
};

/** The string literals an emit or call sends: each bare (`a`) and, inside an object literal, keyed (`kind=a`). */
const literalsOf = (text: string) =>
  new Set([
    ...[...text.matchAll(/'([\w-]+)'/gu)].map((match) => match[1] as string),
    ...[...text.matchAll(/\b(\w+)\s*:\s*'([\w-]+)'/gu)].map((match) => `${match[1]}=${match[2]}`),
  ]);

const IF_GUARD = /^\s*if\s*\(\s*([\w.?!]+)\s*===\s*'([\w-]+)'\s*\)/u;
const CASE_GUARD = /^\s*case\s+'([\w-]+)'\s*:/u;
const SWITCH = /\bswitch\s*\(\s*([\w.?!]+)\s*\)/u;

type Guard = { line: number; on: string; literal: string; block: 'brace' | 'outdent' | 'line' };

const guardsIn = (lines: string[]) => {
  let on = '';

  return lines.flatMap((line, index): Guard[] => {
    on = line.match(SWITCH)?.[1] ?? on;

    const branch = line.match(IF_GUARD);
    const entry = line.match(CASE_GUARD);

    if (branch)
      return [
        {
          line: index,
          on: branch[1] as string,
          literal: branch[2] as string,
          block: line.trimEnd().endsWith('{') ? ('brace' as const) : ('line' as const),
        },
      ];

    return entry ? [{ line: index, on, literal: entry[1] as string, block: 'outdent' as const }] : [];
  });
};

/**
 * Drops the `if (x === 'a') …` and `case 'a':` branches the traced emit does not take: on a `.kind`-like tag the emit
 * set (`{ kind: 'b' }`), or on a value whose sibling branch names a literal the emit sent.
 */
const prunedFor = (text: string, chosen: Set<string>) => {
  if (!chosen.size) return text;

  const lines = text.split('\n');
  const guards = guardsIn(lines);
  const taken = (guard: Guard) => {
    const key = guard.on.split('.').pop() ?? guard.on;
    const keyed = [...chosen].some((entry) => entry.startsWith(`${key}=`));

    if (keyed) return chosen.has(`${key}=${guard.literal}`);

    const siblings = guards.filter((other) => other.on === guard.on);

    return !siblings.some((other) => chosen.has(other.literal)) || chosen.has(guard.literal);
  };
  const dropped = new Map(guards.filter((guard) => !taken(guard)).map((guard) => [guard.line, guard]));
  const kept: string[] = [];
  let skip: { indent: number; until: 'brace' | 'outdent' } | null = null;

  lines.forEach((line, index) => {
    const indent = line.length - line.trimStart().length;

    if (skip && line.trim()) {
      if (skip.until === 'brace' && indent === skip.indent && line.trim().startsWith('}')) {
        skip = null;

        return;
      }
      if (skip.until === 'outdent' && indent <= skip.indent) skip = null;
    }
    if (skip) return;

    const guard = dropped.get(index);

    if (!guard) {
      kept.push(line);

      return;
    }
    if (guard.block !== 'line') skip = { indent, until: guard.block };
  });

  return kept.join('\n');
};

/**
 * A call graph over an app's sources, scoped the way Angular resolves names: a template binding `(out)="…"` belongs to
 * the tag it sits on, `out.emit()` reaches the bindings on the emitting component's own tag, and a bare or `this.` call
 * prefers the definitions of the same component.
 */
export const callGraphOf = (sources: Source[]) => {
  const defs = new Map<string, Body[]>();
  const bindings = new Map<string, Body[]>();
  const listeners = new Map<string, Body[]>();
  const selectors = new Map<string, string>();

  for (const { path, text } of sources) {
    const owner = ownerOf(path);

    if (path.endsWith('.ts')) {
      const selector = selectorOf(text);

      if (selector) selectors.set(owner, selector);

      const file = sourceFileOf(text);
      const visit = (node: ts.Node) => {
        const body =
          (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isGetAccessorDeclaration(node)) &&
          node.body
            ? node.body.getText(file)
            : (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
                node.initializer
              ? node.initializer.getText(file)
              : null;
        const name = 'name' in node ? nameOf(node.name as ts.PropertyName) : null;

        if (name && body !== null && !SIGNAL_READ.test(body)) add(defs, [name, { owner, text: body }]);
        ts.forEachChild(node, visit);
      };

      visit(file);

      for (const match of text.matchAll(/\b(\w+\$)\s*\.\s*(?:pipe|subscribe)\s*\(/gu))
        add(listeners, [match[1] as string, { owner, text: balancedFrom(text, match.index + match[0].length - 1) }]);
    }

    for (const tag of text.matchAll(/<([a-z][\w-]*-[\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gu))
      for (const match of (tag[2] as string).matchAll(/\((\w+)\)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu))
        add(bindings, [`${tag[1]}|${match[1]}`, { owner, text: match[2] ?? match[3] ?? '' }]);
  }

  const definitionsOf = (name: string, scope: { owner: string; own: boolean }) => {
    const { owner, own } = scope;
    const all = defs.get(name) ?? [];
    const mine = all.filter((body) => body.owner === owner);

    return mine.length || own ? mine : all;
  };

  const stepsOf = (body: Body, chosen: Set<string>): { label: string; body: Body; chosen: Set<string> }[] => {
    const text = body.text;
    const argsAt = (index: number) => {
      const literals = literalsOf(balancedFrom(text, index));

      return literals.size ? literals : chosen;
    };
    const steps: { label: string; body: Body; chosen: Set<string> }[] = [];

    for (const match of text.matchAll(/\b(\w+)\s*\.\s*emit\s*\(/gu)) {
      const selector = selectors.get(body.owner);

      for (const binding of selector ? (bindings.get(`${selector}|${match[1]}`) ?? []) : [])
        steps.push({ label: `(${match[1]})`, body: binding, chosen: argsAt(match.index + match[0].length - 1) });
    }

    for (const match of text.matchAll(/\b(\w+\$)\s*\.\s*next\s*\(/gu)) {
      const subject = match[1] as string;
      const streams = [...defs].flatMap(([name, bodies]) =>
        bodies.some((other) => other.text.includes(subject) && other.text !== text) ? [name] : [],
      );

      for (const stream of [subject, ...streams])
        for (const listener of listeners.get(stream) ?? []) steps.push({ label: stream, body: listener, chosen });
    }

    for (const match of text.matchAll(/(?<![\w$.])(this\s*\.\s*)?\b([A-Za-z_][\w$]*)\s*(?:<[^()]*>)?\s*\(/gu)) {
      const name = match[2] as string;

      if (NOT_A_HANDLER.has(name) || name === 'emit' || name === 'next') continue;

      for (const definition of definitionsOf(name, { owner: body.owner, own: !!match[1] }))
        steps.push({ label: name, body: definition, chosen: argsAt(match.index + match[0].length - 1) });
    }

    for (const match of text.matchAll(/\.\s*([A-Za-z_][\w$]*)\s*(?:<[^()]*>)?\s*\(/gu)) {
      const name = match[1] as string;

      if (
        NOT_A_HANDLER.has(name) ||
        name === 'emit' ||
        name === 'next' ||
        /this\s*\.\s*$/u.test(text.slice(0, match.index + 1))
      )
        continue;

      for (const definition of definitionsOf(name, { owner: body.owner, own: false }))
        steps.push({ label: name, body: definition, chosen: argsAt(match.index + match[0].length - 1) });
    }

    return steps;
  };

  /** The names a handler passes through to reach a host invoke or HTTP call, or `null` when it reaches none. */
  const pathToAsync = (start: Body): string[] | null => {
    const seen = new Set<string>();
    const walk = (body: Body, trail: { chosen: Set<string>; path: string[] }): string[] | null => {
      const { chosen, path } = trail;
      const key = `${body.owner}|${body.text}|${[...chosen].sort().join(',')}`;

      if (path.length > MAX_DEPTH || seen.has(key)) return null;
      seen.add(key);

      const pruned = { ...body, text: prunedFor(body.text, chosen) };

      if (OPENS_OVERLAY.test(pruned.text)) return null;
      if (ASYNC_SOURCE.test(pruned.text)) return path;

      for (const step of stepsOf(pruned, chosen)) {
        const found = walk(step.body, { chosen: step.chosen, path: [...path, step.label] });

        if (found) return found;
      }

      return null;
    };

    return walk(start, { chosen: new Set(), path: [] });
  };

  return { bindings, pathToAsync };
};

/**
 * The `emit:` actions of a part whose app handler reaches async work (a host invoke or HTTP), traced from the bindings
 * of the output on the component's own tag, each with the names it passed through.
 */
export const asyncActionsOf = (options: { actions: string[]; selector: string; sources: Source[] }) => {
  const graph = callGraphOf(options.sources);

  return options.actions.flatMap((action) => {
    for (const binding of graph.bindings.get(`${options.selector}|${action}`) ?? []) {
      const path = graph.pathToAsync(binding);

      if (path) return [{ action, path: [`(${action})`, ...path] }];
    }

    return [];
  });
};

const partTextsOf = (part: ResolvedPart) => {
  const dir = dirname(part.file);

  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.spec.ts'))
    .map((path) => readFileSync(resolve(dir, path), 'utf8'));
};

/** Whether a part's own sources draw a pending state (a busy, loading or spinner word in its markup or states). */
export const drawsPending = (texts: string[]) => texts.some((text) => PENDING_DRAWN.test(text));

/**
 * `PENDING-STATE-MISSING`: an `emit:` action of a part whose app handler runs async work while the part draws no pending
 * state, so a click shows nothing until the work answers.
 */
export const pendingStateWarningsOf = (product: ResolvedProduct): Problem[] => {
  const checkout = resolve(product.configFile, '../../..');
  const sourcesByApp = new Map<string, Source[]>();

  return product.parts.flatMap((part) => {
    if (part.origin === 'base') return [];

    const link = partLinkOf(part.source);
    const component = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : undefined;
    const appRoot = component?.match(/^(.*?\/src)\//u)?.[1];

    if (!component || !appRoot || !existsSync(resolve(checkout, component))) return [];

    const selector = selectorOf(readFileSync(resolve(checkout, component), 'utf8'));
    const texts = partTextsOf(part);
    const actions = [
      ...new Set(texts.flatMap((text) => [...text.matchAll(/emit:([\w-]+)/gu)].map((m) => m[1] as string))),
    ];

    if (!selector || !actions.length || drawsPending(texts)) return [];

    const appDir = resolve(checkout, appRoot);
    const sources = sourcesByApp.get(appDir) ?? appSourcesOf(appDir);

    sourcesByApp.set(appDir, sources);

    return asyncActionsOf({ actions, selector, sources }).map(({ action, path }) => ({
      rule: 'PENDING-STATE-MISSING',
      file: part.file,
      part: `${part.layer}/${part.name}`,
      at: `emit:${action}`,
      message: `emit:${action} runs async work (${path.join(' → ')}) but the part draws no pending state - draw one (spinner, disabled) so a click shows feedback at once`,
    }));
  });
};
