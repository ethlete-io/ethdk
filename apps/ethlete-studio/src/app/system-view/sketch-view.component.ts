import {
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable, catchError, concatMap, finalize, of, switchMap, tap } from 'rxjs';
import {
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
import { SketchPin, SketchVariant } from '../design-parts/sketches/sketches-sample';
import { injectViewContext } from '../chat/view-context';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { SketchViewPick, rememberSketchView, rememberedView } from '../studio-view/remembered';
import { NumberedComment, isInSketch } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { senderOf } from './inbox-comments';
import { MergeColumn, mergeFrameIdOf, partNameOf, sketchCompare$ } from './merge-preview';
import { PageShell, PageShellAction } from './page-shell';
import {
  CURRENT,
  mergePreviewOf,
  partKeyOf,
  pickedVariantOf,
  sketchMatrixOf,
  sketchRoundsOf,
  sketchUsingPagesOf,
} from './system-tree';

type Busy = 'pick' | 'merge' | 'discard';

type Mode = 'sketches' | 'merge';

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
        [part]="sketch().target"
        [variants]="variants()"
        [rounds]="rounds()"
        [round]="shownRoundKey()"
        [pins]="variantPins()"
        [selected]="picked() ?? undefined"
        [shot]="shot"
        [tree]="shell().tree"
        [shell]="shell()"
        (discard)="discard()"
        (merge)="pickForMerge($event)"
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

    <ng-template #shot let-variant>
      @if (shots()[variant.key]; as src) {
        <iframe [src]="src" [title]="variant.label" class="block size-full border-0 scheme-normal"></iframe>
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
  private commentStore = injectCommentStore();
  private viewContext = injectViewContext();
  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public sketch = input.required<ListedSketch>();
  public part = input<ListedPart | null>(null);
  public epoch = input(0);
  public revision = input(0);
  public view = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public cameraKey = input<string | null>(null);
  public shell = input.required<PageShell>();

  public shellAction = output<PageShellAction>();

  public expandedChange = output<readonly string[]>();

  public decide = output<void>();

  /** Whether a merge of this sketch runs. */
  public merging = output<boolean>();

  /** The sketch's target once its merge succeeded. */
  public mergeComplete = output<string>();

  private busy = signal<Busy | null>(null);

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

  private openRounds = linkedSignal(() =>
    this.remembered().roundsFor === this.sketch().createdAt ? (this.remembered().rounds ?? {}) : {},
  );

  private shownRounds = computed(() => sketchRoundsOf(this.sketch(), this.openRounds()));

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
        variant ? sketchPreview$({ ...address, variant }).pipe(catchError(() => of(null))) : of(null),
      ),
    ),
    { initialValue: null },
  );

  private compareReading = toSignal(
    toObservable(
      computed(() => ({
        address: this.address(),
        variant: this.mergeVariant(),
        on: this.mode() === 'merge' && (this.previewReading()?.affected.length ?? 0) > 0,
        surface: this.surface(),
        color: this.color(),
        revision: this.revision(),
      })),
    ).pipe(
      switchMap(({ address, variant, on, surface, color }) =>
        variant && on
          ? sketchCompare$({ ...address, variant, surface, color }).pipe(catchError(() => of(null)))
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

    return rows.map(({ part, state, outlines }) => {
      const now = frameOf({ column: 'now', part, state });
      const after = frameOf({ column: 'merged', part, state });

      return {
        part,
        state,
        instances: outlines.merged.length || outlines.now.length || 1,
        width: now?.width ?? FALLBACK_SIZE.width,
        height: now?.height ?? FALLBACK_SIZE.height,
        now: now?.src ?? '',
        after: after?.src ?? '',
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
          [row.now, row.after]
            .filter(Boolean)
            .map((src) => [src, this.sanitizer.bypassSecurityTrustResourceUrl(src)] as const),
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

  protected variants = computed<SketchVariant[]>(() => {
    const sketch = this.sketch();
    const shown = this.shownRounds().flatMap((round) => (round.open ? round.variants : []));

    return [
      { key: CURRENT, label: STUDIO_LABELS.sketches.current, note: '' },
      ...shown.map((variant) => {
        const sender = senderOf('agent', sketch.variantInfo?.[variant]?.authors?.[0]);

        return {
          key: variant,
          label: variant,
          note: sketch.variantInfo?.[variant]?.note ?? '',
          ...(sender.agent ? { author: { name: sender.author, agent: sender.agent } } : {}),
        };
      }),
    ];
  });

  protected shots = computed(() => {
    const frames = this.matrix().frames;

    return Object.fromEntries(
      this.variants().flatMap(({ key }) => {
        const frame = frames.find((candidate) => candidate.column === key && !candidate.empty);

        return frame ? [[key, this.sanitizer.bypassSecurityTrustResourceUrl(frame.src)]] : [];
      }),
    );
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
    this.variants().flatMap(({ key }) => {
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

  constructor() {
    effect(() => this.viewContext.put('sketch', { variant: null, picked: this.picked(), selection: null }));
    this.destroyRef.onDestroy(() => this.viewContext.drop('sketch'));
  }

  /** Shows the round of the comment's variant. */
  public jumpTo(comment: NumberedComment) {
    const variant = comment.sketch?.variant;
    const other = this.shownRounds().find((round) => !round.open && variant && round.variants.includes(variant));

    if (other) this.pickRound(other.key);
  }

  protected pickRound(key: string) {
    const rounds = Object.fromEntries(this.shownRounds().map((round) => [round.key, round.key === key]));

    this.openRounds.set(rounds);
    this.remember({ rounds, roundsFor: this.sketch().createdAt });
  }

  protected pickForMerge(variant: string) {
    this.run(
      'pick',
      decideSketch$(this.address(), { kind: 'pick', variant }).pipe(
        tap(() => {
          this.mergeVariant.set(variant);
          this.showMode('merge');
        }),
      ),
    );
  }

  protected showSketches() {
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
              : STUDIO_LABELS.merge.failed,
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

    work$
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.busy.set(null);
          this.decide.emit();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
