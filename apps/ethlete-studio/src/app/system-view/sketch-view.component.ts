import {
  Component,
  DestroyRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import {
  Observable,
  catchError,
  combineLatest,
  concatMap,
  finalize,
  from,
  map,
  of,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import {
  ListedPart,
  ListedProduct,
  ListedSketch,
  MergeNeedsRebaseError,
  MergePreview,
  SketchAddress,
  SketchReport,
  decideSketch$,
  discardSketch$,
  mergeSketch$,
  sketchPreview$,
} from '../../host/design';
import { SketchViewPick, rememberSketchView, rememberedView } from '../studio-view/remembered';
import { Camera } from '../components/design-canvas/canvas-math';
import { REST } from '../components/design-canvas/canvas-frame';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { FramePoint } from '../components/design-canvas/canvas-pin';
import { CommentDraftComponent } from './comment-draft.component';
import { CommentThreadComponent } from './comment-thread.component';
import {
  NumberedComment,
  commentDraftOf,
  commentsOfPart,
  isInSketch,
  otherSizeFrameOf,
  pinsOf,
  withOtherSizeNotes,
} from './comment-pins';
import { injectCommentStore } from './comment-store';
import { DiffLine, diffLinesOf, diffOutlineOf, diffSummaryOf, variantDiff$ } from './variant-diff';
import { AreaRound, ChangedArea, changedArea$, changedAreaViewOf } from './changed-area';
import {
  SketchCompare,
  comparingTextOf,
  mergeOutlinesOf,
  partNameOf,
  sketchCompare$,
  unchangedLinesOf,
  whileWaiting$,
} from './merge-preview';
import {
  ALL,
  CURRENT,
  canPick,
  mergePreviewOf,
  pickedVariantOf,
  rejectedLabelOf,
  reportExpiryOf,
  roundColumnKeyOf,
  sketchMatrixOf,
  openRoundsOf,
  stateRowKeyOf,
  sketchRoundsOf,
  partKeyOf,
  usingPagesOf,
} from './system-tree';

type Busy = 'pick' | 'merge' | 'discard' | 'verdict';

type Shown = 'matrix' | 'merge';

type PreviewReading = { preview: MergePreview | null; error: string | null };

type CompareReading = { compare: SketchCompare | null; error: string | null; seconds?: number };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Component({
  selector: 'ethlete-sketch-view',
  template: `
    <ng-template #pinThread let-pin>
      <ethlete-comment-thread [commentId]="pin.id" />
    </ng-template>

    @let shown = sketch();
    <header class="flex items-center gap-3 border-b border-surface-border px-4 py-3">
      <div class="min-w-0 flex-1">
        <span class="font-mono text-small text-[var(--et-surface-color-subtle-solid)]">
          Sketch · {{ shown.product }}
        </span>
        <h2 class="truncate text-h4">{{ shown.target }}</h2>
      </div>
      <ng-content />
      <span
        [class]="
          shown.status === 'in progress'
            ? 'border-accent text-accent'
            : 'border-surface-border text-[var(--et-surface-color-subtle-solid)]'
        "
        class="whitespace-nowrap rounded-full border px-2 font-mono text-small"
      >
        {{ shown.status }}
      </span>
    </header>

    <section class="flex flex-col gap-2 border-b border-surface-border px-4 py-3 text-small" aria-label="Decision">
      <div class="flex flex-wrap gap-3" role="group" aria-label="Variants">
        @for (variant of shown.variants; track variant) {
          @let rejected = rejectedLabels()[variant];
          <div
            [class.opacity-60]="rejected"
            [attr.data-rejected-variant]="rejected ? variant : null"
            class="flex max-w-80 flex-col gap-1"
          >
            @if (rejected) {
              <span class="font-semibold" data-rejected-reason>{{ variant }} · {{ rejected.text }}</span>
              <span class="text-[var(--et-surface-color-subtle-solid)]" data-rejected-by>{{ rejected.by }}</span>
              <div class="flex gap-1">
                <button
                  [disabled]="busy() !== null"
                  [title]="'Make ' + variant + ' pickable again; the note, if any, is the reason'"
                  (click)="judge('reopen', variant)"
                  et-button
                  type="button"
                  variant="outline"
                  color="surface"
                  size="sm"
                  data-reopen
                >
                  Reopen {{ variant }}
                </button>
                @if (note().trim()) {
                  <button
                    [disabled]="busy() !== null"
                    (click)="judge('reason', variant)"
                    et-button
                    type="button"
                    variant="transparent"
                    color="surface"
                    size="sm"
                    data-reject-reason
                  >
                    Note as reason
                  </button>
                }
              </div>
            } @else {
              <div class="flex gap-1">
                <button
                  [pressed]="variant === picked()"
                  [disabled]="busy() !== null || !pickable(variant)"
                  [title]="pickTitle(variant)"
                  (click)="pick(variant)"
                  et-button
                  type="button"
                  variant="outline"
                  color="surface"
                  pressedColor="inherit"
                  size="sm"
                  data-pick
                >
                  {{ variant === picked() ? 'Picked ' + variant : 'Pick ' + variant }}
                </button>
                <button
                  [disabled]="busy() !== null"
                  [title]="'Reject ' + variant + '; the note, if any, is the reason'"
                  (click)="judge('reject', variant)"
                  et-button
                  type="button"
                  variant="transparent"
                  color="surface"
                  size="sm"
                  data-reject
                >
                  Reject
                </button>
              </div>
            }
            @if (diffSummaries()[variant]; as summary) {
              @if (summary.listed.length === 0) {
                <span class="text-[var(--et-surface-color-subtle-solid)]" data-variant-diff-summary>{{
                  summary.text
                }}</span>
              } @else {
                <button
                  [attr.aria-expanded]="openDiffs()[variant] === true"
                  (click)="toggleDiffs(variant)"
                  class="justify-start"
                  et-button
                  type="button"
                  variant="transparent"
                  color="surface"
                  size="xs"
                  data-variant-diff-summary
                >
                  {{ summary.text }}
                </button>
                @if (openDiffs()[variant]) {
                  <div class="flex max-h-48 flex-col overflow-y-auto">
                    @for (line of summary.listed; track line.state) {
                      @if (line.box) {
                        <button
                          [pressed]="isMarked(variant, line)"
                          [title]="'Mark the changed pixels of ' + line.state + ' on its frame'"
                          (click)="toggleMark(variant, line)"
                          class="justify-start font-mono"
                          et-button
                          type="button"
                          variant="transparent"
                          color="surface"
                          pressedColor="inherit"
                          size="xs"
                          data-variant-diff
                        >
                          {{ line.text }}
                        </button>
                      } @else {
                        <span
                          [title]="line.title ?? ''"
                          class="font-mono text-[var(--et-surface-color-subtle-solid)]"
                          data-variant-diff
                          >{{ line.text }}</span
                        >
                      }
                    }
                  </div>
                }
              }
            }
            @for (problem of problemsOf(variant); track $index) {
              <span
                [title]="problem.file"
                [etProvideColor]="errorTheme()"
                class="text-[var(--et-theme-color-primary-solid)]"
              >
                {{ problem.rule }}: {{ problem.message }}
              </span>
            }
          </div>
        }
      </div>

      @if (shown.status === 'in progress') {
        <p class="text-[var(--et-surface-color-subtle-solid)]">
          Not ready yet. You can pick once the agent marks the sketch ready.
        </p>
      }

      @if (picked(); as variant) {
        @if (previewReading(); as reading) {
          @if (reading.error) {
            <p [etProvideColor]="errorTheme()" class="text-[var(--et-theme-color-primary-solid)]">
              {{ reading.error }}
            </p>
          } @else if (reading.preview; as preview) {
            <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
              <dt class="text-[var(--et-surface-color-subtle-solid)]">Merging {{ variant }} changes</dt>
              <dd class="font-mono">{{ preview.changed.join(', ') || 'nothing' }}</dd>
              <dt class="text-[var(--et-surface-color-subtle-solid)]">Shown in</dt>
              <dd class="font-mono">{{ preview.affected.join(', ') || 'no element or page' }}</dd>
            </dl>
          }
        }
      }

      <div class="flex items-end gap-2">
        <et-form-field class="min-w-0 flex-1" appearance="box">
          <et-label>Note</et-label>
          <et-input
            [(value)]="note"
            placeholder="Optional - why this shape; the variant's own note stays without one"
          />
        </et-form-field>
        <button
          [disabled]="busy() !== null || !picked()"
          [loading]="busy() === 'merge'"
          (click)="merge()"
          et-button
          type="button"
          variant="outline"
          color="surface"
          size="sm"
          data-merge
        >
          Merge {{ picked() ?? '' }}
        </button>
        <button
          [disabled]="busy() !== null"
          (click)="discard()"
          et-button
          type="button"
          variant="transparent"
          color="surface"
          size="sm"
          data-discard
        >
          {{ confirmingDiscard() ? 'Discard all variants?' : 'Discard sketch' }}
        </button>
        @if (productCommentCount(); as count) {
          <button
            (click)="partOpen.emit()"
            et-button
            type="button"
            variant="transparent"
            color="surface"
            size="sm"
            title="Show the product part"
            data-product-comments
          >
            {{ count === 1 ? '1 comment on the product part' : count + ' comments on the product part' }}
          </button>
        }
      </div>

      @if (error(); as message) {
        <p [etProvideColor]="errorTheme()" class="text-[var(--et-theme-color-primary-solid)]">{{ message }}</p>
      }
      @if (refusal(); as refused) {
        <div class="flex flex-col gap-1.5" data-merge-refusal>
          <p [etProvideColor]="errorTheme()" class="text-[var(--et-theme-color-primary-solid)]">
            {{ refused.message }}
          </p>
          <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
            <dt class="text-[var(--et-surface-color-subtle-solid)]">Changed in the product</dt>
            <dd class="font-mono" data-merge-refusal-changed>
              {{ refused.changed.join(', ') || 'unknown - the sketch records no baseline' }}
            </dd>
          </dl>
          <p class="text-[var(--et-surface-color-subtle-solid)]">
            The agent brings the variant up to date with the product, then records it with:
          </p>
          <div class="flex items-center gap-2">
            <pre
              class="m-0 min-w-0 flex-1 overflow-x-auto rounded-md border border-surface-border px-3 py-2 font-mono text-text"
              data-rebase-command
              >{{ refused.rebase }}</pre>
            <button
              (click)="copyRebase(refused.rebase)"
              et-button
              type="button"
              variant="outline"
              color="surface"
              size="sm"
              data-copy-rebase
            >
              {{ copiedRebase() ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>
      }
    </section>

    @if (hasToolbar()) {
      <div class="flex flex-wrap items-center gap-2 border-b border-surface-border px-4 py-2 text-small">
        @if (shown.status === 'in progress' && shown.report; as report) {
          <span
            [title]="reportTitleOf(report)"
            class="min-w-0 flex-1 truncate text-[var(--et-surface-color-subtle-solid)]"
          >
            Agent: {{ report.message }}
          </span>
        } @else {
          <span class="flex-1"></span>
        }
        @if (showing() === 'matrix' && matrix().sizes.length > 1) {
          <div class="flex gap-1" role="group" aria-label="Size of every cell">
            @for (size of matrix().sizes; track size) {
              <button
                [pressed]="size === matrix().size"
                (click)="pickSize(size)"
                et-button
                type="button"
                variant="outline"
                color="surface"
                size="sm"
              >
                {{ sizeLabel(size) }}
              </button>
            }
          </div>
        }
        @if (showing() === 'matrix' && matrix().interactions.length > 1) {
          <div class="flex gap-1" role="group" aria-label="Interaction of every cell">
            @for (name of interactionChoices(); track name) {
              <button
                [pressed]="name === matrix().interaction"
                (click)="pickInteraction(name)"
                et-button
                type="button"
                variant="outline"
                color="surface"
                size="sm"
              >
                {{ name }}
              </button>
            }
          </div>
        }
        @if (changedAreaView().toolbar; as areaSwitch) {
          <button
            [pressed]="areaSwitch.on"
            [title]="areaSwitch.title"
            (click)="switchChangedArea(areaSwitch.key, !areaSwitch.on)"
            et-button
            type="button"
            variant="outline"
            color="surface"
            size="sm"
            data-changed-area
          >
            Changed area
          </button>
        }
        @if (unchangedHeads().length > 0) {
          <span class="text-[var(--et-surface-color-subtle-solid)]" data-unchanged-count>
            {{ unchangedCountText() }}
          </span>
          <button
            [pressed]="allStatesShown()"
            (click)="toggleAllStates()"
            et-button
            type="button"
            variant="outline"
            color="surface"
            size="sm"
            data-show-all-states
          >
            {{ allStatesShown() ? 'Fold unchanged states' : 'Show all states' }}
          </button>
        }
        @if (picked() && (previewReading()?.preview?.affected?.length ?? 0) > 0) {
          <button
            [pressed]="showing() === 'merge'"
            (click)="toggleMergePreview()"
            et-button
            type="button"
            variant="outline"
            color="surface"
            size="sm"
          >
            {{ showing() === 'merge' ? 'Back to the variants' : 'Where ' + targetName() + ' is used' }}
          </button>
        }
      </div>
    }

    @if (showing() === 'merge') {
      <div
        class="flex flex-col items-start gap-1 border-b border-surface-border px-4 py-2 text-small"
        data-merge-preview
      >
        <p>{{ shown.target }} appears in these parts. Left: now. Right: after merging {{ picked() }}.</p>
        @if (compareReading(); as reading) {
          @if (reading.error) {
            <p [etProvideColor]="errorTheme()" class="text-[var(--et-theme-color-primary-solid)]" role="alert">
              {{ reading.error }}
            </p>
          } @else if (reading.compare; as compare) {
            @if (compare.changed.length === 0) {
              <p class="text-[var(--et-surface-color-subtle-solid)]">No part changes visibly.</p>
            }
            @for (line of unchangedLines(); track line.part) {
              <button
                [pressed]="showUnchanged()"
                (click)="showUnchanged.set(!showUnchanged())"
                et-button
                type="button"
                variant="transparent"
                color="surface"
                size="xs"
                data-merge-unchanged
              >
                {{ line.text }}
              </button>
            }
          } @else {
            <p class="flex items-center gap-2 text-[var(--et-surface-color-subtle-solid)]">
              <span
                class="size-[0.6em] shrink-0 animate-pulse rounded-full bg-accent"
                data-merge-compare-rendering
                title="Rendering"
              ></span>
              {{ comparingText() }}
            </p>
          }
        }
      </div>
    }

    <ethlete-design-canvas
      [frames]="notedFrames()"
      [columns]="canvasColumns()"
      [notes]="changedAreaView().notes"
      [cameraKey]="showing() === 'merge' ? cameraKey() + ' merge' : cameraKey()"
      [restoredCamera]="showing() === 'merge' ? null : restoredCamera()"
      [fitTo]="showing() === 'merge' ? 'first row' : 'all'"
      [pins]="pins()"
      [outlines]="outlines()"
      [pointing]="commentStore.active()"
      [draft]="commentStore.draft()"
      [pinPopover]="pinThread"
      [rowHeads]="showing() === 'merge' ? [] : matrix().rowHeads"
      [sections]="showing() === 'merge' ? [] : matrix().sections"
      (cameraChange)="rememberCamera($event)"
      (pointPick)="startComment($event)"
      (columnToggle)="toggleRound($event)"
      (groupSwitch)="switchChangedAreaOfGroup($event)"
      (rowToggle)="toggleState($event)"
      class="min-h-0 flex-1"
      arrangement="matrix"
    >
      @if (commentStore.draft()) {
        <ethlete-comment-draft canvasDraft />
      }
    </ethlete-design-canvas>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    CommentDraftComponent,
    CommentThreadComponent,
    DesignCanvasComponent,
    ProvideColorDirective,
  ],
  host: { class: 'flex min-h-0 flex-col' },
})
export class SketchViewComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  protected commentStore = injectCommentStore();
  private injector = inject(Injector);
  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public sketch = input.required<ListedSketch>();
  public part = input<ListedPart | null>(null);
  public epoch = input(0);
  public revision = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public cameraKey = input<string | null>(null);

  public restoredCamera = input<Camera | null>(null);

  public cameraChange = output<Camera | null>();

  public decide = output<void>();

  /** Asks to show the product part the sketch targets. */
  public partOpen = output<void>();

  /** Whether a merge of this sketch runs. */
  public merging = output<boolean>();

  /** The sketch's target once its merge succeeded. */
  public mergeComplete = output<string>();
  private canvasRef = viewChild.required(DesignCanvasComponent);

  protected note = signal('');

  protected busy = signal<Busy | null>(null);

  protected error = signal('');

  protected refusal = signal<MergeNeedsRebaseError | null>(null);

  protected copiedRebase = signal(false);

  protected confirmingDiscard = signal(false);

  protected picked = computed(() => pickedVariantOf(this.sketch()));
  protected rejectedLabels = computed(() => {
    const sketch = this.sketch();

    return Object.fromEntries(sketch.variants.map((variant) => [variant, rejectedLabelOf(sketch, variant)]));
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

  public size = linkedSignal(() => this.remembered().size ?? null);

  public interaction = linkedSignal(() => this.remembered().interaction ?? null);

  private openRounds = linkedSignal(() =>
    this.remembered().roundsFor === this.sketch().createdAt ? (this.remembered().rounds ?? {}) : {},
  );

  private openStates = linkedSignal(() => this.remembered().states ?? {});

  private shownMode = linkedSignal<Shown>(() => (this.remembered().merge ? 'merge' : 'matrix'));

  private reportExpiry = computed(() => reportExpiryOf(this.sketch().report));

  private reportNow = toSignal(
    toObservable(this.reportExpiry).pipe(
      switchMap((expiry) =>
        expiry === null || expiry <= Date.now()
          ? of(Date.now())
          : timer(expiry - Date.now()).pipe(
              map(() => Date.now()),
              startWith(Date.now()),
            ),
      ),
    ),
    { initialValue: Date.now() },
  );

  private source = computed(() => ({
    port: this.port(),
    now: this.reportNow(),
    product: this.product(),
    sketch: this.sketch(),
    size: this.size(),
    interaction: this.interaction(),
    openRounds: this.openRounds(),
    openStates: this.openStates(),
    epoch: this.epoch(),
    revision: this.revision(),
    surface: this.surface(),
    color: this.color(),
  }));

  protected matrix = computed(() => sketchMatrixOf({ ...this.source(), part: this.part() }));

  protected previewReading = toSignal(
    toObservable(computed(() => ({ address: this.address(), variant: this.picked(), revision: this.revision() }))).pipe(
      switchMap(({ address, variant }) =>
        variant
          ? sketchPreview$({ ...address, variant }).pipe(
              map((preview): PreviewReading => ({ preview, error: null })),
              catchError((error: unknown) => of<PreviewReading>({ preview: null, error: messageOf(error) })),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected targetName = computed(() => partNameOf(this.sketch().target));

  protected showUnchanged = linkedSignal({ source: this.picked, computation: () => false });

  private hasAffected = computed(() => (this.previewReading()?.preview?.affected.length ?? 0) > 0);

  protected compareReading = toSignal(
    toObservable(
      computed(() => ({
        address: this.address(),
        variant: this.picked(),
        on: this.shownMode() === 'merge' && this.hasAffected(),
        size: this.size(),
        surface: this.surface(),
        color: this.color(),
        revision: this.revision(),
      })),
    ).pipe(
      switchMap(({ address, variant, on, size, surface, color }) =>
        variant && on
          ? whileWaiting$(
              sketchCompare$({ ...address, variant, size, surface, color }).pipe(
                map((compare): CompareReading => ({ compare, error: null })),
                catchError((error: unknown) => of<CompareReading>({ compare: null, error: messageOf(error) })),
              ),
              (seconds): CompareReading => ({ compare: null, error: null, seconds }),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected comparingText = computed(() =>
    comparingTextOf({
      parts: this.previewReading()?.preview?.affected.length ?? 0,
      seconds: this.compareReading()?.seconds ?? 0,
    }),
  );

  private shownRows = computed(() => {
    const compare = this.compareReading()?.compare;

    return compare ? [...compare.changed, ...(this.showUnchanged() ? compare.unchanged : [])] : null;
  });

  protected unchangedLines = computed(() => unchangedLinesOf(this.compareReading()?.compare?.unchanged ?? []));

  private mergePreview = computed(() => {
    const variant = this.picked();
    const affected = this.previewReading()?.preview?.affected ?? [];

    return variant && affected.length > 0
      ? mergePreviewOf({ ...this.source(), variant, affected, rows: this.shownRows() })
      : null;
  });

  protected showing = computed<Shown>(() =>
    this.shownMode() === 'merge' && this.mergePreview() !== null ? 'merge' : 'matrix',
  );

  protected unchangedHeads = computed(() => (this.showing() === 'merge' ? [] : this.matrix().rowHeads));

  protected allStatesShown = computed(() => this.unchangedHeads().every((head) => head.open));

  protected unchangedCountText = computed(() => {
    const count = this.unchangedHeads().length;
    const states = count === 1 ? 'state' : 'states';

    return this.allStatesShown() ? `${count} unchanged ${states} shown` : `${count} unchanged ${states} folded`;
  });

  public diffLines = toSignal(
    toObservable(
      computed(
        () => ({
          address: this.address(),
          variants: this.sketch().variants,
          size: this.matrix().size,
          surface: this.surface(),
          color: this.color(),
          revision: this.revision(),
        }),
        { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
      ),
    ).pipe(
      switchMap(({ address, variants, size, surface, color }) =>
        variants.length === 0
          ? of<Record<string, DiffLine[]>>({})
          : combineLatest(
              variants.map((variant) =>
                variantDiff$({ ...address, variant, size, surface, color }).pipe(
                  map(diffLinesOf),
                  catchError(() => of<DiffLine[]>([])),
                ),
              ),
            ).pipe(map((lines) => Object.fromEntries(variants.map((variant, index) => [variant, lines[index] ?? []])))),
      ),
    ),
    { initialValue: {} as Record<string, DiffLine[]> },
  );

  protected diffSummaries = computed(() =>
    Object.fromEntries(Object.entries(this.diffLines()).map(([variant, lines]) => [variant, diffSummaryOf(lines)])),
  );

  protected openDiffs = signal<Record<string, boolean>>({});

  private marked = signal<{ variant: string; state: string } | null>(null);

  private markedOutline = computed(() => {
    const marked = this.marked();
    const box = marked && this.diffLines()[marked.variant]?.find((line) => line.state === marked.state)?.box;

    return marked && box ? [diffOutlineOf({ ...marked, box })] : [];
  });

  protected outlines = computed(() =>
    this.showing() === 'merge' ? mergeOutlinesOf(this.shownRows() ?? []) : this.markedOutline(),
  );

  public canvas = computed(() => (this.showing() === 'merge' ? (this.mergePreview() ?? this.matrix()) : this.matrix()));

  private contextPages = computed(() => new Set(usingPagesOf(this.product(), this.part()).map(partKeyOf)));

  private sketchComments = computed(() =>
    this.commentStore
      .comments()
      .filter((comment) => isInSketch(comment, { sketch: this.sketch(), contextPages: this.contextPages() })),
  );

  protected pins = computed(() => pinsOf(this.canvas().frames, this.sketchComments()));

  private openComments = computed(() => commentsOfPart(this.commentStore.comments(), this.sketch().target));

  protected productCommentCount = computed(() => this.openComments().filter((comment) => !comment.sketch).length);

  protected interactionChoices = computed(() => [ALL, ...this.matrix().interactions]);

  private areaRounds = computed((): AreaRound[] => {
    const open = sketchRoundsOf(this.sketch(), this.openRounds()).filter(
      (round) => round.open && round.variants.length > 0,
    );
    const newest = open.at(-1)?.key;

    return open.map((round) => ({
      key: round.key,
      group: roundColumnKeyOf(round.key),
      columns: [...(round.key === newest ? [CURRENT] : []), ...round.variants],
    }));
  });

  private changedAreas = toSignal(
    toObservable(
      computed(
        () => ({
          address: this.address(),
          rounds: this.areaRounds().map(({ key, columns }) => ({
            key,
            variants: columns.filter((c) => c !== CURRENT),
          })),
          size: this.matrix().size,
          surface: this.surface(),
          color: this.color(),
          revision: this.revision(),
        }),
        { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
      ),
    ).pipe(
      switchMap(({ address, rounds, size, surface, color }) =>
        rounds.length === 0
          ? of<Record<string, ChangedArea | null>>({})
          : combineLatest(
              rounds.map(({ variants }) =>
                changedArea$({ ...address, variants, size, surface, color }).pipe(
                  map(({ area }) => area),
                  catchError(() => of(null)),
                ),
              ),
            ).pipe(map((areas) => Object.fromEntries(rounds.map(({ key }, index) => [key, areas[index] ?? null])))),
      ),
    ),
    { initialValue: {} as Record<string, ChangedArea | null> },
  );

  private changedAreaChoices = linkedSignal<string, Record<string, boolean>>({
    source: () => this.sketch().createdAt,
    computation: () => ({}),
  });

  protected changedAreaView = computed((): ReturnType<typeof changedAreaViewOf> =>
    this.showing() === 'merge'
      ? { frames: this.canvas().frames, columns: this.canvas().columns, notes: [], toolbar: null }
      : changedAreaViewOf({
          frames: this.matrix().frames,
          columns: this.matrix().columns,
          rounds: this.areaRounds(),
          areas: this.changedAreas(),
          choices: this.changedAreaChoices(),
        }),
  );

  protected hasToolbar = computed(
    () =>
      (this.sketch().status === 'in progress' && !!this.sketch().report) ||
      this.matrix().sizes.length > 1 ||
      this.matrix().interactions.length > 1 ||
      this.unchangedHeads().length > 0 ||
      this.changedAreaView().toolbar !== null ||
      (!!this.picked() && (this.previewReading()?.preview?.affected.length ?? 0) > 0),
  );

  protected notedFrames = computed(() =>
    withOtherSizeNotes(this.changedAreaView().frames, {
      comments: this.sketchComments(),
      everyInteraction: this.showing() === 'matrix' && this.matrix().interaction === ALL,
    }),
  );

  protected canvasColumns = computed(() =>
    this.changedAreaView().columns.map(({ drawing, ...column }) => ({ ...column, muted: drawing })),
  );

  protected reportTitleOf(report: SketchReport) {
    return report.author ? `${report.message}\n\nby ${report.author}` : report.message;
  }

  protected sizeLabel(size: string) {
    return size in this.product().presets ? size : `${size} px`;
  }

  protected pickSize(size: string) {
    this.size.set(size);
    this.remember({ size });
    this.canvasRef().fitAll();
  }

  protected pickInteraction(interaction: string) {
    this.interaction.set(interaction);
    this.remember({ interaction });
    this.canvasRef().fitAll();
  }

  protected switchChangedArea(round: string, on: boolean) {
    this.changedAreaChoices.update((choices) => ({ ...choices, [round]: on }));
  }

  protected switchChangedAreaOfGroup(group: string) {
    const round = this.areaRounds().find((candidate) => candidate.group === group);
    const shown = this.changedAreaView().columns.find((column) => column.group?.key === group)?.group?.switch;

    if (round && shown) this.switchChangedArea(round.key, !shown.on);
  }

  protected toggleRound(key: string) {
    const shown = sketchRoundsOf(this.sketch(), this.openRounds());
    const round = shown.find((candidate) => roundColumnKeyOf(candidate.key) === key);

    if (!round) return;

    const rounds = { ...openRoundsOf(shown), [round.key]: !round.open };

    this.openRounds.set(rounds);
    this.remember({ rounds, roundsFor: this.sketch().createdAt });
  }

  protected toggleState(key: string) {
    if (sketchRoundsOf(this.sketch()).some((round) => roundColumnKeyOf(round.key) === key)) {
      this.toggleRound(key);

      return;
    }

    const head = this.matrix().rowHeads.find((candidate) => candidate.key === key);
    const state = this.part()?.states.find((name) => stateRowKeyOf(name) === key);

    if (!head || state === undefined) return;

    const states = { ...this.openStates(), [state]: !head.open };

    this.openStates.set(states);
    this.remember({ states });
  }

  protected toggleAllStates() {
    const open = !this.allStatesShown();
    const keys = new Set(this.unchangedHeads().map((head) => head.key));
    const flags = (this.part()?.states ?? [])
      .filter((state) => keys.has(stateRowKeyOf(state)))
      .map((state) => [state, open] as const);
    const states = { ...this.openStates(), ...Object.fromEntries(flags) };

    this.openStates.set(states);
    this.remember({ states });
  }

  protected startComment(pick: FramePoint) {
    const draft = commentDraftOf(this.canvas().frames, pick);

    if (draft) this.commentStore.start(draft);
  }

  /** Moves the camera to a comment: back to the matrix, into its round and its folded state, and to its size and interaction first, when the matrix offers them; `ALL` stays. */
  public jumpTo(comment: NumberedComment) {
    this.reveal(
      {
        size: String(comment.size),
        interaction: comment.interaction ?? REST,
        variant: comment.sketch?.variant ?? '',
        state: comment.state,
      },
      () => this.focusComment(comment),
    );
  }

  protected rememberCamera(camera: Camera | null) {
    if (this.showing() === 'matrix') this.cameraChange.emit(camera);
  }

  protected toggleMergePreview() {
    const merge = this.showing() !== 'merge';

    this.shownMode.set(merge ? 'merge' : 'matrix');
    this.remember({ merge });
  }

  protected isMarked(variant: string, line: DiffLine) {
    const marked = this.marked();

    return marked?.variant === variant && marked.state === line.state;
  }

  protected toggleDiffs(variant: string) {
    this.openDiffs.update((open) => ({ ...open, [variant]: open[variant] !== true }));
  }

  protected toggleMark(variant: string, line: DiffLine) {
    if (this.isMarked(variant, line) || !line.box) {
      this.marked.set(null);

      return;
    }

    const frame = diffOutlineOf({ variant, state: line.state, box: line.box }).frameId;

    this.marked.set({ variant, state: line.state });
    this.reveal({ interaction: REST, variant, state: line.state }, () => this.canvasRef().zoomToFrame(frame));
  }

  protected pickable(variant: string) {
    return canPick(this.sketch(), variant);
  }

  protected problemsOf(variant: string) {
    return this.sketch().problems.find((entry) => entry.variant === variant)?.problems ?? [];
  }

  protected pickTitle(variant: string) {
    if (this.sketch().status !== 'ready') return 'The sketch is still in progress';

    return this.problemsOf(variant).length > 0 ? 'This variant breaks a rule' : '';
  }

  protected pick(variant: string) {
    const comment = this.note().trim();

    this.run('pick', decideSketch$(this.address(), { kind: 'pick', variant, ...(comment ? { comment } : {}) }));
  }

  protected judge(kind: 'reject' | 'reopen' | 'reason', variant: string) {
    const reason = this.note().trim();

    if (kind === 'reason' && !reason) return;

    this.run(
      'verdict',
      decideSketch$(
        this.address(),
        kind === 'reason' ? { kind, variant, reason } : { kind, variant, ...(reason ? { reason } : {}) },
      ),
    );
  }

  protected merge() {
    const variant = this.picked();
    const note = this.note().trim();
    const address = this.address();

    if (!variant || this.busy()) return;

    this.merging.emit(true);
    this.run(
      'merge',
      decideSketch$(address, { kind: 'pick', variant, ...(note ? { comment: note } : {}) }).pipe(
        concatMap(() => mergeSketch$(address, note)),
        tap(() => this.mergeComplete.emit(address.sketch)),
        finalize(() => this.merging.emit(false)),
      ),
    );
  }

  protected copyRebase(command: string) {
    from(navigator.clipboard.writeText(command))
      .pipe(
        tap(() => this.copiedRebase.set(true)),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected discard() {
    if (!this.confirmingDiscard()) {
      this.confirmingDiscard.set(true);

      return;
    }

    this.confirmingDiscard.set(false);
    this.run('discard', discardSketch$(this.address()));
  }

  private reveal(
    { size, interaction, variant, state }: { size?: string; interaction: string; variant: string; state: string },
    focus: () => void,
  ) {
    const resize = size !== undefined && size !== this.matrix().size && this.matrix().sizes.includes(size);
    const reinteract =
      this.matrix().interaction !== ALL &&
      interaction !== this.matrix().interaction &&
      this.matrix().interactions.includes(interaction);
    const leaveMerge = this.showing() === 'merge';
    const shown = sketchRoundsOf(this.sketch(), this.openRounds());
    const folded = shown.find((round) => !round.open && round.variants.includes(variant));
    const rounds = folded ? { ...openRoundsOf(shown), [folded.key]: true } : null;
    const unfold = this.matrix().rowHeads.some((head) => !head.open && head.key === stateRowKeyOf(state));
    const states = unfold ? { ...this.openStates(), [state]: true } : null;

    if (resize) this.size.set(size);
    if (reinteract) this.interaction.set(interaction);
    if (leaveMerge) this.shownMode.set('matrix');
    if (rounds) this.openRounds.set(rounds);
    if (states) this.openStates.set(states);
    this.remember({
      ...(resize && { size }),
      ...(reinteract && { interaction }),
      ...(leaveMerge && { merge: false }),
      ...(rounds && { rounds, roundsFor: this.sketch().createdAt }),
      ...(states && { states }),
    });
    if (resize || reinteract || leaveMerge || rounds || states) afterNextRender(focus, { injector: this.injector });
    else focus();
  }

  private remember(pick: SketchViewPick) {
    const key = this.cameraKey();

    if (key !== null && Object.keys(pick).length > 0) rememberSketchView(key, pick);
  }

  private focusComment(comment: NumberedComment) {
    const frame = otherSizeFrameOf(this.canvas().frames, comment);

    if (this.pins().some((pin) => pin.id === comment.id)) this.canvasRef().openPin(comment.id);
    else if (frame) this.canvasRef().focusFrame(frame);
  }

  private run(busy: Busy, work$: Observable<unknown>) {
    if (this.busy()) return;

    this.busy.set(busy);
    this.error.set('');
    this.refusal.set(null);
    this.copiedRebase.set(false);

    work$
      .pipe(
        catchError((error: unknown) => {
          if (error instanceof MergeNeedsRebaseError) this.refusal.set(error);
          else this.error.set(messageOf(error));

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
