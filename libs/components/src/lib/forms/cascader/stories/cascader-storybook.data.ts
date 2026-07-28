// Demo fixtures live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service — see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CascaderDataSource, CascaderNode } from '../headless';

// competition → stage → tournament → match, a static tree used by the sync story
export const TREE: Record<string, CascaderNode<string>[]> = {
  root: [
    { value: 'euro', label: 'UEFA Euro' },
    { value: 'wc', label: 'World Cup' },
    { value: 'cl', label: 'Champions League' },
  ],
  euro: [
    { value: 'euro-group', label: 'Group stage' },
    { value: 'euro-ko', label: 'Knockout stage' },
  ],
  wc: [
    { value: 'wc-group', label: 'Group stage' },
    { value: 'wc-ko', label: 'Knockout stage' },
  ],
  cl: [
    { value: 'cl-league', label: 'League phase' },
    { value: 'cl-ko', label: 'Knockout phase' },
  ],
  'euro-group': [
    { value: 'euro-group-a', label: 'Group A', isLeaf: true },
    { value: 'euro-group-b', label: 'Group B', isLeaf: true },
    { value: 'euro-group-c', label: 'Group C', isLeaf: true },
  ],
  'euro-ko': [
    { value: 'euro-r16', label: 'Round of 16', isLeaf: true },
    { value: 'euro-qf', label: 'Quarter-finals', isLeaf: true },
    { value: 'euro-sf', label: 'Semi-finals', isLeaf: true },
    { value: 'euro-final', label: 'Final', isLeaf: true },
  ],
  'wc-group': [
    { value: 'wc-group-a', label: 'Group A', isLeaf: true },
    { value: 'wc-group-b', label: 'Group B', isLeaf: true },
  ],
  'wc-ko': [{ value: 'wc-final', label: 'Final', isLeaf: true }],
  'cl-league': [{ value: 'cl-md1', label: 'Matchday 1', isLeaf: true }],
  'cl-ko': [
    { value: 'cl-qf', label: 'Quarter-finals', isLeaf: true },
    { value: 'cl-final', label: 'Final', isLeaf: true },
  ],
};

export const syncSource: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent ? parent.value : 'root'] ?? [],
};

// same tree, but each level resolves over the wire (Observable with latency)
export const asyncSource: CascaderDataSource<string> = {
  loadChildren: (parent): Observable<CascaderNode<string>[]> =>
    of(TREE[parent ? parent.value : 'root'] ?? []).pipe(delay(600)),
};

// flat search over the static tree: a depth-first walk collecting every matching path
const searchTree = (query: string): CascaderNode<string>[][] => {
  const results: CascaderNode<string>[][] = [];
  const needle = query.toLowerCase();

  const walk = (key: string, ancestors: CascaderNode<string>[]) => {
    for (const node of TREE[key] ?? []) {
      const path = [...ancestors, node];

      if (node.label.toLowerCase().includes(needle)) {
        results.push(path);
      }

      walk(node.value, path);
    }
  };

  walk('root', []);

  return results;
};

// the sync tree plus a `search` hook — its presence is what enables the panel's search input
export const searchableSource: CascaderDataSource<string> = {
  loadChildren: syncSource.loadChildren,
  search: (query) => of(searchTree(query)).pipe(delay(400)),
};

// a generated six-level hierarchy (region → … → player) for the deep-nesting story — deeper
// than maxVisibleColumns, so older levels collapse into the breadcrumb row
const DEEP_LEVEL_NAMES = ['Region', 'Country', 'League', 'Club', 'Team', 'Player'];

export const deepSource: CascaderDataSource<string> = {
  loadChildren: (parent) => {
    const depth = parent ? parent.value.split('/').length : 0;
    const name = DEEP_LEVEL_NAMES[depth] ?? '';

    return Array.from({ length: 6 }, (_, index) => ({
      value: parent ? `${parent.value}/${index}` : `${index}`,
      label: `${name} ${index + 1}`,
      isLeaf: depth === DEEP_LEVEL_NAMES.length - 1,
    }));
  },
};
