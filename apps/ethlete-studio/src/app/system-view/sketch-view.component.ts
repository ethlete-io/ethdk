import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
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
  concatMap,
  distinctUntilChanged,
  filter,
  finalize,
  fromEvent,
  groupBy,
  map,
  merge,
  mergeMap,
  of,
  scan,
  share,
  switchMap,
  tap,
} from 'rxjs';
import { FrameMessage, followedSizes, frameMessageOf } from '../components/design-canvas/canvas-frame';
import { Camera } from '../components/design-canvas/canvas-math';
import {
  ListedComment,
  ListedPart,
  ListedProduct,
  ListedSketch,
  MergeNeedsRebaseError,
  SketchAddress,
  decideSketch$,
  discardSketch$,
  mergeSketch$,
  sketchPreview$,
} from '../../host/design';
import { MergeComponent } from '../design-parts/merge/merge.component';
import { MergeRow, MergeTarget, MergeUnchanged } from '../design-parts/merge/merge-sample';
import { SketchesComponent } from '../design-parts/sketches/sketches.component';
import { SketchHold, SketchIdle, SketchPin, SketchRow, SketchStatus } from '../design-parts/sketches/sketches-sample';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { SketchViewPick, rememberSketchView, rememberedView } from '../studio-view/remembered';
import { isInSketch } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { modelNameOf, senderOf } from './inbox-comments';
import { MergeColumn, mergeFrameIdOf, partNameOf, sketchCompare$ } from './merge-preview';
import { refusalMessageOf } from './inventory';
import { PageShell, PageShellAction } from './page-shell';
import {
  NO_SKETCH_FRAME_RETRIES,
  SketchFrameEvent,
  erroredVariantsOf,
  retriedSrcOf,
  sketchFrameRetriesWith,
} from './sketch-frame-retries';
import {
  CURRENT,
  mergePreviewOf,
  partKeyOf,
  pickedVariantOf,
  sketchMatrixOf,
  sketchRoundsOf,
  sketchRowsOf,
  sketchUsingPagesOf,
} from './system-tree';

type Busy = 'merge' | 'discard';

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

type FrameSize = { width?: number; height?: number };

const MEASURING_HEIGHT = 150;

type Mode = 'sketches' | 'merge';

const minutesSince = (at: number) => Math.max(0, Math.round((Date.now() - at) / 60_000));

const FALLBACK_SIZE = { width: 1440, height: 900 };

@Component({
  selector: 'ethlete-sketch-view',
  template: `
    @if (mode() === 'merge' && mergeVariant()) {
      <ethlete-merge
        [target]="mergeTarget()"
        [changed]="changed()"
        [selected]="selected()"
        [unchangedStates]="unchangedStates()"
        [error]="mergeError()"
        [merging]="busy() === 'merge'"
        [shotTemplate]="mergeShot"
        [shell]="shell()"
        (pick)="pickRow($event)"
        (back)="showSketches()"
        (merge)="merge(mergeVariant()!)"
        (shellAction)="shellAction.emit($event)"
        class="h-full!"
      />
    } @else {
      <ethlete-sketches
        [(sameOpen)]="sameOpen"
        [part]="sketch().target"
        [rows]="rows()"
        [fresh]="!part()"
        [status]="sketchStatus()"
        [idle]="lastChange()"
        [hold]="held()"
        [drawn]="drawnVariant()"
        [rounds]="rounds()"
        [round]="shownRoundKey()"
        [pins]="variantPins()"
        [selected]="picked() ?? undefined"
        [errored]="erroredVariants()"
        [error]="mergeError()"
        [shot]="shot"
        [tree]="shell().tree"
        [shell]="shell()"
        [restoredCamera]="openedCamera()"
        (cameraChange)="cameraChange.emit($event)"
        (discard)="discard()"
        (merge)="openMerge($event)"
        (roundChange)="pickRound($event)"
        (pinToggle)="shellAction.emit({ kind: 'section', section: 'Inbox' })"
        (expandedChange)="expandedChange.emit($event)"
        (pick)="shellAction.emit({ kind: 'pick', key: $event })"
        (shellAction)="shellAction.emit($event)"
        class="h-full!"
      />
    }

    <ng-template #mergeShot let-row let-src="src">
      @if (shotSources().get(src); as safe) {
        <iframe
          [src]="safe"
          [title]="row.part + ' ' + row.state"
          [style.width.px]="row.width"
          [style.height.px]="row.height"
          class="block border-0 scheme-normal"
        ></iframe>
      }
    </ng-template>

    <ng-template #shot let-row let-state="state">
      @if (rowShots().get(row.key + ' ' + state); as src) {
        <iframe
          #shotFrame
          [src]="src"
          [title]="row.key + ' ' + state"
          [attr.data-variant]="row.key"
          [attr.data-state]="state"
          class="block size-full border-0 scheme-normal"
        ></iframe>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SketchesComponent, MergeComponent],
  host: { class: 'block size-full' },
})
export class SketchViewComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);
  private document = inject(DOCUMENT);
  private commentStore = injectCommentStore();
  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public sketch = input.required<ListedSketch>();
  public part = input<ListedPart | null>(null);
  public epoch = input(0);
  public revision = input(0);
  public changes = input(0);
  public view = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public cameraKey = input<string | null>(null);
  public restoredCamera = input<Camera | null>(null);
  public shell = input.required<PageShell>();
  public shellAction = output<PageShellAction>();
  public cameraChange = output<Camera | null>();

  public expandedChange = output<readonly string[]>();

  public decide = output<void>();

  /** Whether a merge of this sketch runs. */
  public merging = output<boolean>();

  /** The sketch's target once its merge succeeded. */
  public mergeComplete = output<string>();

  private shotFrames = viewChildren<ElementRef<HTMLIFrameElement>>('shotFrame');

  private safeUrls = new Map<string, SafeResourceUrl>();

  protected busy = signal<Busy | null>(null);

  protected picked = computed(() => pickedVariantOf(this.sketch()));

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

  private openRounds = linkedSignal(() =>
    this.remembered().roundsFor === this.sketch().createdAt ? (this.remembered().rounds ?? {}) : {},
  );

  private shownRounds = computed(() => sketchRoundsOf(this.sketch(), { openRounds: this.openRounds() }));

  protected rounds = computed(() =>
    this.shownRounds()
      .map((round, index) => ({ round, index }))
      .filter(({ round }) => round.variants.length > 0)
      .map(({ round, index }) => ({
        value: round.key,
        label: STUDIO_LABELS.sketches.round(index + 1, round.title),
      })),
  );

  protected mode = linkedSignal<Mode>(() => (this.remembered().merge ? 'merge' : 'sketches'));

  protected mergeVariant = linkedSignal<string | null>(() => this.picked());

  protected mergeError = linkedSignal<string | null, string | null>({
    source: this.mergeVariant,
    computation: () => null,
  });

  private previewReading = toSignal(
    toObservable(
      computed(() => ({ address: this.address(), variant: this.mergeVariant(), revision: this.revision() })),
    ).pipe(
      switchMap(({ address, variant }) =>
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a missing preview reading renders as the existing empty preview
        variant ? sketchPreview$({ ...address, variant }).pipe(catchError(() => of(null))) : of(null),
      ),
    ),
    { initialValue: null },
  );

  private drawsAnyPart = computed(() => {
    const preview = this.previewReading();

    return (preview?.changed.length ?? 0) + (preview?.affected.length ?? 0) > 0;
  });

  private compareReading = toSignal(
    toObservable(
      computed(() => ({
        address: this.address(),
        variant: this.mergeVariant(),
        on: this.mode() === 'merge' && this.drawsAnyPart(),
        surface: this.surface(),
        color: this.color(),
        revision: this.revision(),
      })),
    ).pipe(
      switchMap(({ address, variant, on, surface, color }) =>
        variant && on
          ? // eslint-disable-next-line ethlete/no-silent-catch-error -- a missing comparison renders as the existing empty comparison
            sketchCompare$({ ...address, variant, surface, color }).pipe(catchError(() => of(null)))
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected mergeTarget = computed<MergeTarget>(() => {
    const part = this.sketch().target;
    const variant = this.mergeVariant() ?? '';

    return { part, name: partNameOf(part), variant, note: this.sketch().variantInfo?.[variant]?.note ?? '' };
  });

  protected changed = computed<MergeRow[]>(() => {
    const rows = this.compareReading()?.changed ?? [];
    const variant = this.mergeVariant();

    if (!variant || rows.length === 0) return [];

    const frames = mergePreviewOf({
      port: this.port(),
      product: this.product(),
      sketch: this.sketch(),
      variant,
      affected: [...new Set(rows.map((row) => row.part))],
      rows,
      epoch: this.epoch(),
      revision: this.revision(),
      view: this.view(),
      surface: this.surface(),
      color: this.color(),
    }).frames;
    const frameOf = (place: { column: MergeColumn; part: string; state: string }) =>
      frames.find((frame) => frame.id === mergeFrameIdOf(place));

    return rows.map(({ part, state, outlines, missing }) => {
      const now = frameOf({ column: 'now', part, state });
      const after = frameOf({ column: 'merged', part, state });
      const size = now ?? after;

      return {
        part,
        state,
        instances: outlines.merged.length || outlines.now.length || 1,
        width: size?.width ?? FALLBACK_SIZE.width,
        height: size?.height ?? FALLBACK_SIZE.height,
        now: now?.src ?? '',
        after: after?.src ?? '',
        missing: missing === 'merged' ? 'after' : missing,
        crop: { now: outlines.now[0] ?? null, after: outlines.merged[0] ?? null },
      };
    });
  });

  protected unchangedStates = computed<MergeUnchanged>(() => {
    const rows = this.compareReading()?.unchanged ?? [];
    const part = rows[0]?.part ?? '';

    return { part, states: rows.filter((row) => row.part === part).map((row) => row.state) };
  });

  protected selected = linkedSignal({ source: this.changed, computation: () => 0 });

  protected shotSources = computed(
    () =>
      new Map(
        this.changed().flatMap((row) =>
          [row.now, row.after].filter(Boolean).map((src) => [src, this.safeUrlOf(src)] as const),
        ),
      ),
  );

  protected shownRoundKey = computed(() => this.shownRounds().find((round) => round.open)?.key ?? '');

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
      view: this.view(),
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
      view: this.view(),
      surface: this.surface(),
      color: this.color(),
    }),
  );

  private measured = toSignal(
    fromEvent<MessageEvent>(this.document.defaultView ?? [], 'message').pipe(
      map((event) => ({ shot: this.shotShowing(event.source), message: frameMessageOf(event.data) })),
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

  protected rows = computed<SketchRow[]>(() => {
    const sketch = this.sketch();
    const measured = this.measured();

    return this.sketchRows().map((row) => {
      const author = row.key === CURRENT ? undefined : sketch.variantInfo?.[row.key]?.authors?.[0];
      const agent = author ? senderOf('agent', author).agent : undefined;
      const sizeOf = (state: string) => measured[`${row.key} ${state}`];
      const when = sketch.report?.variant === row.key ? whenOf(sketch.report.updatedAt) : undefined;

      return {
        key: row.key,
        note: row.key === CURRENT ? '' : (sketch.variantInfo?.[row.key]?.note ?? ''),
        ...(author && agent
          ? { model: { short: modelNameOf(author), id: author, agent, ...(when ? { when } : {}) } }
          : {}),
        width: row.width ?? widestOf(row.shots.map((shot) => sizeOf(shot.state)?.width)) ?? FALLBACK_SIZE.width,
        shots: row.shots.map(({ state, changed }) => ({
          state,
          changed,
          height: sizeOf(state)?.height ?? MEASURING_HEIGHT,
        })),
      };
    });
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
        map(({ shot, message }): SketchFrameEvent => ({ kind: 'report', shot, errored: !!message.errored })),
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

  protected rowShots = computed(() => {
    const { retry } = this.frameRetries();

    return new Map<string, SafeResourceUrl>(
      this.sketchRows().flatMap((row) =>
        row.shots.map((shot) => {
          const key = `${row.key} ${shot.state}`;

          return [key, this.safeUrlOf(retriedSrcOf(shot.src, retry[key]))] as const;
        }),
      ),
    );
  });

  private newestAuthor = computed(() => {
    const { variants, variantInfo } = this.sketch();

    return variants
      .map((variant) => variantInfo?.[variant]?.authors?.[0])
      .filter(Boolean)
      .at(-1);
  });

  protected lastChange = computed<SketchIdle>(() => {
    const report = this.sketch().report;
    const at = report ? Date.parse(report.updatedAt) : NaN;
    const author = report?.author ?? this.newestAuthor();

    return {
      by: author ? modelNameOf(author) : '',
      since: Number.isNaN(at) ? '' : STUDIO_LABELS.sketches.since(minutesSince(at)),
    };
  });

  protected held = computed<SketchHold>(() => {
    const hold = this.sketch().hold;
    const at = hold ? Date.parse(hold.heldAt) : NaN;
    const by = hold?.by ?? '';

    return {
      until: hold?.until ?? '',
      by: { short: by ? modelNameOf(by) : '', id: by, agent: senderOf('agent', by).agent ?? 'claude' },
      since: Number.isNaN(at) ? '' : STUDIO_LABELS.sketches.since(minutesSince(at)),
    };
  });

  protected sameOpen = signal(false);

  protected drawnVariant = computed(() => this.matrix().columns.find((column) => column.drawing)?.key ?? null);

  protected sketchStatus = computed<SketchStatus>(() => {
    if (this.drawnVariant() !== null) return 'drawing';
    if (this.sketch().hold) return 'paused';

    return this.sketch().status === 'ready' ? 'waiting' : 'idle';
  });

  private contextPages = computed(
    () =>
      new Set(sketchUsingPagesOf({ product: this.product(), sketch: this.sketch(), part: this.part() }).map(partKeyOf)),
  );

  private sketchComments = computed(() =>
    this.commentStore
      .comments()
      .filter((comment) => isInSketch(comment, { sketch: this.sketch(), contextPages: this.contextPages() })),
  );

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
        },
      ];
    }),
  );

  /** Shows the round of the comment's variant. */
  public jumpTo(comment: ListedComment) {
    const variant = comment.sketch?.variant;
    const other = this.shownRounds().find((round) => !round.open && variant && round.variants.includes(variant));

    if (other) this.pickRound(other.key);
  }

  protected pickRound(key: string) {
    const rounds = Object.fromEntries(this.shownRounds().map((round) => [round.key, round.key === key]));

    this.openRounds.set(rounds);
    this.remember({ rounds, roundsFor: this.sketch().createdAt });
  }

  protected openMerge(variant: string) {
    this.mergeVariant.set(variant);
    this.showMode('merge');
  }

  protected showSketches() {
    this.mergeVariant.set(this.picked());
    this.showMode('sketches');
  }

  protected pickRow(key: string) {
    const index = this.changed().findIndex((row) => `${row.part} ${row.state}` === key);

    if (index >= 0) this.selected.set(index);
  }

  protected merge(variant: string) {
    const address = this.address();

    if (this.busy()) return;

    this.merging.emit(true);
    this.mergeError.set(null);
    this.run(
      'merge',
      decideSketch$(address, { kind: 'pick', variant }).pipe(
        concatMap(() => mergeSketch$(address)),
        tap(() => this.mergeComplete.emit(address.sketch)),
        catchError((error: unknown) => {
          this.mergeError.set(
            error instanceof MergeNeedsRebaseError
              ? STUDIO_LABELS.merge.needsRebase(error.changed)
              : refusalMessageOf(error),
          );

          return of(null);
        }),
        finalize(() => this.merging.emit(false)),
      ),
    );
  }

  protected discard() {
    this.run('discard', discardSketch$(this.address()));
  }

  private safeUrlOf(src: string) {
    let safe = this.safeUrls.get(src);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(src);
      this.safeUrls.set(src, safe);
    }
    return safe;
  }

  private shotShowing(source: MessageEventSource | null) {
    const frame = this.shotFrames()
      .map(({ nativeElement }) => nativeElement)
      .find((candidate) => source !== null && candidate.contentWindow === source);

    return frame ? `${frame.dataset['variant']} ${frame.dataset['state']}` : null;
  }

  private showMode(mode: Mode) {
    this.mode.set(mode);
    this.remember({ merge: mode === 'merge' });
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
        finalize(() => {
          this.busy.set(null);
          this.decide.emit();
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
