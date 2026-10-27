import {
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { Observable, catchError, concatMap, finalize, map, of, switchMap } from 'rxjs';
import {
  ListedPart,
  ListedProduct,
  ListedSketch,
  MergePreview,
  SketchAddress,
  decideSketch$,
  discardSketch$,
  mergeSketch$,
  sketchPreview$,
} from '../../host/design';
import { Camera } from '../components/design-canvas/canvas-math';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { FramePoint } from '../components/design-canvas/canvas-pin';
import { CommentDraftComponent } from './comment-draft.component';
import { commentDraftOf, pinsOf } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { canPick, mergePreviewOf, pickedVariantOf, sketchMatrixOf } from './system-tree';

type Busy = 'pick' | 'merge' | 'discard';

type Shown = 'matrix' | 'merge';

type PreviewReading = { preview: MergePreview | null; error: string | null };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Component({
  selector: 'ethlete-sketch-view',
  template: `
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
              size="sm"
            >
              {{ variant === picked() ? 'Picked ' + variant : 'Pick ' + variant }}
            </button>
            @for (problem of problemsOf(variant); track $index) {
              <span [title]="problem.file" class="text-[var(--et-theme-color-primary-solid)]" etProvideColor="danger">
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
            <p class="text-[var(--et-theme-color-primary-solid)]" etProvideColor="danger">{{ reading.error }}</p>
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

      <div class="flex items-center gap-2">
        <input
          [value]="note()"
          (input)="takeNote($event)"
          class="min-w-0 flex-1 rounded-md border border-[var(--et-surface-border-solid)] bg-[var(--et-surface-background-solid)] px-2.5 py-1 text-[var(--et-surface-color-solid)]"
          placeholder="Why this shape - the note on the part, needed for a merge"
          aria-label="Note"
        />
        <button
          [disabled]="busy() !== null || !picked() || note().trim() === ''"
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
          [disabled]="busy() !== null"
          (click)="discard()"
          et-button
          type="button"
          variant="transparent"
          color="surface"
          size="sm"
        >
          {{ confirmingDiscard() ? 'Discard all variants?' : 'Discard sketch' }}
        </button>
      </div>

      @if (error(); as message) {
        <p class="text-[var(--et-theme-color-primary-solid)]" etProvideColor="danger">{{ message }}</p>
      }
    </section>

    @if (hasToolbar()) {
      <div
        class="flex flex-wrap items-center gap-2 border-b border-[var(--et-surface-border-solid)] px-4 py-2 text-small"
      >
        @if (shown.status === 'in progress' && shown.report; as report) {
          <span [title]="report.message" class="min-w-0 flex-1 truncate text-[var(--et-surface-color-subtle-solid)]">
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
      [frames]="canvas().frames"
      [columns]="canvasColumns()"
      [cameraKey]="showing() === 'merge' ? cameraKey() + ' merge' : cameraKey()"
      [restoredCamera]="showing() === 'merge' ? null : restoredCamera()"
      [pins]="pins()"
      [pointing]="commentStore.active()"
      [draft]="commentStore.draft()"
      (cameraChange)="rememberCamera($event)"
      (pointPick)="startComment($event)"
      (pinWithdraw)="commentStore.withdraw($event)"
      class="min-h-0 flex-1"
      arrangement="matrix"
    >
      @if (commentStore.draft()) {
        <ethlete-comment-draft canvasDraft />
      }
    </ethlete-design-canvas>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CommentDraftComponent, DesignCanvasComponent, ProvideColorDirective],
  host: { class: 'flex min-h-0 flex-col' },
})
export class SketchViewComponent {
  private destroyRef = inject(DestroyRef);
  protected commentStore = injectCommentStore();
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

  public cameraChange = output<Camera>();

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

  public size = signal<string | null>(null);

  private shownMode = signal<Shown>('matrix');

  private source = computed(() => ({
    port: this.port(),
    product: this.product(),
    sketch: this.sketch(),
    size: this.size(),
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

  protected canvas = computed(() =>
    this.showing() === 'merge' ? (this.mergePreview() ?? this.matrix()) : this.matrix(),
  );

  protected hasToolbar = computed(
    () =>
      (this.sketch().status === 'in progress' && !!this.sketch().report) ||
      this.matrix().sizes.length > 1 ||
      (!!this.picked() && (this.previewReading()?.preview?.affected.length ?? 0) > 0),
  );

  protected pins = computed(() => pinsOf(this.canvas().frames, this.commentStore.comments()));

  protected canvasColumns = computed(() =>
    this.canvas().columns.map(({ key, label, drawing }) => ({ key, label, muted: drawing })),
  );

  protected sizeLabel(size: string) {
    return size in this.product().presets ? size : `${size} px`;
  }

  protected pickSize(size: string) {
    this.size.set(size);
    this.canvasRef().fitAll();
  }

  protected startComment(pick: FramePoint) {
    const draft = commentDraftOf(this.canvas().frames, pick);

    if (draft) this.commentStore.start(draft);
  }

  protected rememberCamera(camera: Camera) {
    if (this.showing() === 'matrix') this.cameraChange.emit(camera);
  }

  protected toggleMergePreview() {
    this.shownMode.update((mode) => (mode === 'merge' ? 'matrix' : 'merge'));
  }

  protected takeNote(event: Event) {
    this.note.set((event.target as HTMLInputElement).value);
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
