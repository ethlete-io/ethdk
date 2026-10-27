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
import { Observable, catchError, concatMap, finalize, map, of, switchMap } from 'rxjs';
import {
  ListedPart,
  ListedProduct,
  ListedSketch,
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
  otherSizeFrameOf,
  pinsOf,
  withOtherSizeNotes,
} from './comment-pins';
import { injectCommentStore } from './comment-store';
import {
  ALL,
  canPick,
  mergePreviewOf,
  pickedVariantOf,
  roundColumnKeyOf,
  sketchMatrixOf,
  sketchRoundsOf,
} from './system-tree';

type Busy = 'pick' | 'merge' | 'discard';

type Shown = 'matrix' | 'merge';

type PreviewReading = { preview: MergePreview | null; error: string | null };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Component({
  selector: 'ethlete-sketch-view',
  template: `
    <ng-template #pinThread let-pin>
      <ethlete-comment-thread [commentId]="pin.id" />
    </ng-template>

    @let shown = sketch();
    <header class="flex items-center gap-3 border-b border-[var(--et-surface-border-solid)] px-4 py-3">
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
            ? 'border-[var(--et-theme-color-primary-solid)] text-[var(--et-theme-color-primary-solid)]'
            : 'border-[var(--et-surface-border-solid)] text-[var(--et-surface-color-subtle-solid)]'
        "
        class="whitespace-nowrap rounded-full border px-2 font-mono text-small"
      >
        {{ shown.status }}
      </span>
    </header>

    <section
      class="flex flex-col gap-2 border-b border-[var(--et-surface-border-solid)] px-4 py-3 text-small"
      aria-label="Decision"
    >
      <div class="flex flex-wrap gap-3" role="group" aria-label="Variants">
        @for (variant of shown.variants; track variant) {
          <div class="flex max-w-80 flex-col gap-1">
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
            >
              {{ variant === picked() ? 'Picked ' + variant : 'Pick ' + variant }}
            </button>
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
          The agent is still drawing. You can pick once the sketch is ready.
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
          <et-input [(value)]="note" placeholder="Why this shape - the note on the part, needed for a merge" />
        </et-form-field>
        @if (picked() && note().trim() === '') {
          <span class="self-center text-[var(--et-surface-color-subtle-solid)]">Needs a note</span>
        }
        <button
          [disabled]="busy() !== null || locked() || !picked() || note().trim() === ''"
          (click)="merge()"
          et-button
          type="button"
          variant="outline"
          color="surface"
          size="sm"
        >
          {{ busy() === 'merge' ? 'Merging…' : 'Merge ' + (picked() ?? '') }}
        </button>
        <button
          [disabled]="busy() !== null || locked()"
          (click)="discard()"
          et-button
          type="button"
          variant="transparent"
          color="surface"
          size="sm"
        >
          {{ confirmingDiscard() ? 'Discard all variants?' : 'Discard sketch' }}
        </button>
        @if (locked()) {
          <button
            (click)="commentStore.showPanel(true)"
            et-button
            type="button"
            variant="transparent"
            size="sm"
            title="Withdraw or resolve them to merge or discard"
            data-merge-lock
          >
            {{ openComments().length === 1 ? '1 open comment' : openComments().length + ' open comments' }}
          </button>
        }
      </div>

      @if (error(); as message) {
        <p [etProvideColor]="errorTheme()" class="text-[var(--et-theme-color-primary-solid)]">{{ message }}</p>
      }
    </section>

    @if (hasToolbar()) {
      <div
        class="flex flex-wrap items-center gap-2 border-b border-[var(--et-surface-border-solid)] px-4 py-2 text-small"
      >
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
            {{ showing() === 'merge' ? 'Back to the variants' : 'Show merge preview' }}
          </button>
        }
      </div>
    }

    <ethlete-design-canvas
      [frames]="notedFrames()"
      [columns]="canvasColumns()"
      [cameraKey]="showing() === 'merge' ? cameraKey() + ' merge' : cameraKey()"
      [restoredCamera]="showing() === 'merge' ? null : restoredCamera()"
      [pins]="pins()"
      [pointing]="commentStore.active()"
      [draft]="commentStore.draft()"
      [pinPopover]="pinThread"
      (cameraChange)="rememberCamera($event)"
      (pointPick)="startComment($event)"
      (columnToggle)="toggleRound($event)"
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
  private canvasRef = viewChild.required(DesignCanvasComponent);

  protected note = signal('');

  protected busy = signal<Busy | null>(null);

  protected error = signal('');

  protected confirmingDiscard = signal(false);

  protected picked = computed(() => pickedVariantOf(this.sketch()));

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

  private openRounds = linkedSignal(() => this.remembered().rounds ?? {});

  private shownMode = linkedSignal<Shown>(() => (this.remembered().merge ? 'merge' : 'matrix'));

  private source = computed(() => ({
    port: this.port(),
    product: this.product(),
    sketch: this.sketch(),
    size: this.size(),
    interaction: this.interaction(),
    openRounds: this.openRounds(),
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

  private mergePreview = computed(() => {
    const variant = this.picked();
    const affected = this.previewReading()?.preview?.affected ?? [];

    return variant && affected.length > 0 ? mergePreviewOf({ ...this.source(), variant, affected }) : null;
  });

  protected showing = computed<Shown>(() =>
    this.shownMode() === 'merge' && this.mergePreview() !== null ? 'merge' : 'matrix',
  );

  public canvas = computed(() => (this.showing() === 'merge' ? (this.mergePreview() ?? this.matrix()) : this.matrix()));

  protected hasToolbar = computed(
    () =>
      (this.sketch().status === 'in progress' && !!this.sketch().report) ||
      this.matrix().sizes.length > 1 ||
      this.matrix().interactions.length > 1 ||
      (!!this.picked() && (this.previewReading()?.preview?.affected.length ?? 0) > 0),
  );

  protected pins = computed(() => pinsOf(this.canvas().frames, this.commentStore.comments()));

  protected openComments = computed(() => commentsOfPart(this.commentStore.comments(), this.sketch().target));

  protected locked = computed(() => this.openComments().length > 0);

  protected interactionChoices = computed(() => [ALL, ...this.matrix().interactions]);

  protected notedFrames = computed(() =>
    withOtherSizeNotes(this.canvas().frames, {
      comments: this.commentStore.comments(),
      everyInteraction: this.showing() === 'matrix' && this.matrix().interaction === ALL,
    }),
  );

  protected canvasColumns = computed(() =>
    this.canvas().columns.map(({ drawing, ...column }) => ({ ...column, muted: drawing })),
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

  protected toggleRound(key: string) {
    const round = sketchRoundsOf(this.sketch(), this.openRounds()).find(
      (candidate) => roundColumnKeyOf(candidate.key) === key,
    );

    if (!round) return;

    const rounds = { ...this.openRounds(), [round.key]: !round.open };

    this.openRounds.set(rounds);
    this.remember({ rounds });
  }

  protected startComment(pick: FramePoint) {
    const draft = commentDraftOf(this.canvas().frames, pick);

    if (draft) this.commentStore.start(draft);
  }

  /** Moves the camera to a comment: back to the matrix, into its round, and to its size and interaction first, when the matrix offers them; `ALL` stays. */
  public jumpTo(comment: NumberedComment) {
    const size = String(comment.size);
    const interaction = comment.interaction ?? REST;
    const resize = size !== this.matrix().size && this.matrix().sizes.includes(size);
    const reinteract =
      this.matrix().interaction !== ALL &&
      interaction !== this.matrix().interaction &&
      this.matrix().interactions.includes(interaction);
    const leaveMerge = this.showing() === 'merge';
    const folded = sketchRoundsOf(this.sketch(), this.openRounds()).find(
      (round) => !round.open && round.variants.includes(comment.sketch?.variant ?? ''),
    );
    const rounds = folded ? { ...this.openRounds(), [folded.key]: true } : null;

    if (resize) this.size.set(size);
    if (reinteract) this.interaction.set(interaction);
    if (leaveMerge) this.shownMode.set('matrix');
    if (rounds) this.openRounds.set(rounds);
    this.remember({
      ...(resize && { size }),
      ...(reinteract && { interaction }),
      ...(leaveMerge && { merge: false }),
      ...(rounds && { rounds }),
    });
    if (resize || reinteract || leaveMerge || rounds)
      afterNextRender(() => this.focusComment(comment), { injector: this.injector });
    else this.focusComment(comment);
  }

  protected rememberCamera(camera: Camera | null) {
    if (this.showing() === 'matrix') this.cameraChange.emit(camera);
  }

  protected toggleMergePreview() {
    const merge = this.showing() !== 'merge';

    this.shownMode.set(merge ? 'merge' : 'matrix');
    this.remember({ merge });
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

  protected merge() {
    const variant = this.picked();
    const note = this.note().trim();
    const address = this.address();

    if (!variant || !note) return;

    this.run(
      'merge',
      decideSketch$(address, { kind: 'pick', variant, comment: note }).pipe(
        concatMap(() => mergeSketch$(address, note)),
      ),
    );
  }

  protected discard() {
    if (!this.confirmingDiscard()) {
      this.confirmingDiscard.set(true);

      return;
    }

    this.confirmingDiscard.set(false);
    this.run('discard', discardSketch$(this.address()));
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

    work$
      .pipe(
        catchError((error: unknown) => {
          this.error.set(messageOf(error));

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
