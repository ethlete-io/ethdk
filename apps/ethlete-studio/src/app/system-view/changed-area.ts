import { Observable } from 'rxjs';
import { SketchAddress, designAnswer$ } from '../../host/design';
import { CanvasFrame, croppedLayoutOf } from '../components/design-canvas/canvas-frame';
import { CanvasNote } from '../components/design-canvas/canvas-note';
import { CanvasColumnGroup } from '../components/design-canvas/design-canvas.component';
import { CompareRect } from './merge-preview';
import { MatrixColumn } from './system-tree';
import { STUDIO_LABELS } from '../i18n/studio-labels';

/** One crop per cluster of the pixels some variants change, and the size of the frame they sit in. */
export type ChangedArea = { frame: { width: number; height: number }; crops: CompareRect[] };

export type ChangedAreaAddress = SketchAddress & {
  variants: string[];
  size?: string | null;
  surface?: string;
  color?: string;
};

const changedAreaUrl = ({ port, product, sketch, variants, size, surface, color }: ChangedAreaAddress) => {
  const query = new URLSearchParams({ product, sketch, variants: variants.join(',') });

  if (size) query.set('size', size);
  if (surface) query.set('surface', surface);
  if (color) query.set('color', color);

  return `http://localhost:${port}/__design/sketch-crop?${query}`;
};

/** The area `variants` change against the product now, at rest; `null` when they change no pixel. */
export const changedArea$ = (address: ChangedAreaAddress): Observable<{ area: ChangedArea | null }> =>
  designAnswer$<{ area: ChangedArea | null }>(changedAreaUrl(address));

/** Whether a round shows only its changed area before the user chose: while its crops cover less than half the frame. */
export const changedAreaShownByDefault = ({ frame, crops }: ChangedArea) =>
  crops.reduce((sum, crop) => sum + crop.width * crop.height, 0) < (frame.width * frame.height) / 2;

/** Every drawn frame of `columns` cropped to each crop of `area`, enlarged up to the frame's width; other frames stay as they are. */
export const croppedFramesOf = (
  frames: CanvasFrame[],
  { columns, area }: { columns: ReadonlySet<string>; area: ChangedArea },
): CanvasFrame[] => {
  const crop = { areas: area.crops, frame: area.frame };
  const { width, height } = croppedLayoutOf(crop);

  return frames.map((frame) =>
    frame.column === undefined ||
    !columns.has(frame.column) ||
    frame.empty !== undefined ||
    frame.error !== undefined ||
    frame.grid !== undefined
      ? frame
      : { ...frame, crop, width, height },
  );
};

/** An open round: the key of its canvas column group and the columns that show it, the current one included. */
export type AreaRound = { key: string; group: string; columns: string[] };

export type ChangedAreaColumn = Omit<MatrixColumn, 'group'> & { group?: CanvasColumnGroup };

const CHANGED_AREA_LABEL = STUDIO_LABELS.changedArea.label;

const switchTitleOf = (on: boolean) => (on ? STUDIO_LABELS.changedArea.showWhole : STUDIO_LABELS.changedArea.showArea);

/**
 * The matrix with each open round cropped to its changed area while that is shown: as the user chose in `choices`, else
 * while the area covers less than half the frame. A round header holds only its title and, with a changed area, the
 * switch; the note of each column hangs below its last frame. `toolbar` is the switch of a sketch whose round has no
 * header.
 */
export const changedAreaViewOf = ({
  frames,
  columns,
  rounds,
  areas,
  choices,
}: {
  frames: CanvasFrame[];
  columns: MatrixColumn[];
  rounds: AreaRound[];
  areas: Record<string, ChangedArea | null>;
  choices: Record<string, boolean>;
}) => {
  const shownOf = (round: AreaRound) => {
    const area = areas[round.key] ?? null;

    return area ? { area, on: choices[round.key] ?? changedAreaShownByDefault(area) } : null;
  };
  const cropped = rounds.reduce((shown, round) => {
    const area = shownOf(round);

    return area?.on ? croppedFramesOf(shown, { columns: new Set(round.columns), area: area.area }) : shown;
  }, frames);
  const lastFrameOf = (column: string) => cropped.filter((frame) => frame.column === column).at(-1);
  const notes: CanvasNote[] = columns.flatMap((column) => {
    const frame = column.note === undefined ? undefined : lastFrameOf(column.key);

    return frame && column.note !== undefined
      ? [{ id: `column note ${column.key}`, text: column.note, frameId: frame.id, everyZoom: true }]
      : [];
  });
  const noted = new Set(notes.map((note) => note.id));
  const switchOf = (group: string) => {
    const round = rounds.find((candidate) => candidate.group === group);
    const area = round && shownOf(round);

    return area ? { label: CHANGED_AREA_LABEL, on: area.on, title: switchTitleOf(area.on) } : undefined;
  };
  const shownColumns = columns.map(({ group, note, ...column }): ChangedAreaColumn => {
    const groupSwitch = group && switchOf(group.key);

    return {
      ...column,
      ...(note === undefined || noted.has(`column note ${column.key}`) ? {} : { note }),
      ...(group
        ? {
            group: {
              key: group.key,
              label: group.label,
              ...(group.title ? { title: group.title } : {}),
              ...(groupSwitch ? { switch: groupSwitch } : {}),
            },
          }
        : {}),
    };
  });
  const headless = rounds.length === 1 && columns.every((column) => column.group === undefined) ? rounds[0] : undefined;
  const toolbarArea = headless && shownOf(headless);

  return {
    frames: cropped,
    columns: shownColumns,
    notes,
    toolbar:
      headless && toolbarArea ? { key: headless.key, on: toolbarArea.on, title: switchTitleOf(toolbarArea.on) } : null,
  };
};
