import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CascaderDataSource, CascaderNode } from '@ethlete/components';

const TREE: Record<string, CascaderNode<string>[]> = {
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

export const competitions: CascaderDataSource<string> = {
  loadChildren: (parent) => of(TREE[parent ? parent.value : 'root'] ?? []).pipe(delay(600)),
};
