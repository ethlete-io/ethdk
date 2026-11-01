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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable, catchError, concatMap, finalize, of, tap } from 'rxjs';
import {
  ListedPart,
  ListedProduct,
  ListedSketch,
  SketchAddress,
  decideSketch$,
  discardSketch$,
  mergeSketch$,
} from '../../host/design';
import { SketchesComponent } from '../design-parts/sketches/sketches.component';
import { SketchPin, SketchVariant } from '../design-parts/sketches/sketches-sample';
import { injectViewContext } from '../chat/view-context';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { SketchViewPick, rememberSketchView, rememberedView } from '../studio-view/remembered';
import { NumberedComment, isInSketch } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { senderOf } from './inbox-comments';
import { PageShell, PageShellAction } from './page-shell';
import { CURRENT, partKeyOf, pickedVariantOf, sketchMatrixOf, sketchRoundsOf, sketchUsingPagesOf } from './system-tree';

type Busy = 'merge' | 'discard';

@Component({
  selector: 'ethlete-sketch-view',
  template: `
    <ethlete-sketches
      [part]="sketch().target"
      [variants]="variants()"
      [rounds]="rounds()"
      [round]="shownRoundKey()"
      [pins]="variantPins()"
      [selected]="picked() ?? undefined"
      [shot]="shot"
      [tree]="shell().tree"
      [product]="shell().product"
      [products]="shell().products"
      [project]="shell().project"
      [projects]="shell().projects"
      [panel]="shell().panel"
      (discard)="discard()"
      (merge)="merge($event)"
      (roundChange)="pickRound($event)"
      (pinToggle)="shellAction.emit({ kind: 'section', section: 'Inbox' })"
      (expandedChange)="expandedChange.emit($event)"
      (pick)="shellAction.emit({ kind: 'pick', key: $event })"
      (collapse)="shellAction.emit({ kind: 'collapse' })"
      (sectionChange)="shellAction.emit({ kind: 'section', section: $event })"
      (productChange)="shellAction.emit({ kind: 'product', name: $event })"
      (allProducts)="shellAction.emit({ kind: 'allProducts' })"
      (projectChange)="shellAction.emit({ kind: 'project', name: $event })"
      (openProject)="shellAction.emit({ kind: 'openProject' })"
      class="h-full!"
    />

    <ng-template #shot let-variant>
      @if (shots()[variant.key]; as src) {
        <iframe [src]="src" [title]="variant.label" class="block size-full border-0 scheme-normal"></iframe>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SketchesComponent],
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

  protected merge(variant: string) {
    const address = this.address();

    if (this.busy()) return;

    this.merging.emit(true);
    this.run(
      'merge',
      decideSketch$(address, { kind: 'pick', variant }).pipe(
        concatMap(() => mergeSketch$(address)),
        tap(() => this.mergeComplete.emit(address.sketch)),
        finalize(() => this.merging.emit(false)),
      ),
    );
  }

  protected discard() {
    this.run('discard', discardSketch$(this.address()));
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
