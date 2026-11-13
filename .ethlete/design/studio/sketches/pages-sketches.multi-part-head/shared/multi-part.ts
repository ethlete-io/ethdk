export type MultiPart = 'closed' | 'open';

export const MULTI_PART = {
  title: 'Kopf-Tags in einem Stil',
  targets: ['components/badge', 'components/sketch-status-badge', 'elements/variant-cell'],
};

export const partsLabel = (count: number) => `${count} Teile`;
