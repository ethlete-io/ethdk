import { icon, type IconName } from '@system/foundations/icons';
import { STUDIO_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/studio-labels';

type BlockerKind = 'direct-edit' | 'open-point' | 'embedded' | 'problem' | 'compare' | 'sdk-error' | 'stale-record';

type Blocker = { kind: BlockerKind; text: string; part?: string };

export type BuildReady =
  { state: 'ready' } | { state: 'blocked'; blockers: Blocker[] } | { state: 'checking'; rules: string[] };

type BlockerGroup = { kind: BlockerKind; title: string; icon: IconName; blockers: Blocker[] };

const KINDS: { kind: BlockerKind; title: string; icon: IconName }[] = [
  { kind: 'direct-edit', title: STUDIO_LABELS.buildReady.groups['direct-edit'], icon: 'pencil' },
  { kind: 'open-point', title: STUDIO_LABELS.system.openPoints, icon: 'warning' },
  { kind: 'embedded', title: STUDIO_LABELS.buildReady.groups.embedded, icon: 'grid' },
  { kind: 'problem', title: STUDIO_LABELS.buildReady.groups.problem, icon: 'error' },
  { kind: 'compare', title: STUDIO_LABELS.buildReady.groups.compare, icon: 'flow' },
  { kind: 'sdk-error', title: STUDIO_LABELS.buildReady.groups['sdk-error'], icon: 'error' },
  { kind: 'stale-record', title: STUDIO_LABELS.buildReady.groups['stale-record'], icon: 'up-down' },
];

export const blockerGroupsOf = (blockers: Blocker[]): BlockerGroup[] =>
  KINDS.flatMap(({ kind, ...rest }) => {
    const ofKind = blockers.filter((blocker) => blocker.kind === kind);
    return ofKind.length > 0 ? [{ kind, ...rest, blockers: ofKind }] : [];
  });

export const embeddedBlocker: Blocker = {
  kind: 'embedded',
  text: 'components/badge ist nicht baubereit',
  part: 'components/badge',
};

export const hardcodedColourBlocker: Blocker = {
  kind: 'problem',
  text: 'HARDCODED-COLOR: button.component.css',
};

export const manyBlockers = (openCount: number): Blocker[] => [
  { kind: 'open-point', text: `${openCount} offene Punkte und Ausnahmen` },
  embeddedBlocker,
  { kind: 'problem', text: 'APP-SPEC: button.component.spec.ts schlägt fehl' },
  { kind: 'compare', text: 'hover weicht vom Design ab' },
];

export const directEditBlocker: Blocker = {
  kind: 'direct-edit',
  text: STUDIO_LABELS.system.directEdit,
};

export const slowRules = ['APP-SPEC', 'UNCOVERED-REGION', 'VISIBLE-CHANGE'];

export const statusLabel = (status: BuildReady) =>
  status.state === 'ready'
    ? STUDIO_LABELS.buildReady.ready
    : status.state === 'checking'
      ? STUDIO_LABELS.buildReady.checking
      : `Nicht baubereit (${status.blockers.length})`;

export const blockerIcon = (name: IconName) =>
  icon(name, { size: 14, cls: 'flex-none text-(--et-surface-color-muted-solid)' });

export const developerReasons = [
  'injiziert den Service CommandPaletteStore (title-search.component.ts)',
  'routet: nutzt routerLink (title-search.component.html)',
];

export const developerLabel = STUDIO_LABELS.buildReady.developer;

export type AgentProgress =
  | { state: 'working'; doing: string; detail: string }
  | { state: 'waiting'; detail: string }
  | { state: 'interrupted'; detail: string }
  | { state: 'failed'; detail: string };

export type AgentState = AgentProgress['state'];

export const agentSamples: Record<AgentState, AgentProgress> = {
  working: { state: 'working', doing: 'behebt', detail: 'APP-SPEC in button.component.spec.ts' },
  waiting: { state: 'waiting', detail: 'auf deine Antwort im Kommentar zu outline' },
  interrupted: { state: 'interrupted', detail: 'Sitzung beendet, bevor hover fertig war' },
  failed: { state: 'failed', detail: 'tsc meldet 2 Fehler in system.ts' },
};

export const agentLabel = (progress: AgentProgress) =>
  progress.state === 'working'
    ? `Agent ${progress.doing}`
    : progress.state === 'waiting'
      ? STUDIO_LABELS.buildReady.agent.waiting
      : progress.state === 'interrupted'
        ? STUDIO_LABELS.buildReady.agent.interrupted
        : STUDIO_LABELS.buildReady.agent.failed;

export const agentOnReadyPart: AgentProgress = {
  state: 'working',
  doing: 'zeichnet',
  detail: 'einen Sketch für den Zustand pressed',
};
