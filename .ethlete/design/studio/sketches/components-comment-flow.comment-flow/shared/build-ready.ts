import { html } from '@design-system';
import { icon, type IconName } from '@system/foundations/icons';
import { agentLogo } from '@system/foundations/agent-logos';
import { checkIcon } from '@shared/open-points';

type BlockerKind = 'direct-edit' | 'open-point' | 'embedded' | 'problem' | 'compare' | 'sdk-error' | 'stale-record';

type Blocker = { kind: BlockerKind; text: string; part?: string };

export type BuildReady =
  { state: 'ready' } | { state: 'blocked'; blockers: Blocker[] } | { state: 'checking'; rules: string[] };

type BlockerGroup = { kind: BlockerKind; title: string; icon: IconName; blockers: Blocker[] };

const KINDS: { kind: BlockerKind; title: string; icon: IconName }[] = [
  { kind: 'direct-edit', title: 'Direkte Änderung', icon: 'pencil' },
  { kind: 'open-point', title: 'Offene Punkte', icon: 'warning' },
  { kind: 'embedded', title: 'Eingebettete Teile', icon: 'grid' },
  { kind: 'problem', title: 'Regeln', icon: 'error' },
  { kind: 'compare', title: 'Vergleich mit der App', icon: 'flow' },
  { kind: 'sdk-error', title: 'SDK-Fehler', icon: 'error' },
  { kind: 'stale-record', title: 'Prüfstand', icon: 'up-down' },
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
  text: 'Bild ohne Sketch geändert',
};

export const slowRules = ['APP-SPEC', 'UNCOVERED-REGION', 'VISIBLE-CHANGE'];

export const statusLabel = (status: BuildReady) =>
  status.state === 'ready'
    ? 'Baubereit'
    : status.state === 'checking'
      ? 'Wird geprüft'
      : `Nicht baubereit (${status.blockers.length})`;

const pendingRing = html`<span
  class="block size-3.5 flex-none rounded-full border-2 border-(--et-surface-border-solid) border-t-(--et-surface-color-muted-solid)"
  aria-hidden="true"
></span>`;

export const statusIcon = (status: BuildReady) =>
  status.state === 'ready'
    ? checkIcon()
    : status.state === 'checking'
      ? pendingRing
      : `<span class="contents" data-et-semantic-color="warning">${icon('warning', { size: 16, cls: 'flex-none text-et-theme' })}</span>`;

export const blockerIcon = (name: IconName) =>
  icon(name, { size: 14, cls: 'flex-none text-(--et-surface-color-muted-solid)' });

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
      ? 'Agent wartet'
      : progress.state === 'interrupted'
        ? 'Agent unterbrochen'
        : 'Agent fehlgeschlagen';

export const agentOnReadyPart: AgentProgress = {
  state: 'working',
  doing: 'zeichnet',
  detail: 'einen Sketch für den Zustand pressed',
};

export const agentMark = (progress: AgentProgress) =>
  progress.state === 'failed'
    ? `<span class="contents" data-et-semantic-color="error">${icon('error', { size: 14, cls: 'flex-none text-et-theme' })}</span>`
    : progress.state === 'interrupted'
      ? icon('minimize', { size: 14, cls: 'flex-none text-(--et-surface-color-muted-solid)' })
      : agentLogo('claude', 'flex-none size-3.5');
