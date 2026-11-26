import { icon, type IconName } from '@system/foundations/icons';
import { BUILD_READY_LABELS, SYSTEM_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

type BlockerKind = 'direct-edit' | 'open-point' | 'embedded' | 'problem' | 'compare' | 'sdk-error' | 'stale-record';

type Blocker = { kind: BlockerKind; text: string; part?: string };

export type BuildReady =
  { state: 'ready' } | { state: 'blocked'; blockers: Blocker[] } | { state: 'checking'; rules: string[] };

type BlockerGroup = { kind: BlockerKind; title: string; icon: IconName; blockers: Blocker[] };

const KINDS: { kind: BlockerKind; title: string; icon: IconName }[] = [
  { kind: 'direct-edit', title: BUILD_READY_LABELS.groups['direct-edit'], icon: 'pencil' },
  { kind: 'open-point', title: SYSTEM_LABELS.openPoints, icon: 'warning' },
  { kind: 'embedded', title: BUILD_READY_LABELS.groups.embedded, icon: 'grid' },
  { kind: 'problem', title: BUILD_READY_LABELS.groups.problem, icon: 'error' },
  { kind: 'compare', title: BUILD_READY_LABELS.groups.compare, icon: 'flow' },
  { kind: 'sdk-error', title: BUILD_READY_LABELS.groups['sdk-error'], icon: 'error' },
  { kind: 'stale-record', title: BUILD_READY_LABELS.groups['stale-record'], icon: 'up-down' },
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
  text: SYSTEM_LABELS.directEdit,
};

export const slowRules = ['APP-SPEC', 'UNCOVERED-REGION', 'VISIBLE-CHANGE'];

export const statusLabel = (status: BuildReady) =>
  status.state === 'ready'
    ? BUILD_READY_LABELS.ready
    : status.state === 'checking'
      ? BUILD_READY_LABELS.checking
      : `Nicht baubereit (${status.blockers.length})`;

export const blockerIcon = (name: IconName) =>
  icon(name, { size: 14, cls: 'flex-none text-(--et-surface-text-muted)' });

export const developerReasons = [
  'injiziert den Service CommandPaletteStore (title-search.component.ts)',
  'routet: nutzt routerLink (title-search.component.html)',
];

export const developerLabel = BUILD_READY_LABELS.developer;
