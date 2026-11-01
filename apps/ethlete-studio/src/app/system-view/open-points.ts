import { OpenPoint } from '../../host/design-open-points';
import { OpenPointGroup, OpenPointIcon } from '../design-parts/system-page/system-page-sample';
import { STUDIO_LABELS } from '../i18n/studio-labels';

const LABELS = STUDIO_LABELS.system;

const ICONS: OpenPointIcon[] = ['grid', 'warning', 'comment', 'error', 'flow'];

const iconOf = (point: OpenPoint): OpenPointIcon => {
  switch (point.kind) {
    case 'missing-state':
    case 'unmerged-sketch':
      return 'grid';
    case 'contrast':
      return 'warning';
    case 'open-comment':
      return 'comment';
    case 'no-go':
    case 'stale-go':
      return 'error';
    case 'missing-motion':
      return 'flow';
  }
};

const lineOf = (point: OpenPoint): OpenPointGroup['lines'][number] => {
  switch (point.kind) {
    case 'missing-state':
      return point.control
        ? { text: LABELS.controlUndrawn(point.control), detail: point.control }
        : { text: LABELS.noControls, detail: 'controls' };
    case 'contrast':
      return { text: LABELS.belowContrast(point.path), detail: point.state };
    case 'open-comment':
      return { text: point.answered ? LABELS.commentAnswered : LABELS.commentWaiting, detail: point.state };
    case 'unmerged-sketch':
      return { text: point.decision === 'pick' ? LABELS.sketchPicked : LABELS.sketchOpen, detail: 'sketch' };
    case 'no-go':
      return { text: LABELS.noGo, detail: 'go' };
    case 'stale-go':
      return { text: LABELS.staleGo, detail: 'go' };
    case 'missing-motion':
      return { text: `${point.from} → ${point.to}`, detail: 'motion' };
  }
};

/** The open points of a part grouped by icon, in the order the chip popover lists them. */
export const openPointGroupsOf = (points: OpenPoint[]): OpenPointGroup[] =>
  ICONS.flatMap((icon) => {
    const lines = points.filter((point) => iconOf(point) === icon).map(lineOf);

    return lines.length > 0 ? [{ icon, lines }] : [];
  });
