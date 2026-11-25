import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  viewChild,
  viewChildren,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  Observable,
  catchError,
  distinctUntilChanged,
  filter,
  fromEvent,
  groupBy,
  map,
  merge,
  mergeMap,
  of,
  scan,
  share,
  tap,
} from 'rxjs';
import { FrameMessage, followedSizes, frameMessageOf } from '../components/design-canvas/canvas-frame';
import { createElementDimensions } from '@ethlete/core';
import { Camera } from '../components/design-canvas/canvas-math';
import {
  ListedComment,
  ListedPart,
  ListedProduct,
  ListedSketch,
  MergeNeedsRebaseError,
  SketchAddress,
  discardSketch$,
  pickSketch$,
  rejectionOf,
  saveListWidth,
  sketchPartOf,
} from '../../host/design';
import { SketchesComponent } from '../design-parts/sketches/sketches.component';
import {
  SketchAgentRun,
  SketchHold,
  SketchMergePort,
  SketchModel,
  SketchComment,
  SketchCommentDraft,
  SketchCommentPlace,
  SketchConfirm,
  SketchPin,
  SketchRow,
  SketchStatus,
  SketchWithdrawn,
} from '../design-parts/sketches/sketches-sample';
import { SKETCHES_LABELS, MERGE_LABELS } from '../i18n/sketches-labels';
import { SketchViewPick, rememberSketchView, rememberedView } from '../studio-view/remembered';
import { isInSketch } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { inboxCommentOf, modelNameOf, senderOf } from './inbox-comments';
import { refusalMessageOf } from './inventory';
import { FrameShieldComponent } from '../components/design-canvas/partials/frame-shield.component';
import { FramePaintedDirective } from '../components/design-canvas/partials/frame-painted';
import { ShotRankDirective } from '../components/design-canvas/partials/shot-rank';
import { PageShell, PageShellAction } from './page-shell';
import {
  NO_SKETCH_FRAME_RETRIES,
  SketchFrameEvent,
  erroredVariantsOf,
  sketchRenderOf,
  retriedSrcOf,
  sketchFrameRetriesWith,
} from './sketch-frame-retries';
import {
  CURRENT,
  partKeyOf,
  sketchMatrixOf,
  sketchRoundsOf,
  sketchRowsOf,
  sketchUsingPagesOf,
  variantSubPartsOf,
} from './system-tree';
import { rowWidthOf, shotSizesOf } from './shot-frames';
import { partOpenPoints$ } from '../../host/design-open-points';
import { keptRead$ } from './kept-read';
import { sketchPointGroupsOf } from './open-points';
import { undecidedShotsOf } from './undecided-shots';
import { OpenPointGroup, OpenPointTarget } from '../design-parts/system-page/system-page-sample';

type Busy = 'merge' | 'discard';

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

type FrameSize = { width?: number; height?: number };

const MEASURING_HEIGHT = 150;

const minutesSince = (at: number) => Math.max(0, Math.round((Date.now() - at) / 60_000));

const sketchModelOf = (author: string): SketchModel => ({
  short: author ? modelNameOf(author) : '',
  id: author,
  agent: senderOf('agent', author).agent ?? 'generic',
});

const FALLBACK_SIZE = { width: 1440, height: 900 };

const LIVE_SHOT_CAP = 12;

type ShotRect = { left: number; top: number; right: number; bottom: number };

/** The keys of the cells whose rect meets `viewport`, each with its centre's distance from the viewport's centre. */
export const nearShotsOf = ({
  cells,
  viewport,
}: {
  cells: readonly { key: string; rect: ShotRect }[];
  viewport: ShotRect;
}) => {
  const centre = { x: (viewport.left + viewport.right) / 2, y: (viewport.top + viewport.bottom) / 2 };

  return new Map(
    cells
      .filter(
        ({ rect }) =>
          rect.right > viewport.left &&
          rect.left < viewport.right &&
          rect.bottom > viewport.top &&
          rect.top < viewport.bottom,
      )
      .map(({ key, rect }) => [
        key,
        Math.hypot((rect.left + rect.right) / 2 - centre.x, (rect.top + rect.bottom) / 2 - centre.y),
      ]),
  );
};

const rectOf = (element: HTMLElement): ShotRect =>
  createElementDimensions(element).rect?.() ?? { left: 0, top: 0, right: 0, bottom: 0 };

const stateOfShot = (key: string) => key.slice(key.indexOf(' ') + 1);

/**
 * The keys that stay live frames, whole states at a time so no state mixes live frames and pictures: the states with a
 * key in `near` (key to distance from the view), up to `cap` keys, a state with a `painted` key first and one whose keys
 * all hold a picture (`pictured`) last, nearest first within a rank; plus every state with a `painted` key without a
 * picture, near or not, so no cell that showed its frame goes empty before its picture can take its place. The nearest
 * state alone may pass the cap.
 */
export const liveShotsOf = ({
  order,
  near,
  cap = LIVE_SHOT_CAP,
  pictured = new Set(),
  painted = new Set(),
}: {
  order: readonly string[];
  near: ReadonlyMap<string, number>;
  cap?: number;
  pictured?: ReadonlySet<string>;
  painted?: ReadonlySet<string>;
}) => {
  const rank = (key: string) => (pictured.has(key) ? 2 : painted.has(key) ? 0 : 1);
  const states = new Map<string, string[]>();

  order.forEach((key) => states.set(stateOfShot(key), [...(states.get(stateOfShot(key)) ?? []), key]));

  const ranked = [...states.values()]
    .flatMap((keys) => {
      const distances = keys.flatMap((key) => (near.has(key) ? [near.get(key) ?? 0] : []));

      return distances.length ? [{ keys, rank: Math.min(...keys.map(rank)), distance: Math.min(...distances) }] : [];
    })
    .sort((a, b) => a.rank - b.rank || a.distance - b.distance);
  const live = new Set<string>();

  ranked.forEach(({ keys }) => {
    if (live.size > 0 && live.size + keys.length > cap) return;
    keys.forEach((key) => live.add(key));
  });
  states.forEach((keys) => {
    if (keys.some((key) => painted.has(key) && !pictured.has(key))) keys.forEach((key) => live.add(key));
  });

  return order.filter((key) => live.has(key));
};

/** Whether a painted frame shows what its picture shows: as wide as its cell, its document scrolled to the top. */
export const frameFitsCell = ({
  cellWidth,
  frameWidth,
  viewportWidth,
  scrollY = 0,
  scrollX = 0,
}: {
  cellWidth: number;
  frameWidth: number;
  viewportWidth?: number;
  scrollY?: number;
  scrollX?: number;
}) =>
  Math.abs(frameWidth - cellWidth) <= 1 &&
  (viewportWidth === undefined || Math.abs(viewportWidth - cellWidth) <= 1) &&
  scrollY === 0 &&
  scrollX === 0;

type FrameReport = {
  cellWidth: number;
  frameWidth: number;
  viewportWidth?: number;
  scrollY?: number;
  scrollX?: number;
};

const scrollOf = (data: unknown) =>
  typeof data === 'object' &&
  data !== null &&
  'type' in data &&
  data.type === 'design-explore:scroll' &&
  'y' in data &&
  typeof data.y === 'number'
    ? { scrollY: data.y, ...('x' in data && typeof data.x === 'number' ? { scrollX: data.x } : {}) }
    : null;

@Component({
  selector: 'ethlete-sketch-view',
  template: `
    <ethlete-sketches
      [(sameOpen)]="sameOpen"
      [(statesOpen)]="statesOpen"
      [(withdrawn)]="withdrawn"
      [(wholeScreens)]="wholeScreens"
      [(draftText)]="commentStore.draftText"
      [(confirm)]="confirm"
      [part]="sketch().target"
      [rows]="rows()"
      [fresh]="!part()"
      [autoMerge]="sketch().autoMergeForecast?.merges === true"
      [merging]="busy() === 'merge'"
      [status]="sketchStatus()"
      [readyReason]="readyReason()"
      [hold]="held()"
      [agent]="agentRun()"
      [port]="mergePort()"
      [drawn]="drawnVariant()"
      [rounds]="rounds()"
      [round]="shownRoundKey()"
      [pins]="variantPins()"
      [selected]="taken() ?? undefined"
      [openPoints]="openPointGroups()"
      [errored]="erroredVariants()"
      [error]="mergeError()"
      [listError]="listError()"
      [comments]="sketchCommentRows()"
      [selectedComment]="jumpedCommentId()"
      [commentMode]="commentStore.active()"
      [commentDraft]="sketchDraft()"
      [sendPhase]="commentStore.sendPhase()"
      [sendReason]="commentStore.sendReason()"
      [loadingShots]="loadingShots()"
      [shot]="shot"
      [tree]="shell().tree"
      [shell]="shell()"
      [restoredCamera]="openedCamera()"
      [live]="activeShot() !== null"
      (commentModeChange)="commentStore.toggle()"
      (commentStart)="startComment($event)"
      (commentCancel)="commentStore.cancel()"
      (sendComment)="commentStore.send($event)"
      (commentPick)="pickComment($event)"
      (retry)="retry.emit()"
      (frameActivate)="activeShot.set($event)"
      (cameraChange)="camera.set($event); cameraChange.emit($event)"
      (moving)="moving.set($event)"
      (listWidthChange)="saveListWidth($event)"
      (discard)="discard()"
      (merge)="merge($event)"
      (roundChange)="pickRound($event)"
      (pinToggle)="shellAction.emit({ kind: 'section', section: 'Inbox' })"
      (expandedChange)="expandedChange.emit($event)"
      (pick)="shellAction.emit({ kind: 'pick', key: $event })"
      (openPoint)="openPoint.emit($event)"
      (shellAction)="shellAction.emit($event)"
      class="h-full!"
    />

    <ng-template #shot let-row let-state="state">
      @let key = row.key + ' ' + state;
      <div
        #shotCell
        [attr.data-shot]="key"
        [attr.data-active]="activeShot() === key ? '' : null"
        [class.pointer-events-auto]="activeShot() === key"
        class="relative size-full"
      >
        @if (shotPictures().get(key); as picture) {
          @let shown = loadedPictures().get(key);
          @if (shown && shown !== picture) {
            <img
              [src]="shown"
              [alt]="key"
              [class.opacity-0]="paintedShots().has(key)"
              class="absolute top-0 left-0 block max-w-full"
            />
          }
          <img
            [src]="picture"
            [ethleteShotRank]="picture"
            [alt]="key"
            [class.opacity-0]="paintedShots().has(key)"
            [class.hidden]="failedPictures().has(picture)"
            (load)="pictureLoaded({ key, picture, event: $event })"
            (error)="pictureFailed(picture)"
            class="block max-w-full"
            data-shot-picture
          />
        }
        @if (liveShots().has(key)) {
          @let srcs = frameSrcs().get(key) ?? [];
          @for (frame of srcs; track frame.url) {
            <iframe
              #shotFrame
              [src]="frame.src"
              [ethleteFramePainted]="frame.src"
              [title]="key"
              [attr.data-variant]="row.key"
              [attr.data-state]="state"
              [attr.data-painted]="paintedFrames().get(key)?.frame === shotFrame ? '' : null"
              [class.opacity-0]="paintedFrames().get(key)?.frame !== shotFrame"
              (paintedChange)="framePainted({ key, frame: shotFrame, url: frame.url, painted: $event })"
              class="absolute inset-0 block size-full border-0 scheme-normal"
            ></iframe>
          }
          @if (srcs.length && activeShot() !== key) {
            <ethlete-frame-shield class="pointer-events-auto" />
          }
        }
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SketchesComponent, FrameShieldComponent, ShotRankDirective, FramePaintedDirective],
  host: { class: 'block size-full' },
})
export class SketchViewComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);
  private document = inject(DOCUMENT);
  public commentStore = injectCommentStore();
  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public sketch = input.required<ListedSketch>();
  public part = input<ListedPart | null>(null);
  public epoch = input(0);
  public revision = input(0);
  public variantRevisions = input<Record<string, number>>({});
  public currentRevision = input(0);
  public changes = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public cameraKey = input<string | null>(null);
  public restoredCamera = input<Camera | null>(null);
  public shell = input.required<PageShell>();
  public listError = input<string | null>(null);
  public retry = output();
  public shellAction = output<PageShellAction>();
  public openPoint = output<OpenPointTarget>();
  public cameraChange = output<Camera | null>();

  public expandedChange = output<readonly string[]>();

  public decide = output<void>();

  /** Whether a merge of this sketch runs. */
  public merging = output<boolean>();

  /** The sketch's target once its merge succeeded. */
  public mergeComplete = output<string>();
  public discardComplete = output<string>();

  private shotFrames = viewChildren<ElementRef<HTMLIFrameElement>>('shotFrame');

  private sketches = viewChild(SketchesComponent);

  private shotCellRefs = viewChildren<ElementRef<HTMLElement>>('shotCell');

  protected camera = signal<Camera | null>(null);

  public moving = signal(false);

  public nearShots = computed(() => {
    this.camera();
    this.moving();

    const canvas = this.sketches()?.viewport();

    if (!canvas) {
      return new Map<string, number>();
    }

    const cells = this.shotCellRefs().map((ref) => ({
      key: ref.nativeElement.dataset['shot'] ?? '',
      rect: rectOf(ref.nativeElement),
    }));

    return nearShotsOf({ cells, viewport: rectOf(canvas) });
  });

  private sketchDir = computed(() => this.sketch().dir);

  private pictureSizes = linkedSignal<string, Record<string, { width: number; height: number }>>({
    source: this.sketchDir,
    computation: () => ({}),
  });

  private safeUrls = new Map<string, SafeResourceUrl>();

  public busy = signal<Busy | null>(null);

  private sketchTarget = computed(() => this.sketch().target);

  protected taken = linkedSignal<string, string | null>({
    source: this.sketchTarget,
    computation: () => null,
  });

  protected openedCamera = computed(() => {
    this.cameraKey();

    return untracked(this.restoredCamera);
  });

  private address = computed<SketchAddress>(() => ({
    port: this.port(),
    product: this.product().name,
    sketch: this.sketch().target,
  }));

  private remembered = linkedSignal<string | null, SketchViewPick>({
    source: this.cameraKey,
    computation: (key) => (key === null ? {} : (rememberedView().sketchViews?.[key] ?? {})),
  });

  private openRoundsSource = computed(() =>
    this.remembered().roundsFor === this.sketch().createdAt ? (this.remembered().rounds ?? {}) : {},
  );

  private openRounds = linkedSignal(this.openRoundsSource);

  private shownRounds = computed(() => sketchRoundsOf(this.sketch(), { openRounds: this.openRounds() }));

  protected rounds = computed(() =>
    this.shownRounds()
      .map((round, index) => ({ round, index }))
      .filter(({ round }) => round.variants.length > 0)
      .map(({ round, index }) => ({
        value: round.key,
        label: SKETCHES_LABELS.round(index + 1, round.title),
        note: round.note,
      })),
  );

  protected mergeError = linkedSignal<string, string | null>({
    source: this.sketchTarget,
    computation: () => null,
  });

  public shownRoundKey = computed(() => this.shownRounds().find((round) => round.open)?.key ?? '');

  private matrix = computed(() =>
    sketchMatrixOf({
      port: this.port(),
      now: Date.now(),
      product: this.product(),
      part: this.part(),
      sketch: this.sketch(),
      openRounds: this.openRounds(),
      epoch: this.epoch(),
      revision: this.revision(),
      surface: this.surface(),
      color: this.color(),
    }),
  );

  private sketchRows = computed(() =>
    sketchRowsOf({
      port: this.port(),
      product: this.product(),
      part: this.part(),
      sketch: this.sketch(),
      variants: this.shownRounds().flatMap((round) => (round.open ? round.variants : [])),
      epoch: this.epoch(),
      revision: this.revision(),
      variantRevisions: this.variantRevisions(),
      currentRevision: this.currentRevision(),
      surface: this.surface(),
      color: this.color(),
    }),
  );

  private reportedFrames = linkedSignal<string, ReadonlyMap<string, { frame: HTMLIFrameElement; url: string }>>({
    source: this.sketchDir,
    computation: () => new Map(),
  });

  private frameReports = toSignal(
    fromEvent<MessageEvent>(this.document.defaultView ?? [], 'message').pipe(
      scan((reports: ReadonlyMap<HTMLIFrameElement, FrameReport>, event) => {
        const frame = this.shotFrameOf(event.source);
        const message = frameMessageOf(event.data);
        const scroll = scrollOf(event.data);
        const viewportWidth = message?.type === 'height' ? message.viewport?.width : undefined;

        if (!frame || (scroll === null && viewportWidth === undefined)) return reports;

        const mounted = new Set(this.shotFrames().map(({ nativeElement }) => nativeElement));
        const next = new Map([...reports].filter(([known]) => mounted.has(known)));

        return next.set(frame, {
          ...reports.get(frame),
          cellWidth: frame.parentElement?.clientWidth ?? 0,
          frameWidth: frame.clientWidth,
          ...scroll,
          ...(viewportWidth === undefined ? {} : { viewportWidth }),
        });
      }, new Map()),
    ),
    { initialValue: new Map<HTMLIFrameElement, FrameReport>() },
  );

  protected paintedFrames = computed(() => {
    const reports = this.frameReports();

    return new Map(
      [...this.reportedFrames()].filter(([, { frame }]) => {
        const report = reports.get(frame);

        return !report || frameFitsCell(report);
      }),
    );
  });

  protected paintedShots = computed(() => {
    const mounted = new Set(this.shotFrames().map(({ nativeElement }) => nativeElement));

    return new Set([...this.paintedFrames()].flatMap(([key, { frame }]) => (mounted.has(frame) ? [key] : [])));
  });

  private measuredBySketch = toSignal(
    fromEvent<MessageEvent>(this.document.defaultView ?? [], 'message').pipe(
      map((event) => {
        const shot = this.shotShowing(event.source);

        return {
          shot: shot === null ? null : `${this.sketch().dir}\n${shot}`,
          message: frameMessageOf(event.data),
        };
      }),
      filter(
        (report): report is { shot: string; message: HeightMessage } =>
          report.shot !== null && report.message?.type === 'height',
      ),
      groupBy(({ shot }) => shot),
      mergeMap((reports$) => {
        const shared$ = reports$.pipe(share());

        return merge(
          shared$.pipe(
            map(({ message }) => ({ size: message.height, viewport: message.viewport?.height })),
            followedSizes,
            map((height): FrameSize => ({ height })),
          ),
          shared$.pipe(
            filter(({ message }) => message.width !== undefined),
            map(({ message }) => ({ size: message.width ?? 0, viewport: message.viewport?.width })),
            followedSizes,
            map((width): FrameSize => ({ width })),
          ),
        ).pipe(map((size) => ({ shot: reports$.key, size })));
      }),
      scan((sizes: Record<string, FrameSize>, { shot, size }) => {
        const known = sizes[shot];

        return Object.entries(size).every(([side, value]) => known?.[side as keyof FrameSize] === value)
          ? sizes
          : { ...sizes, [shot]: { ...known, ...size } };
      }, {}),
      distinctUntilChanged(),
    ),
    { initialValue: {} as Record<string, FrameSize> },
  );

  private measured = computed(() => {
    const prefix = `${this.sketchDir()}\n`;

    return Object.fromEntries(
      Object.entries(this.measuredBySketch()).flatMap(([key, size]) =>
        key.startsWith(prefix) ? [[key.slice(prefix.length), size] as const] : [],
      ),
    );
  });

  private frameRetries = toSignal(
    merge(
      toObservable(computed(() => this.sketch().target)).pipe(map((): SketchFrameEvent => ({ kind: 'reset' }))),
      toObservable(this.changes).pipe(map((seq): SketchFrameEvent => ({ kind: 'change', seq }))),
      fromEvent<MessageEvent>(this.document.defaultView ?? [], 'message').pipe(
        map((event) => ({ shot: this.shotShowing(event.source), message: frameMessageOf(event.data) })),
        filter(
          (report): report is { shot: string; message: HeightMessage } =>
            report.shot !== null && report.message?.type === 'height',
        ),
        map(({ shot, message }): SketchFrameEvent => ({
          kind: 'report',
          shot,
          errored: !!message.errored,
          ...(message.error ? { error: message.error } : {}),
        })),
      ),
    ).pipe(scan(sketchFrameRetriesWith, NO_SKETCH_FRAME_RETRIES)),
    { initialValue: NO_SKETCH_FRAME_RETRIES },
  );

  protected erroredVariants = computed(() => {
    return erroredVariantsOf({
      rows: this.sketchRows(),
      failing: this.frameRetries().failing,
      targets: this.sketch().targets,
    });
  });

  private renderState = computed(() =>
    sketchRenderOf({
      rows: this.sketchRows(),
      retries: this.frameRetries(),
      mounted: this.shotFrames().map(
        ({ nativeElement }) => `${nativeElement.dataset['variant']} ${nativeElement.dataset['state']}`,
      ),
      targets: this.sketch().targets,
    }),
  );

  private rowShots = computed(() => {
    const { retry } = this.frameRetries();

    return new Map<string, string>(
      this.sketchRows().flatMap((row) =>
        row.shots.map((shot) => {
          const key = `${row.key} ${shot.state}`;

          return [key, retriedSrcOf(shot.src, retry[key])] as const;
        }),
      ),
    );
  });

  protected frameSrcs = computed(() => {
    const painted = this.paintedShots();
    const frames = this.paintedFrames();

    return new Map(
      [...this.rowShots()].map(([key, url]) => {
        const shown = painted.has(key) ? frames.get(key)?.url : undefined;

        return [
          key,
          (shown && shown !== url ? [shown, url] : [url]).map((frame) => ({ url: frame, src: this.safeUrlOf(frame) })),
        ] as const;
      }),
    );
  });

  private newestAuthor = computed(() => {
    const { variants, variantInfo } = this.sketch();

    return variants
      .map((variant) => variantInfo?.[variant]?.authors?.[0])
      .filter(Boolean)
      .at(-1);
  });

  protected held = computed<SketchHold>(() => {
    const hold = this.sketch().hold;
    const at = hold ? Date.parse(hold.heldAt) : NaN;

    return {
      until: hold?.until ?? '',
      since: Number.isNaN(at) ? '' : SKETCHES_LABELS.since(minutesSince(at)),
    };
  });

  protected sameOpen = signal(false);

  protected statesOpen = signal(false);

  protected withdrawn = signal<SketchWithdrawn>('hidden');

  protected wholeScreens = signal<readonly string[]>([]);

  protected drawnVariant = computed(() => this.matrix().columns.find((column) => column.drawing)?.key ?? null);

  protected rows = computed<SketchRow[]>(() => {
    const sketch = this.sketch();
    const measured = shotSizesOf({
      rows: this.sketchRows(),
      part: sketchPartOf(sketch),
      frames: sketch.shotFrames,
      live: this.measured(),
    });
    const pictures = this.pictureSizes();
    const sizes = Object.entries(measured);
    const tallestOf = (state?: string) =>
      widestOf(
        sizes.filter(([key]) => state === undefined || key.endsWith(` ${state}`)).map(([, size]) => size.height),
      );
    const tallest = tallestOf();
    const partWidth = widestOf(sizes.map(([, size]) => size.width));

    const unreported = new Set(
      this.drawnVariant() === null || !sketch.rounds?.length
        ? []
        : (sketchRoundsOf(sketch).at(-1)?.variants ?? []).filter(
            (variant) => !sketch.variantInfo?.[variant]?.authors?.length,
          ),
    );

    return this.sketchRows().map((row) => {
      const author = row.key === CURRENT ? undefined : sketch.variantInfo?.[row.key]?.authors?.[0];
      const agent = author ? senderOf('agent', author).agent : undefined;
      const sizeOf = (state: string) => measured[`${row.key} ${state}`];
      const when = sketch.report?.variant === row.key ? whenOf(sketch.report.updatedAt) : undefined;

      const known = row.width ?? rowWidthOf({ row, sizes: measured, fallback: partWidth });
      const width = known ?? FALLBACK_SIZE.width;

      const rejection = row.key === CURRENT ? null : rejectionOf(sketch, row.key);
      const subParts = row.key === CURRENT ? [] : variantSubPartsOf(sketch, row.key);

      return {
        key: row.key,
        note: row.key === CURRENT ? '' : (sketch.variantInfo?.[row.key]?.note ?? ''),
        ...(subParts.length > 0 ? { subParts } : {}),
        ...(row.key === this.drawnVariant() || unreported.has(row.key) ? { drawing: true as const } : {}),
        ...(rejection?.status === 'withdrawn' ? { withdrawn: rejection.reason ?? '' } : {}),
        ...(author && agent
          ? { model: { short: modelNameOf(author), id: author, agent, ...(when ? { when } : {}) } }
          : {}),
        width,
        ...(row.perLine ? { perLine: row.perLine } : {}),
        sized: known !== undefined,
        shots: row.shots.map(({ state, changed, change, width: presetWidth, height: presetHeight, ...shot }) => {
          const picture = pictures[`${row.key} ${state}`];
          const measured = sizeOf(state)?.width;
          const measuredWidth = measured === undefined || row.width === null ? measured : Math.max(measured, width);
          const shownWidth = presetWidth ?? (presetHeight === undefined ? (measuredWidth ?? width) : width);

          return {
            state,
            changed,
            ...(change ? { change } : {}),
            ...(shot.sameAsRest ? { sameAsRest: true } : {}),
            ...(shot.restOf ? { restOf: shot.restOf } : {}),
            ...(shot.inherited ? { inherited: true as const } : {}),
            ...(presetWidth !== undefined ? { width: presetWidth } : {}),
            ...(presetHeight === undefined && measuredWidth !== undefined && measuredWidth !== width
              ? { width: measuredWidth }
              : {}),
            height:
              (presetHeight === undefined ? undefined : Math.max(presetHeight, sizeOf(state)?.height ?? 0)) ??
              sizeOf(state)?.height ??
              (picture
                ? Math.round((picture.height * Math.min(picture.width, shownWidth)) / picture.width)
                : (tallestOf(state) ?? tallest ?? MEASURING_HEIGHT)),
          };
        }),
      };
    });
  });

  protected agentRun = computed<SketchAgentRun | null>(() => {
    const report = this.sketch().report;
    const at = report ? Date.parse(report.updatedAt) : NaN;
    const minutes = Number.isNaN(at) ? null : minutesSince(at);
    const labels = SKETCHES_LABELS.agentRun;

    if (report && this.drawnVariant() !== null)
      return {
        by: sketchModelOf(report.author ?? ''),
        since: minutes === null ? '' : SKETCHES_LABELS.since(minutes),
      };

    const errored = this.erroredVariants();

    if (errored.length === 0) return null;

    const round = this.shownRounds().findIndex((entry) => entry.open);

    return {
      by: sketchModelOf(report?.author ?? this.newestAuthor() ?? ''),
      since: minutes === null ? '' : labels.ago(minutes),
      failure: labels.failed(round < 0 ? null : round + 1),
    };
  });

  protected mergePort = computed<SketchMergePort | null>(() => {
    const mark = this.sketch().portAfterMerge;

    if (!mark) return null;

    const at = Date.parse(mark.at);

    return { merged: mark.merged, since: Number.isNaN(at) ? '' : SKETCHES_LABELS.since(minutesSince(at)) };
  });

  protected readyReason = computed(() =>
    this.renderState().state === 'failed' ? SKETCHES_LABELS.agentRun.errors(this.renderState().errors) : null,
  );

  protected sketchStatus = computed<SketchStatus>(() => {
    if (this.drawnVariant() !== null) return 'drawing';
    if (this.sketch().hold) return 'paused';

    if (this.sketch().status !== 'ready' || this.sketch().readyRefusal) return 'not-ready';
    if (this.renderState().state === 'failed') return 'failed';
    if (this.renderState().state === 'drawing') return 'drawing';

    return 'waiting';
  });

  private openPointReads = toSignal(
    toObservable(
      computed(() => {
        const { port, product, sketch } = this.address();

        return this.taken() === null ? null : { address: { port, product }, part: sketch, revision: this.revision() };
      }),
    ).pipe(
      keptRead$({
        read: (asked) =>
          asked ? partOpenPoints$(asked.address, asked.part).pipe(map(sketchPointGroupsOf)) : of<OpenPointGroup[]>([]),
        empty: [] as OpenPointGroup[],
        subjectOf: (asked) => asked && `${asked.address.port}/${asked.address.product}/${asked.part}`,
      }),
    ),
    { initialValue: null },
  );

  protected openPointGroups = computed(() => this.openPointReads()?.items ?? []);

  private contextPages = computed(
    () =>
      new Set(sketchUsingPagesOf({ product: this.product(), sketch: this.sketch(), part: this.part() }).map(partKeyOf)),
  );

  protected jumpedCommentId = signal<string | null>(null);

  private sketchComments = computed(() =>
    [
      ...this.commentStore.comments(),
      ...this.commentStore
        .resolved()
        .filter(
          (comment) => comment.id === this.jumpedCommentId() || comment.sketch?.createdAt === this.sketch().createdAt,
        ),
    ].filter((comment) => isInSketch(comment, { sketch: this.sketch(), contextPages: this.contextPages() })),
  );

  protected confirm = linkedSignal<SketchConfirm | null>(() => {
    this.sketchTarget();

    return null;
  });

  protected sketchCommentRows = computed<SketchComment[] | null>(() => {
    if (!this.commentStore.loaded()) return null;

    const now = Date.now();
    const userName = this.commentStore.userName();
    const labels = new Map(this.rows().map((row) => [row.key, row.label ?? row.key]));

    return this.sketchComments().flatMap((comment) => {
      const variant = comment.sketch?.variant;

      return variant
        ? [
            {
              ...inboxCommentOf(comment, { now, userName }),
              part: labels.get(variant) ?? variant,
              variant,
              shot: this.shotOfPlace(variant, comment),
              point: comment.point ?? null,
            },
          ]
        : [];
    });
  });

  protected sketchDraft = computed<SketchCommentDraft | null>(() => {
    const draft = this.commentStore.draft();
    const variant = draft?.place.sketch?.variant;

    if (!draft || !variant || draft.place.sketch?.target !== this.sketch().target) return null;

    return {
      variant,
      shot: this.shotOfPlace(variant, draft.place),
      point: draft.point,
      ...senderOf('user', undefined),
    };
  });

  protected variantPins = computed<SketchPin[]>(() =>
    this.rows().flatMap(({ key }) => {
      const comments = this.sketchComments().filter((comment) => comment.sketch?.variant === key);
      const first = comments[0];

      if (!first) return [];

      const last = first.replies.at(-1);
      const sender = senderOf(last?.by ?? 'user', last?.author);

      return [
        {
          variant: key,
          author: sender.author,
          initials: sender.initials,
          ...(sender.agent ? { agent: sender.agent } : {}),
          count: comments.reduce((count, comment) => count + 1 + comment.replies.length, 0),
          ...(comments.every((comment) => comment.resolved) ? { resolved: true } : {}),
        },
      ];
    }),
  );

  protected failedPictures = signal<ReadonlySet<string>>(new Set());

  protected loadedPictures = linkedSignal<string, ReadonlyMap<string, string>>({
    source: this.sketchDir,
    computation: () => new Map(),
  });

  private undecidedShots = computed(() => {
    if (this.sketch().problems !== undefined || this.listError() !== null) return new Set<string>();

    const shown = new Set([...this.paintedShots(), ...this.loadedPictures().keys()]);

    return new Set([...undecidedShotsOf(this.sketchRows())].filter((key) => !shown.has(key)));
  });

  protected shotPictures = computed(() => {
    const undecided = this.undecidedShots();

    return new Map(
      this.sketchRows().flatMap((row) =>
        row.shots.flatMap((shot) => {
          const key = `${row.key} ${shot.state}`;

          return undecided.has(key) ? [] : [[key, shot.picture] as const];
        }),
      ),
    );
  });

  protected activeShot = linkedSignal<string, string | null>({ source: this.sketchDir, computation: () => null });

  private currentLiveShots = computed(() => {
    const live =
      this.sketch().targets === undefined && this.listError() === null
        ? []
        : liveShotsOf({
            order: this.sketchRows()
              .flatMap((row) => row.shots.map((shot) => `${row.key} ${shot.state}`))
              .filter((key) => !this.undecidedShots().has(key)),
            near: this.nearShots(),
            pictured: new Set(this.loadedPictures().keys()),
            painted: this.paintedShots(),
          });
    const active = this.activeShot();

    return new Set(active ? [...live, active] : live);
  });

  protected liveShots = linkedSignal<{ now: Set<string>; moving: boolean }, Set<string>>({
    source: () => ({ now: this.currentLiveShots(), moving: this.moving() }),
    computation: ({ now, moving }, previous) => (moving && previous ? previous.value : now),
  });

  protected loadingShots = computed(() => {
    const live = this.liveShots();
    const painted = this.paintedFrames();
    const loaded = this.loadedPictures();
    const failed = this.failedPictures();

    return new Set(
      [...this.shotPictures()]
        .filter(([key, picture]) => !loaded.has(key) && !painted.has(key) && (live.has(key) || !failed.has(picture)))
        .map(([key]) => key),
    );
  });

  private pendingPart = linkedSignal<string, string | null>({
    source: this.sketchTarget,
    computation: () => null,
  });

  constructor() {
    effect(() => {
      const part = this.pendingPart();

      if (part !== null && this.focusPart(part)) this.pendingPart.set(null);
    });

    fromEvent<MessageEvent>(this.document.defaultView ?? [], 'message')
      .pipe(
        filter(
          (event) => this.shotFrameOf(event.source) !== undefined && frameMessageOf(event.data)?.type === 'escape',
        ),
        tap(() => this.activeShot.set(null)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected startComment({ variant, shot, point }: SketchCommentPlace) {
    const target = this.sketch().target;
    const preset = this.sketchRows()
      .find((candidate) => candidate.key === variant)
      ?.shots.find((candidate) => candidate.state === shot)?.place;
    const size =
      preset?.size === undefined ? 'fitted' : this.sketch().layer === 'pages' ? preset.size : Number(preset.size);

    this.commentStore.start({
      frameId: `${variant} ${shot}`,
      place: { part: target, state: preset?.state ?? shot, size, sketch: { target, variant } },
      point,
    });
  }

  protected pickComment(id: string) {
    const comment = this.sketchComments().find((candidate) => candidate.id === id);

    if (comment) this.jumpTo(comment);
  }

  /** Shows the round of the comment's variant. */
  public jumpTo(comment: ListedComment) {
    const variant = comment.sketch?.variant;

    this.jumpedCommentId.set(comment.id);
    if (variant) this.showVariant(variant);
  }

  /** Moves the canvas onto the first frame of `part`, once the view draws one. */
  public showPart(part: string) {
    this.pendingPart.set(this.focusPart(part) ? null : part);
  }

  public showVariant(variant: string) {
    const other = this.shownRounds().find((round) => !round.open && round.variants.includes(variant));

    if (other) this.pickRound(other.key);
  }

  protected pickRound(key: string) {
    const rounds = Object.fromEntries(this.shownRounds().map((round) => [round.key, round.key === key]));

    this.openRounds.set(rounds);
    this.remember({ rounds, roundsFor: this.sketch().createdAt });
  }

  protected merge(variant: string) {
    const address = this.address();

    if (this.busy()) return;

    this.taken.set(variant);
    this.merging.emit(true);
    this.mergeError.set(null);
    this.run(
      'merge',
      pickSketch$(address, variant).pipe(
        tap(({ subSketches }) => {
          if (subSketches.length === 0) this.mergeComplete.emit(address.sketch);
        }),
        catchError((error: unknown) => {
          this.mergeError.set(
            error instanceof MergeNeedsRebaseError ? MERGE_LABELS.needsRebase(error.changed) : refusalMessageOf(error),
          );

          return of(null);
        }),
        tap({ complete: () => this.merging.emit(false) }),
      ),
    );
  }

  protected saveListWidth(width: number) {
    void saveListWidth(this.port(), width);
  }

  protected discard() {
    const address = this.address();

    this.run('discard', discardSketch$(address).pipe(tap(() => this.discardComplete.emit(address.sketch))));
  }

  protected framePainted({
    key,
    frame,
    url,
    painted,
  }: {
    key: string;
    frame: HTMLIFrameElement;
    url: string;
    painted: boolean;
  }) {
    this.reportedFrames.update((frames) => {
      if (!painted && frames.get(key)?.frame !== frame) return frames;

      const next = new Map(frames);

      if (painted) next.set(key, { frame, url });
      else next.delete(key);

      return next;
    });
  }

  protected pictureFailed(picture: string) {
    this.failedPictures.update((failed) => new Set(failed).add(picture));
  }

  protected pictureLoaded({ key, picture, event }: { key: string; picture: string; event: Event }) {
    const { naturalWidth, naturalHeight } = event.target as HTMLImageElement;

    if (naturalWidth > 0 && this.loadedPictures().get(key) !== picture)
      this.loadedPictures.update((loaded) => new Map(loaded).set(key, picture));
    const known = this.pictureSizes()[key];

    if (naturalWidth === 0 || (known?.width === naturalWidth && known.height === naturalHeight)) return;

    this.pictureSizes.update((sizes) => ({ ...sizes, [key]: { width: naturalWidth, height: naturalHeight } }));
  }

  private focusPart(part: string) {
    const sketch = this.sketch();
    const partOf = (state: string) =>
      sketch.targetParts?.find((target) => state.startsWith(`${target} `)) ?? sketchPartOf(sketch);
    const keys = this.rows().flatMap((row) =>
      row.shots.filter((shot) => partOf(shot.state) === part).map((shot) => `${row.key} ${shot.state}`),
    );
    const key = keys.find((candidate) => !candidate.startsWith(`${CURRENT} `)) ?? keys[0];

    if (key === undefined) return false;

    return this.sketches()?.focusFrame(key) ?? false;
  }

  private shotOfPlace(variant: string, place: { state: string; size?: string | number }) {
    const shots = this.sketchRows().find((row) => row.key === variant)?.shots ?? [];

    return (
      shots.find((shot) => shot.place.state === place.state && shot.place.size === String(place.size))?.state ??
      place.state
    );
  }

  private safeUrlOf(src: string) {
    let safe = this.safeUrls.get(src);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(src);
      this.safeUrls.set(src, safe);
    }
    return safe;
  }

  private shotFrameOf(source: MessageEventSource | null) {
    return this.shotFrames()
      .map(({ nativeElement }) => nativeElement)
      .find((candidate) => source !== null && candidate.contentWindow === source);
  }

  private shotShowing(source: MessageEventSource | null) {
    const frame = this.shotFrameOf(source);

    return frame ? `${frame.dataset['variant']} ${frame.dataset['state']}` : null;
  }

  private remember(pick: SketchViewPick) {
    const key = this.cameraKey();

    if (key !== null) rememberSketchView(key, pick);
  }

  private run(busy: Busy, work$: Observable<unknown>) {
    if (this.busy()) return;

    this.busy.set(busy);
    this.mergeError.set(null);

    work$
      .pipe(
        catchError((error: unknown) => {
          this.mergeError.set(refusalMessageOf(error));

          return of(null);
        }),
        tap({
          complete: () => {
            this.busy.set(null);
            this.decide.emit();
          },
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

const widestOf = (widths: (number | undefined)[]) => {
  const known = widths.filter((width) => width !== undefined);

  return known.length > 0 ? Math.max(...known) : undefined;
};

const whenOf = (iso: string) => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return undefined;

  const two = (value: number) => String(value).padStart(2, '0');

  return `${two(date.getDate())}.${two(date.getMonth() + 1)}. ${two(date.getHours())}:${two(date.getMinutes())}`;
};
