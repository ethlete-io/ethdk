import { NgTemplateOutlet } from '@angular/common';
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
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, SELECT_IMPORTS, TREE_IMPORTS, TreeDataSource, TreeNode } from '@ethlete/components';
import { ProvideColorDirective, ProvideSurfaceDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, catchError, debounceTime, finalize, from, map, of, scan, switchMap, tap } from 'rxjs';
import {
  ListedCall,
  ListedProduct,
  ListedSketch,
  Themes,
  listedCalls$,
  designStatusChanges$,
  listedSketches$,
  listedSystem$,
  transferCall$,
} from '../../host/design';
import { CanvasFrame, placeableFramesOf } from '../components/design-canvas/canvas-frame';
import { FramePoint } from '../components/design-canvas/canvas-pin';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { StudioMarkComponent } from '../components/studio-mark.component';
import {
  ThemePick,
  camerasWith,
  rememberNotesShown,
  rememberTheme,
  rememberView,
  rememberedView,
  themeKey,
  themeName,
} from '../studio-view/remembered';
import { Camera } from '../components/design-canvas/canvas-math';
import {
  OpenContext,
  TreeEntry,
  TreeFrame,
  TreeGroup,
  TreeSection,
  authorsLabelOf,
  callFramesOf,
  callKeyOf,
  framesOf,
  holdersOf,
  isGroupOpen,
  isSectionOpen,
  partKeyOf,
  sketchKeyOf,
  treeOf,
} from './system-tree';
import { CommentDraftComponent } from './comment-draft.component';
import { CommentThreadComponent } from './comment-thread.component';
import {
  NumberedComment,
  commentDraftOf,
  isCommentModeKey,
  otherSizeFrameOf,
  pinsOf,
  withOtherSizeNotes,
} from './comment-pins';
import { CommentPanelComponent } from './comment-panel.component';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { NewProductFormComponent } from './new-product-form.component';
import { SketchViewComponent } from './sketch-view.component';
import { FlowViewComponent } from './flow-view.component';
import { NoteBodyComponent } from './note-body.component';
import { NoteFormComponent } from './note-form.component';
import { partNotesOf } from './note-places';
import { injectNoteStore, provideNoteStore } from './note-store';
import { flowKeyOf, withFlowGroup } from './flow-frames';
import { ListedFlow, flowChanges$, listedFlows$ } from '../../host/design-flows';
import { NO_FRAME_REVISIONS, revisionOf, sketchRevisionOf } from '../studio-view/frame-revisions';

type Reading = { products: ListedProduct[]; error: string | null };

const BADGE =
  'shrink-0 whitespace-nowrap rounded-full border border-surface-border px-1.5 py-px text-[1rem] text-[var(--et-surface-color-subtle-solid)]';

const BADGE_ACCENT =
  'shrink-0 whitespace-nowrap rounded-full border border-[var(--et-theme-color-primary-solid)] px-1.5 py-px text-[1rem] text-[var(--et-theme-color-primary-solid)]';

const CHANGED_OUTSIDE_SKETCH = 'changed outside a sketch';

/** A product switch keeps the old read until the new product answers; that read must not show. */
const itemsOf = <T>(read: { product: string; items: T[] } | null, product: string | undefined) =>
  read && read.product === product ? read.items : null;

/** Never a product name: a product is a directory, and a directory name holds no slash. */
const NEW_PRODUCT = '/new';

export const baseLabelOf = (base: string) =>
  base.startsWith('@') ? base : (base.split('/').filter(Boolean).at(-1) ?? base);

const NOTE = 'm-0 max-w-130 self-center justify-self-center p-6 text-small text-[var(--et-surface-color-subtle-solid)]';

const failsToLoad = (problems: { rule: string }[]) => problems.some((problem) => problem.rule === 'LOAD');

@Component({
  selector: 'ethlete-system-view',
  template: `
    <ng-template #pinThread let-pin>
      @defer {
        <ethlete-comment-thread [commentId]="pin.id" />
      }
    </ng-template>

    <aside
      class="flex min-h-0 flex-col overflow-y-auto border-r border-surface-border bg-surface-raised pb-4 text-text"
      etProvideSurface="dark-elevated"
    >
      <header class="flex flex-none items-center gap-2 px-4 pt-4 font-semibold text-ui-lg">
        <ethlete-studio-mark class="size-5 flex-none" />
        <span>Studio</span>
      </header>

      @if (reading() && !reading()?.error) {
        <et-select
          [value]="pickerValue()"
          (valueChange)="pickProduct($event)"
          class="mx-4 mt-4 mb-1 flex-none"
          title="The product the system shows"
          aria-label="Product"
        >
          @for (listed of products(); track listed.name) {
            <et-select-option [value]="listed.name" [label]="listed.name">
              <span class="flex flex-col">
                {{ listed.name }}
                @if (listed.base) {
                  <span class="text-[1.1rem] text-[var(--et-surface-color-subtle-solid)]"
                    >inherits from {{ BASE_LABEL_OF(listed.base) }}</span
                  >
                }
              </span>
            </et-select-option>
          }
          <et-select-option [value]="NEW_PRODUCT" label="New product">New product</et-select-option>
        </et-select>
      }

      <et-tree
        [dataSource]="dataSource()"
        [expandedValues]="expandedValues()"
        (expandedValuesChange)="rememberOpen($event)"
        (nodeActivate)="activate($event.value)"
        class="p-2"
        selectionMode="none"
        aria-label="Design system"
      >
        <ng-template etTreeNodeDef let-node>
          @let entry = entryOf(node.value);
          @if (entry) {
            <span class="flex min-w-0 items-center gap-1.5">
              <span
                [class.font-semibold]="entry.key === selectedKey()"
                [style.color]="entry.key === selectedKey() ? 'var(--accent)' : null"
                [title]="entry.title ?? ''"
                class="min-w-0 truncate"
              >
                {{ node.label }}
              </span>
              @for (badge of entry.badges; track badge) {
                @if (badge === 'error') {
                  <span [class]="BADGE_ACCENT" [etProvideColor]="errorTheme()">error</span>
                } @else if (badge === 'question') {
                  <span [class]="BADGE_ACCENT" data-tree-question>question</span>
                } @else if (badge === 'merging') {
                  <span [class]="BADGE_ACCENT" data-tree-merging>merging</span>
                } @else if (badge === 'changed') {
                  <span [class]="BADGE" [title]="CHANGED_OUTSIDE_SKETCH" data-tree-changed>changed</span>
                } @else {
                  <span [class]="BADGE">{{ badge }}</span>
                }
              }
              @if (entry.count) {
                <span [title]="entry.count + ' wireframe kit parts'" class="ml-auto opacity-70" data-tree-kit-count>
                  {{ entry.count }}
                </span>
              }
            </span>
          } @else {
            {{ node.label }}
            @if (countOf(node.value); as count) {
              <span class="ml-auto opacity-70">{{ count }}</span>
            }
          }
        </ng-template>
      </et-tree>
    </aside>

    <ng-template #themeBar>
      @for (themeSwitch of themeSwitches(); track themeSwitch.kind) {
        <div
          [attr.aria-label]="themeSwitch.label"
          class="flex gap-0.5 rounded-[0.6rem] border border-surface-border bg-surface p-0.5"
          role="group"
        >
          @for (name of themeSwitch.names; track name) {
            <button
              [pressed]="name === themeSwitch.current"
              (click)="pickTheme(themeSwitch.kind, name)"
              et-button
              type="button"
              variant="transparent"
              color="surface"
              size="xs"
            >
              {{ name }}
            </button>
          }
        </div>
      }
    </ng-template>

    <ng-template #noteBody let-note>
      <ethlete-note-body [note]="note" />
    </ng-template>

    <ng-template #noteModeButton>
      <button
        [pressed]="notesShown()"
        (click)="showNotes(!notesShown())"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        data-notes-shown
      >
        Show notes
      </button>
      <button
        [pressed]="noteStore.active()"
        (click)="toggleNotes()"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        title="Note mode"
        data-note-mode
      >
        Note
      </button>
    </ng-template>

    <ng-template #commentModeButton>
      <button
        [pressed]="commentStore.active()"
        (click)="toggleComments()"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        title="Comment mode (C)"
      >
        Comment
      </button>
      @if (commentStore.questions().length; as questions) {
        <button
          [title]="questions === 1 ? '1 question for you' : questions + ' questions for you'"
          [attr.aria-label]="questions === 1 ? '1 question for you' : questions + ' questions for you'"
          (click)="commentStore.showPanel(true)"
          class="-ml-1.5"
          et-button
          type="button"
          variant="filled"
          size="sm"
          data-comment-questions
        >
          {{ questions }} ?
        </button>
      }
      <button
        [pressed]="commentStore.panelOpen()"
        (click)="commentStore.showPanel(!commentStore.panelOpen())"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        title="Show the comments of the product"
      >
        Comments{{ commentStore.comments().length > 0 ? ' · ' + commentStore.comments().length : '' }}
      </button>
    </ng-template>

    <ng-template #newProductScreen let-heading>
      <div class="max-w-130 self-center justify-self-center p-6 text-small text-[var(--et-surface-color-subtle-solid)]">
        <h2 class="mb-2 text-h4 text-text">{{ heading }}</h2>
        @if (port(); as port) {
          @defer {
            <ethlete-new-product-form [port]="port" [products]="products()" (create)="showCreated($event)" />
          }
        }
        <p>Or run this in the checkout:</p>
        <div class="my-3 flex items-center gap-2">
          <pre class="m-0 flex-1 rounded-md border border-surface-border p-3 font-mono text-text">{{
            NEW_PRODUCT_COMMAND
          }}</pre>
          <button (click)="copyCommand()" et-button type="button" variant="outline" color="surface" size="sm">
            {{ copied() ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p>
          Its parts live in
          <code class="font-mono">.ethlete/design/&lt;product&gt;/&lt;layer&gt;/&lt;name&gt;</code>.
        </p>
      </div>
    </ng-template>

    <main class="relative grid min-h-0 min-w-0">
      @if (!port()) {
        <p [class]="NOTE">Start the design server to see the design system.</p>
      } @else if (creating()) {
        <ng-container [ngTemplateOutlet]="newProductScreen" [ngTemplateOutletContext]="{ $implicit: 'New product' }" />
      } @else if (call(); as shown) {
        <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <header class="flex items-center gap-3 border-b border-surface-border px-4 py-3">
            <div class="min-w-0 flex-1">
              <span class="font-mono text-[1.1rem] text-[var(--et-surface-color-subtle-solid)]">{{ shown.slug }}</span>
              @if ('headline' in shown) {
                <h2 class="m-0 mt-0.5 overflow-hidden text-[1.5rem] font-semibold text-ellipsis whitespace-nowrap">
                  {{ shown.headline }}
                </h2>
              }
            </div>
            <ng-container [ngTemplateOutlet]="themeBar" />
            @if ('transferred' in shown && shown.transferred) {
              <span [class]="BADGE">transferred</span>
            } @else if (!('error' in shown)) {
              <button
                [disabled]="transferring()"
                (click)="markTransferred(shown.slug)"
                et-button
                type="button"
                variant="outline"
                color="surface"
                size="sm"
              >
                Mark transferred
              </button>
            }
            @if (transferError(); as message) {
              <span [etProvideColor]="errorTheme()" class="text-[1.2rem] text-[var(--et-theme-color-primary-solid)]">{{
                message
              }}</span>
            }
          </header>
          <ethlete-design-canvas
            [frames]="callFrames()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            (cameraChange)="rememberCamera($event)"
            class="min-h-0"
          />
        </div>
      } @else if (reading(); as read) {
        @if (read.error) {
          <p [class]="NOTE">{{ read.error }}</p>
        } @else if (read.products.length === 0) {
          <ng-container
            [ngTemplateOutlet]="newProductScreen"
            [ngTemplateOutletContext]="{ $implicit: 'No product yet' }"
          />
        } @else if (sketchShown(); as shown) {
          <ethlete-sketch-view
            #sketchView
            [port]="shown.port"
            [product]="shown.product"
            [sketch]="shown.sketch"
            [part]="shown.part"
            [epoch]="epoch()"
            [revision]="sketchRevision()"
            [surface]="surface()"
            [color]="color()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            (cameraChange)="rememberCamera($event)"
            (decide)="reloadSketches()"
            (partOpen)="activate(shown.sketch.target)"
            (merging)="mergingSketch.set($event ? shown.sketch.target : null)"
            (mergeComplete)="selectMerged($event)"
          >
            <ng-container [ngTemplateOutlet]="themeBar" />
            <ng-container [ngTemplateOutlet]="commentModeButton" />
          </ethlete-sketch-view>
        } @else if (flowShown(); as shown) {
          <ethlete-flow-view
            #flowView
            [notesShown]="notesShown()"
            [port]="shown.port"
            [product]="shown.product"
            [flow]="shown.flow"
            [sketches]="sketches()"
            [epoch]="epoch()"
            [revision]="shown.revision"
            [surface]="surface()"
            [color]="color()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            (cameraChange)="rememberCamera($event)"
          >
            <ng-container [ngTemplateOutlet]="themeBar" />
            <ng-container [ngTemplateOutlet]="noteModeButton" />
            <ng-container [ngTemplateOutlet]="commentModeButton" />
          </ethlete-flow-view>
        } @else if (awaitingPicked()) {
        } @else if (part(); as partShown) {
          <div class="absolute top-3 right-4 z-1 flex gap-2">
            @if (partShown.listed.changedOutsideSketch) {
              <span [class]="BADGE + ' self-center'" [title]="CHANGED_OUTSIDE_SKETCH" data-changed-outside-sketch>
                changed
              </span>
            }
            @let madeBy = partShown.listed.madeBy ?? [];
            @if (madeBy.length > 0) {
              <span
                [title]="'made by ' + madeBy.join(', ')"
                class="self-center font-mono text-small whitespace-nowrap text-[var(--et-surface-color-subtle-solid)]"
                data-made-by
              >
                made by {{ AUTHORS_LABEL_OF(madeBy) }}
              </span>
            }
            <ng-container [ngTemplateOutlet]="themeBar" />
            <ng-container [ngTemplateOutlet]="noteModeButton" />
            <ng-container [ngTemplateOutlet]="commentModeButton" />
          </div>
          <ethlete-design-canvas
            #partCanvas
            [frames]="notedFrames()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            [pins]="partPins()"
            [pointing]="commentStore.active() || noteStore.active()"
            [pointingLabel]="noteStore.active() ? 'Note on' : 'Comment on'"
            [draft]="noteStore.draft() ?? commentStore.draft()"
            [pinPopover]="pinThread"
            [notes]="notesShown() ? partNotes() : []"
            [noteTemplate]="noteBody"
            (cameraChange)="rememberCamera($event)"
            (pointPick)="noteStore.active() ? startNote($event) : startComment(placeableFrames(), $event)"
            class="min-h-0"
          >
            @if (noteStore.draft()) {
              @defer {
                <ethlete-note-form canvasDraft />
              }
            } @else if (commentStore.draft()) {
              @defer {
                <ethlete-comment-draft canvasDraft />
              }
            }
          </ethlete-design-canvas>
        } @else {
          <p [class]="NOTE">This product has no parts yet.</p>
        }
      }
    </main>
    @if (commentStore.panelOpen() && commentable()) {
      <ethlete-comment-panel
        [comments]="commentStore.comments()"
        [resolved]="commentStore.resolved()"
        [resolvedShown]="commentStore.resolvedShown()"
        [loaded]="commentStore.loaded()"
        [loadError]="commentStore.loadError()"
        [interrupted]="commentStore.interrupted()"
        [selected]="shownPart()"
        (retry)="commentStore.retry()"
        (jump)="jumpTo($event)"
        (dismiss)="commentStore.showPanel(false)"
        (resolvedToggle)="commentStore.showResolved($event)"
      />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    SELECT_IMPORTS,
    NgTemplateOutlet,
    TREE_IMPORTS,
    DesignCanvasComponent,
    ProvideColorDirective,
    ProvideSurfaceDirective,
    SketchViewComponent,
    FlowViewComponent,
    NewProductFormComponent,
    CommentDraftComponent,
    CommentThreadComponent,
    CommentPanelComponent,
    NoteBodyComponent,
    NoteFormComponent,
    StudioMarkComponent,
  ],
  providers: [provideCommentStore(), provideNoteStore()],
  host: {
    class: 'grid min-h-0 grid-cols-[28rem_minmax(0,1fr)_auto]',
    '(window:keydown)': 'handleCommentKey($event)',
  },
})
export class SystemViewComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  protected commentStore = injectCommentStore();
  protected noteStore = injectNoteStore();
  private injector = inject(Injector);
  public port = input<number | null>(null);
  public epoch = input(0);
  public checkout = input('');

  public projectThemes = input<Record<string, Themes>>({});

  public tick = input(0);

  public frameRevisions = input(NO_FRAME_REVISIONS);
  private partCanvas = viewChild<DesignCanvasComponent>('partCanvas');
  private sketchView = viewChild<SketchViewComponent>('sketchView');
  private flowView = viewChild<FlowViewComponent>('flowView');
  protected readonly BADGE = BADGE;
  protected readonly CHANGED_OUTSIDE_SKETCH = CHANGED_OUTSIDE_SKETCH;

  protected readonly BADGE_ACCENT = BADGE_ACCENT;

  protected readonly NOTE = NOTE;

  protected readonly AUTHORS_LABEL_OF = authorsLabelOf;

  protected readonly NEW_PRODUCT_COMMAND = 'npx et design product new web';

  protected readonly NEW_PRODUCT = NEW_PRODUCT;

  protected copied = signal(false);

  private productReloads = signal(0);

  protected reading = toSignal(
    toObservable(
      computed(() => ({ port: this.port(), epoch: this.epoch(), tick: this.tick(), reloads: this.productReloads() })),
    ).pipe(
      switchMap(({ port }) =>
        port
          ? listedSystem$(port).pipe(
              map((products): Reading => ({ products, error: null })),
              catchError((error: unknown) =>
                of<Reading>({ products: [], error: error instanceof Error ? error.message : String(error) }),
              ),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected products = computed(() => this.reading()?.products ?? []);

  private callReloads = signal(0);

  private callList = toSignal(
    toObservable(
      computed(() => ({ port: this.port(), epoch: this.epoch(), tick: this.tick(), reloads: this.callReloads() })),
    ).pipe(switchMap(({ port }) => (port ? listedCalls$(port).pipe(catchError(() => of<ListedCall[]>([]))) : of([])))),
    { initialValue: null },
  );

  public calls = computed(() => this.callList() ?? []);

  private sketchReloads = signal(0);

  protected mergingSketch = signal<string | null>(null);

  private statusChanges = toSignal(
    designStatusChanges$().pipe(
      debounceTime(200),
      scan((count) => count + 1, 0),
      catchError(() => EMPTY),
    ),
    { initialValue: 0 },
  );

  private pickedProduct = signal(rememberedView().systemProduct ?? null);

  protected creating = signal(false);

  private picked = signal(rememberedView().systemEntry ?? null);

  private cameras = signal(rememberedView().movedCameras ?? {});

  protected transferring = signal(false);

  protected transferError = signal('');

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  protected pickerValue = computed(() => (this.creating() ? NEW_PRODUCT : (this.product()?.name ?? NEW_PRODUCT)));

  private sketchRead = toSignal(
    toObservable(
      computed(() => ({
        port: this.port(),
        product: this.product()?.name,
        epoch: this.epoch(),
        tick: this.tick(),
        reloads: this.sketchReloads(),
        statusChanges: this.statusChanges(),
      })),
    ).pipe(
      switchMap(({ port, product }) =>
        port && product
          ? listedSketches$(port, product).pipe(
              map(({ sketches }) => sketches),
              catchError(() => of<ListedSketch[]>([])),
              map((items) => ({ product, items })),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  private sketchList = computed(() => itemsOf(this.sketchRead(), this.product()?.name));

  public sketches = computed(() => this.sketchList() ?? []);

  private flowChanges = toSignal(
    toObservable(this.port).pipe(
      switchMap((port) =>
        port
          ? flowChanges$(port).pipe(
              scan((count) => count + 1, 0),
              catchError(() => EMPTY),
            )
          : EMPTY,
      ),
    ),
    { initialValue: 0 },
  );

  private flowRead = toSignal(
    toObservable(
      computed(() => ({
        port: this.port(),
        product: this.product()?.name,
        epoch: this.epoch(),
        tick: this.tick(),
        notes: this.noteStore.writes(),
        flows: this.flowChanges(),
      })),
    ).pipe(
      switchMap(({ port, product }) =>
        port && product
          ? listedFlows$({ port, product }).pipe(
              map(({ flows }) => flows),
              catchError(() => of<ListedFlow[]>([])),
              map((items) => ({ product, items })),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  private flowList = computed(() => itemsOf(this.flowRead(), this.product()?.name));

  private listsRead = computed(
    () => this.callList() !== null && this.sketchList() !== null && this.flowList() !== null,
  );

  private tree = computed(() =>
    withFlowGroup(
      treeOf(this.product()?.parts ?? [], {
        product: this.product(),
        calls: this.calls(),
        sketches: this.sketches(),
        comments: this.commentStore.comments(),
        merging: this.mergingSketch(),
      }),
      this.flowList() ?? [],
    ),
  );

  private flow = computed(
    () => (this.flowList() ?? []).find((listed) => flowKeyOf(listed.name) === this.picked()) ?? null,
  );

  protected flowShown = computed(() => {
    const port = this.port();
    const product = this.product();
    const flow = this.flow();

    if (!port || !product || !flow) return null;

    const revision = Math.max(
      0,
      ...flow.frames.map((frame) =>
        revisionOf(this.frameRevisions(), { product: product.name, part: frame.part, sketch: null, errored: false }),
      ),
    );

    return { port, product, flow, revision };
  });

  private sketch = computed(
    () => this.sketches().find((listed) => sketchKeyOf(listed.target) === this.picked()) ?? null,
  );

  protected sketchShown = computed(() => {
    const port = this.port();
    const product = this.product();
    const sketch = this.sketch();

    if (!port || !product || !sketch) return null;

    return {
      port,
      product,
      sketch,
      part: product.parts.find((candidate) => partKeyOf(candidate) === sketch.target) ?? null,
    };
  });

  protected sketchRevision = computed(() => {
    const shown = this.sketchShown();

    if (!shown) return 0;

    const { product, sketch, part } = shown;

    return sketchRevisionOf(this.frameRevisions(), {
      product: product.name,
      target: sketch.target,
      errored:
        failsToLoad(part?.problems ?? []) ||
        (sketch.targets ?? []).some((target) => !!target.error) ||
        sketch.problems.some((entry) => failsToLoad(entry.problems)),
    });
  });

  protected call = computed(() => this.calls().find((listed) => callKeyOf(listed.slug) === this.picked()) ?? null);

  private themePicks = signal(rememberedView().themes ?? {});

  private notesShownPicks = signal(rememberedView().notesShown ?? {});

  private notesKey = computed(() => {
    const product = this.product();

    return product ? themeKey(this.checkout(), product.name) : null;
  });

  protected notesShown = computed(() => {
    const key = this.notesKey();

    return key === null || (this.notesShownPicks()[key] ?? true);
  });

  /** The themes the shown entry names - a call's design project, else the product - with the name each frame wears. */
  private shownThemes = computed(() => {
    const call = this.call();
    const product = this.product();
    const project = call?.project ?? product?.name;

    if (!project) return null;

    const names = call ? this.projectThemes()[call.project] : product?.themes;
    const key = themeKey(this.checkout(), project);
    const pick = this.themePicks()[key] ?? {};
    const surface = names?.surface ?? [];
    const color = names?.color ?? [];

    return {
      key,
      surface: { names: surface, current: themeName(surface, pick.surface) },
      color: { names: color, current: themeName(color, pick.color) },
    };
  });

  protected surface = computed(() => this.shownThemes()?.surface.current);

  protected color = computed(() => this.shownThemes()?.color.current);

  protected themeSwitches = computed(() => {
    const themes = this.shownThemes();

    if (!themes) return [];

    return [
      { kind: 'surface' as const, label: 'Surface theme', ...themes.surface },
      { kind: 'color' as const, label: 'Colour theme', ...themes.color },
    ].filter((theme) => theme.names.length > 1);
  });

  protected callFrames = computed(() => {
    const port = this.port();
    const call = this.call();

    if (!port || !call) return [];

    return callFramesOf({
      port,
      call,
      epoch: this.epoch(),
      revision: this.tick(),
      surface: this.surface(),
      color: this.color(),
    });
  });

  private nodes = computed(() => {
    const entries = new Map<string, TreeEntry>();
    const counts = new Map<string, number>();
    const children = new Map<string | null, TreeNode<string>[]>();
    const frames = new Map<string, TreeFrame>();
    const leaf = (entry: TreeEntry): TreeNode<string> => {
      entries.set(entry.key, entry);

      if (!entry.frames) return { value: entry.key, label: entry.name, isLeaf: true };

      children.set(
        entry.key,
        entry.frames.map((frame) => {
          frames.set(frame.key, frame);

          return leaf({ key: frame.key, name: frame.name, badges: [] });
        }),
      );

      return { value: entry.key, label: entry.name };
    };
    const branch = (node: TreeGroup | TreeSection): TreeNode<string> => {
      const sections = 'sections' in node ? (node.sections ?? []) : [];

      children.set(node.key, [
        ...node.entries.map(leaf),
        ...sections.map((section) => {
          counts.set(section.key, section.entries.length);

          return branch(section);
        }),
      ]);

      return { value: node.key, label: node.label };
    };

    children.set(null, this.tree().map(branch));

    return { entries, counts, children, frames };
  });

  /** True while the remembered entry may still be a call or a sketch whose list has not arrived. */
  protected awaitingPicked = computed(() => {
    const picked = this.picked();

    return picked !== null && !this.listsRead() && !this.nodes().entries.has(picked);
  });

  protected part = computed(() => {
    const parts = this.product()?.parts ?? [];
    const first = treeOf(parts)[0]?.entries[0]?.key;
    const listed =
      parts.find((candidate) => partKeyOf(candidate) === this.picked()) ??
      (this.awaitingPicked() ? undefined : parts.find((candidate) => partKeyOf(candidate) === first));

    return listed ? { key: partKeyOf(listed), listed } : null;
  });

  protected selectedKey = computed(() => {
    const call = this.call();
    const sketch = this.sketch();

    const flow = this.flow();

    if (call) return callKeyOf(call.slug);
    if (flow) return flowKeyOf(flow.name);

    return sketch ? sketchKeyOf(sketch.target) : (this.part()?.key ?? null);
  });

  protected cameraKey = computed(() => {
    const call = this.call();
    const part = this.part();

    const sketch = this.sketch();

    if (call) return callKeyOf(call.slug);
    if (sketch) return `${this.product()?.name} ${sketchKeyOf(sketch.target)}`;

    const flow = this.flow();

    if (flow) return `${this.product()?.name} ${flowKeyOf(flow.name)}`;

    return part ? `${this.product()?.name} ${part.key}` : null;
  });

  protected restoredCamera = computed(() => {
    const key = this.cameraKey();

    return key ? (this.cameras()[key] ?? null) : null;
  });

  public frames = computed(() => {
    const port = this.port();
    const product = this.product();
    const part = this.part();

    if (!port || !product || !part) return [];

    return framesOf({
      port,
      product,
      part: part.listed,
      epoch: this.epoch(),
      revision: revisionOf(this.frameRevisions(), {
        product: product.name,
        part: part.key,
        sketch: null,
        errored: failsToLoad(part.listed.problems),
      }),
      surface: this.surface(),
      color: this.color(),
    });
  });

  private openGroups = linkedSignal<string[], Record<string, boolean>>({
    source: computed(() => holdersOf(this.tree(), this.selectedKey()), {
      equal: (a, b) => a.join('\n') === b.join('\n'),
    }),
    computation: (holders, previous) => ({
      ...(previous?.value ?? rememberedView().openGroups ?? {}),
      ...Object.fromEntries(holders.map((key) => [key, true])),
    }),
  });

  private openContext = computed<OpenContext>(() => ({
    remembered: this.openGroups(),
    hasProducts: this.products().length > 0,
  }));

  protected dataSource = computed<TreeDataSource<string>>(() => {
    const { children } = this.nodes();

    return { loadChildren: (parent) => children.get(parent?.value ?? null) ?? [] };
  });

  protected expandedValues = computed(() => {
    const context = this.openContext();
    const open = (node: TreeGroup | TreeSection, isOpen: boolean) => (isOpen ? [node.key] : []);
    const openParts = (node: TreeGroup | TreeSection) =>
      node.entries.flatMap((entry) => (entry.frames && context.remembered[entry.key] ? [entry.key] : []));

    return this.tree().flatMap((group) => [
      ...open(group, isGroupOpen(group, context)),
      ...openParts(group),
      ...(group.sections ?? []).flatMap((section) => [
        ...open(section, isSectionOpen(section, context)),
        ...openParts(section),
      ]),
    ]);
  });

  protected placeableFrames = computed(() => placeableFramesOf(this.frames()));
  protected partPins = computed(() => pinsOf(this.placeableFrames(), this.commentStore.comments()));
  protected partNotes = computed(() => partNotesOf(this.placeableFrames(), this.noteStore.notes()));
  protected notedFrames = computed(() =>
    withOtherSizeNotes(this.frames(), {
      comments: this.commentStore.comments(),
      notes: this.notesShown() ? this.noteStore.notes() : [],
      everyInteraction: true,
    }),
  );
  protected shownPart = computed(() => this.sketch()?.target ?? this.part()?.key ?? null);

  protected commentable = computed(
    () => !this.creating() && !this.call() && (this.sketchShown() !== null || this.part() !== null),
  );

  protected readonly BASE_LABEL_OF = baseLabelOf;

  constructor() {
    const source = computed(() => {
      const port = this.port();
      const product = this.product()?.name;

      return { address: port && product ? { port, product } : null, revision: this.tick() };
    });

    this.commentStore.connect(source);
    this.noteStore.connect(source);
  }

  protected toggleComments() {
    this.commentStore.toggle();
    if (this.commentStore.active()) this.noteStore.end();
  }

  protected showNotes(shown: boolean) {
    const key = this.notesKey();

    if (key === null) return;

    this.notesShownPicks.update((picks) => ({ ...picks, [key]: shown }));
    rememberNotesShown(key, shown);
  }

  protected toggleNotes() {
    this.noteStore.toggle();
    if (!this.noteStore.active()) return;

    this.commentStore.end();
    this.showNotes(true);
  }

  protected startNote(pick: FramePoint) {
    const draft = commentDraftOf(this.placeableFrames(), pick);

    if (draft) this.noteStore.start(draft);
  }

  protected startComment(frames: CanvasFrame[], pick: FramePoint) {
    const draft = commentDraftOf(frames, pick);

    if (draft) this.commentStore.start(draft);
  }

  protected handleCommentKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && (this.noteStore.draft() || this.noteStore.editing())) return this.noteStore.cancel();
    if (event.key === 'Escape' && this.noteStore.active()) return this.noteStore.end();
    if (!this.commentable()) return;
    if (event.key === 'Escape' && this.commentStore.draft()) this.commentStore.cancel();
    else if (event.key === 'Escape' && this.commentStore.active()) this.commentStore.end();
    else if (isCommentModeKey(event) && !event.repeat) this.toggleComments();
  }

  /** Opens the pin of a comment on the shown flow, else shows the part or sketch it sits on, moves the camera to its pin and opens it. */
  protected jumpTo(comment: NumberedComment) {
    if (this.flowView()?.jumpTo(comment)) return;

    const sketchKey = sketchKeyOf(comment.part);
    const key = comment.sketch && this.nodes().entries.has(sketchKey) ? sketchKey : comment.part;

    if (key === this.selectedKey()) this.focusComment(comment);
    else {
      this.activate(key);
      afterNextRender(() => this.focusComment(comment), { injector: this.injector });
    }
  }

  protected entryOf(value: unknown) {
    return typeof value === 'string' ? this.nodes().entries.get(value) : undefined;
  }

  protected countOf(value: unknown) {
    return typeof value === 'string' ? this.nodes().counts.get(value) : undefined;
  }

  protected rememberOpen(expanded: readonly string[]) {
    const was = this.expandedValues();
    const changes = [...this.nodes().children.keys()].flatMap((key) =>
      key !== null && expanded.includes(key) !== was.includes(key) ? [[key, expanded.includes(key)] as const] : [],
    );

    if (changes.length === 0) return;

    const openGroups = { ...this.openGroups(), ...Object.fromEntries(changes) };

    this.openGroups.set(openGroups);
    rememberView({ openGroups });
  }

  protected activate(key: string) {
    const frame = this.nodes().frames.get(key);

    if (frame) return this.openFrame(frame);
    if (!this.nodes().entries.has(key)) return;

    this.creating.set(false);
    this.picked.set(key);
    rememberView({ systemEntry: key });
  }

  protected pickProduct(systemProduct: string) {
    this.creating.set(systemProduct === NEW_PRODUCT);

    if (systemProduct === NEW_PRODUCT) return;

    this.pickedProduct.set(systemProduct);
    rememberView({ systemProduct });
  }

  protected showCreated(systemProduct: string) {
    this.pickProduct(systemProduct);
    this.productReloads.update((value) => value + 1);
  }

  protected pickTheme(kind: keyof ThemePick, name: string) {
    const key = this.shownThemes()?.key;

    if (!key) return;

    this.themePicks.update((picks) => ({ ...picks, [key]: { ...picks[key], [kind]: name } }));
    rememberTheme(key, { [kind]: name });
  }

  protected rememberCamera(camera: Camera | null) {
    const key = this.cameraKey();

    if (!key) return;

    const existing = this.listsRead()
      ? new Set([
          ...this.calls().map((listed) => callKeyOf(listed.slug)),
          ...this.products().flatMap((listed) => listed.parts.map((part) => `${listed.name} ${partKeyOf(part)}`)),
          ...this.sketches().map((listed) => `${listed.product} ${sketchKeyOf(listed.target)}`),
        ])
      : null;
    const cameras = camerasWith({ cameras: this.cameras(), key, camera, existing });

    this.cameras.set(cameras);
    rememberView({ movedCameras: cameras });
  }

  protected copyCommand() {
    from(navigator.clipboard.writeText(this.NEW_PRODUCT_COMMAND))
      .pipe(
        tap(() => this.copied.set(true)),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected selectMerged(target: string) {
    this.creating.set(false);
    this.picked.set(target);
    rememberView({ systemEntry: target });
  }

  protected reloadSketches() {
    this.sketchReloads.update((value) => value + 1);
  }

  protected markTransferred(slug: string) {
    const port = this.port();

    if (!port || this.transferring()) return;

    this.transferring.set(true);
    this.transferError.set('');

    transferCall$(port, slug)
      .pipe(
        catchError((error: unknown) => {
          this.transferError.set(error instanceof Error ? error.message : String(error));

          return of(null);
        }),
        finalize(() => {
          this.transferring.set(false);
          this.callReloads.update((value) => value + 1);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private openFrame({ part, frame }: TreeFrame) {
    if (part === this.selectedKey()) return this.partCanvas()?.focusFrame(frame);

    this.activate(part);
    afterNextRender(() => this.partCanvas()?.focusFrame(frame), { injector: this.injector });
  }

  private focusComment(comment: NumberedComment) {
    const sketchView = this.sketchView();
    const canvas = this.partCanvas();

    if (sketchView) return sketchView.jumpTo(comment);
    if (!canvas) return;

    const frame = otherSizeFrameOf(this.placeableFrames(), comment);

    if (this.partPins().some((pin) => pin.id === comment.id)) canvas.openPin(comment.id);
    else if (frame) canvas.focusFrame(frame);
  }
}
