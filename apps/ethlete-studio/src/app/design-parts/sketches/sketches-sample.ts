import { AgentLogoName } from '../../icons/agent-logos';
import { PartTreeLayer } from '../part-tree/part-tree.component';

export type SketchVariant = {
  key: string;
  label: string;
  note: string;
  author?: { name: string; agent: AgentLogoName };
};

export type SketchRound = { value: string; label: string };

export type SketchPin = {
  variant: string;
  author: string;
  initials: string;
  agent?: AgentLogoName;
  count: number;
};

export const SKETCH_CURRENT = 'current';

export const SKETCH_VARIANTS: SketchVariant[] = [
  { key: SKETCH_CURRENT, label: 'Aktuell', note: 'Panel 248 px, offen' },
  { key: 'a', label: 'a', note: 'Panel ausgeblendet', author: { name: 'Claude', agent: 'claude' } },
  { key: 'b', label: 'b', note: 'Panel 200 px', author: { name: 'Codex', agent: 'codex' } },
];

export const SKETCH_ROUNDS: SketchRound[] = [{ value: 'round-1', label: 'Runde 1 · Mehr Platz für die Leinwand' }];

export const SKETCH_PINS: SketchPin[] = [{ variant: 'a', author: 'Tom Bornholdt', initials: 'TB', count: 1 }];

export const SKETCH_TREE: PartTreeLayer[] = [
  { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true }] },
  { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true, selected: true }] },
];
