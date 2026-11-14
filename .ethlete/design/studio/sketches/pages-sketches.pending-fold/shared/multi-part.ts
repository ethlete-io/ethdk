export type MultiPart = 'closed' | 'open';

export const MULTI_PART = {
  title: 'Kopf-Tags in einem Stil',
  targets: ['components/badge', 'components/sketch-status-badge', 'elements/variant-cell'],
};

export const partsLabel = (count: number) => `${count} Teile`;

export type MultiTargets = 'three' | 'many';

const MANY_TARGETS = [
  ...MULTI_PART.targets,
  'components/chip',
  'components/tree-row',
  'elements/part-tree',
  'pages/sketches',
  'pages/merge',
];

export const targetsOf = (count: MultiTargets) => (count === 'many' ? MANY_TARGETS : MULTI_PART.targets);
