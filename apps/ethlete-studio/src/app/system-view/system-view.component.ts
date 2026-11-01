import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, TreeNode } from '@ethlete/components';
import { PartTreeComponent, PartTreeLayer, PartTreePart } from '../design-parts/part-tree/part-tree.component';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, catchError, concat, debounceTime, finalize, from, map, of, scan, switchMap, tap } from 'rxjs';
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
  pickedPartKeyOf,
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
import { InboxComponent, InboxLoad } from '../design-parts/inbox/inbox.component';
import { ShellMainComponent, ShellSection } from '../design-parts/shell-main/shell-main.component';
import { inboxCommentOf, inboxPartOf } from './inbox-comments';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { NewProductFormComponent } from './new-product-form.component';
import { SketchViewComponent } from './sketch-view.component';
import { FlowViewComponent } from './flow-view.component';
import { NoteBodyComponent } from './note-body.component';
import { NoteFormComponent } from './note-form.component';
import { partNotesOf } from './note-places';
import { InventoryViewComponent } from './inventory-view.component';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { PageShell, PageShellAction } from './page-shell';
import { ExceptionListComponent } from './exception-list.component';
import { MotionStripComponent } from './motion-strip.component';
import { injectNoteStore, provideNoteStore } from './note-store';
import { injectViewContext, selectionOf, stateOf } from '../chat/view-context';
import { flowKeyOf, withFlowGroup } from './flow-frames';
import { ListedFlow, flowChanges$, listedFlows$ } from '../../host/design-flows';
import { NO_FRAME_REVISIONS, revisionOf, sketchRevisionOf } from '../studio-view/frame-revisions';
import { NO_LIST_REVISIONS } from '../studio-view/list-revisions';

type Reading = { products: ListedProduct[]; error: string | null };

const BADGE =
  'shrink-0 whitespace-nowrap rounded-full border border-(--et-surface-border-solid) px-1.5 py-px text-[1rem] text-(--et-surface-color-subtle-solid)';

const CHANGED_OUTSIDE_SKETCH = STUDIO_LABELS.shell.changedOutsideSketch;

/** A product switch keeps the old read until the new product answers; that read must not show. */
const itemsOf = <T>(read: { product: string; items: T[] } | null, product: string | undefined) =>
  read && read.product === product ? read.items : null;

/** Never a product name: a product is a directory, and a directory name holds no slash. */
const NEW_PRODUCT = '/new';

const NOTE = 'm-0 max-w-130 self-center justify-self-center p-6 text-small text-(--et-surface-color-subtle-solid)';

const failsToLoad = (problems: { rule: string }[]) => problems.some((problem) => problem.rule === 'LOAD');

@Component({
  selector: 'ethlete-system-view',
  template: `
    <ng-template #pinThread let-pin>
      @defer {
        <ethlete-comment-thread [commentId]="pin.id" />
      }
    </ng-template>

    <ng-template #sideTree>
      <ethlete-part-tree
        [layers]="partTreeLayers()"
        [label]="LABELS.designSystem"
        (expandedChange)="rememberOpen($event)"
        (activate)="activate($event)"
        class="p-2"
      />
    </ng-template>

    <ng-template #themeBar>
      @for (themeSwitch of themeSwitches(); track themeSwitch.kind) {
        <div
          [attr.aria-label]="themeSwitch.label"
          class="flex gap-0.5 rounded-[0.6rem] border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-0.5"
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
        {{ LABELS.showNotes }}
      </button>
      <button
        [pressed]="noteStore.active()"
        [title]="LABELS.noteMode"
        (click)="toggleNotes()"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        data-note-mode
      >
        {{ LABELS.note }}
      </button>
    </ng-template>

    <ng-template #commentModeButton>
      <button
        [pressed]="commentStore.active()"
        [title]="LABELS.commentMode"
        (click)="toggleComments()"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
      >
        {{ LABELS.comment }}
      </button>
      @if (commentStore.questions().length; as questions) {
        <button
          [title]="LABELS.questionsForYou(questions)"
          [attr.aria-label]="LABELS.questionsForYou(questions)"
          (click)="pickSection('Inbox')"
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
    </ng-template>

    <ng-template #newProductScreen let-heading>
      <div class="max-w-130 self-center justify-self-center p-6 text-small text-(--et-surface-color-subtle-solid)">
        <h2 class="mb-2 text-h4 text-text">{{ heading }}</h2>
        @if (port(); as port) {
          @defer {
            <ethlete-new-product-form [port]="port" [products]="products()" (create)="showCreated($event)" />
          }
        }
        <p>{{ LABELS.runInCheckout }}</p>
        <div class="my-3 flex items-center gap-2">
          <pre class="m-0 flex-1 rounded-md border border-(--et-surface-border-solid) p-3 font-mono text-text">{{
            NEW_PRODUCT_COMMAND
          }}</pre>
          <button (click)="copyCommand()" et-button type="button" variant="outline" color="surface" size="sm">
            {{ copied() ? LABELS.copied : LABELS.copy }}
          </button>
        </div>
        <p>
          {{ LABELS.partsLiveIn }}
          <code class="font-mono">.ethlete/design/&lt;product&gt;/&lt;layer&gt;/&lt;name&gt;</code>.
        </p>
      </div>
    </ng-template>

    <ng-template #shellCanvas>
      <main class="relative grid size-full min-h-0 min-w-0 pl-(--st-shell-inset-left)">
        @if (!port()) {
          <p [class]="NOTE">{{ LABELS.startServer }}</p>
        } @else if (creating()) {
          <ng-container
            [ngTemplateOutlet]="newProductScreen"
            [ngTemplateOutletContext]="{ $implicit: LABELS.newProduct }"
          />
        } @else if (call(); as shown) {
          <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <header class="flex items-center gap-3 border-b border-(--et-surface-border-solid) px-4 py-3">
              <div class="min-w-0 flex-1">
                <span class="font-mono text-[1.1rem] text-(--et-surface-color-subtle-solid)">{{ shown.slug }}</span>
                @if ('headline' in shown) {
                  <h2 class="m-0 mt-0.5 overflow-hidden text-[1.5rem] font-semibold text-ellipsis whitespace-nowrap">
                    {{ shown.headline }}
                  </h2>
                }
              </div>
              <ng-container [ngTemplateOutlet]="themeBar" />
              @if ('transferred' in shown && shown.transferred) {
                <span [class]="BADGE">{{ LABELS.transferred }}</span>
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
                  {{ LABELS.markTransferred }}
                </button>
              }
              @if (transferError(); as message) {
                <span [etProvideColor]="errorTheme()" class="text-[1.2rem] text-(--et-theme-color-primary-solid)">{{
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
              [ngTemplateOutletContext]="{ $implicit: LABELS.noProductYet }"
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
              [view]="view()"
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
              [view]="view()"
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
                  {{ LABELS.changed }}
                </span>
              }
              @let madeBy = partShown.listed.madeBy ?? [];
              @if (madeBy.length > 0) {
                <span
                  [title]="LABELS.madeBy + ' ' + madeBy.join(', ')"
                  class="self-center font-mono text-small whitespace-nowrap text-(--et-surface-color-subtle-solid)"
                  data-made-by
                >
                  {{ LABELS.madeBy }} {{ AUTHORS_LABEL_OF(madeBy) }}
                </span>
              }
              @if (port(); as port) {
                <ethlete-exception-list
                  [port]="port"
                  [product]="product()?.name ?? ''"
                  [part]="partShown.key"
                  [revision]="productsRevision()"
                />
              }
              @if (partShown.listed.layer === 'pages') {
                <button
                  [pressed]="inventoryShown()"
                  (click)="toggleInventory()"
                  et-button
                  type="button"
                  variant="outline"
                  color="surface"
                  size="sm"
                  data-inventory-toggle
                >
                  {{ INVENTORY_LABELS.toggle }}
                </button>
              }
              <ng-container [ngTemplateOutlet]="themeBar" />
              <ng-container [ngTemplateOutlet]="noteModeButton" />
              <ng-container [ngTemplateOutlet]="commentModeButton" />
            </div>
            <div class="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
              <ethlete-design-canvas
                #partCanvas
                [frames]="notedFrames()"
                [cameraKey]="cameraKey()"
                [restoredCamera]="restoredCamera()"
                [pins]="partPins()"
                [pointing]="commentStore.active() || noteStore.active()"
                [pointingLabel]="noteStore.active() ? LABELS.noteOn : LABELS.commentOn"
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
              @if (partMotions(); as motions) {
                @if (port(); as port) {
                  <ethlete-motion-strip
                    [port]="port"
                    [product]="product()?.name ?? ''"
                    [part]="partShown.key"
                    [motions]="motions"
                    [presets]="presetNames()"
                    [surface]="surface()"
                    [color]="color()"
                    [revision]="productsRevision()"
                    [canvas]="partCanvas"
                    class="max-h-[45vh] overflow-y-auto"
                  />
                }
              }
            </div>
          } @else {
            <p [class]="NOTE">{{ LABELS.noParts }}</p>
          }
        }
      </main>
    </ng-template>

    @if (section() === 'Inbox') {
      <ethlete-inbox
        [comments]="inboxComments()"
        [activePart]="activePart()"
        [selectedId]="null"
        [showResolved]="commentStore.resolvedShown()"
        [product]="product()?.name ?? ''"
        [products]="productNames()"
        [project]="project()"
        [projects]="projects()"
        [panel]="panel()"
        [load]="inboxLoad()"
        (showResolvedChange)="commentStore.showResolved($event)"
        (retry)="commentStore.retry()"
        (pick)="jumpToComment($event)"
        (collapse)="panel.set('hidden')"
        (sectionChange)="pickSection($event)"
        (productChange)="pickProduct($event)"
        (allProducts)="pickProduct(NEW_PRODUCT)"
        (projectChange)="projectChange.emit($event)"
        (openProject)="openProject.emit()"
        class="h-full!"
      >
        <ng-container [ngTemplateOutlet]="shellCanvas" />
      </ethlete-inbox>
    } @else if (inventoryPage(); as page) {
      @defer {
        <ethlete-inventory-view
          [port]="page.port"
          [product]="product()?.name ?? ''"
          [part]="page.part"
          [shell]="pageShell()"
          (inventoryToggle)="toggleInventory()"
          (expandedChange)="rememberOpen($event)"
          (shellAction)="runShellAction($event)"
        />
      }
    } @else {
      <ethlete-shell-main
        [section]="section()"
        [product]="product()?.name ?? ''"
        [products]="productNames()"
        [project]="project()"
        [projects]="projects()"
        [panel]="panel()"
        (collapse)="panel.set('hidden')"
        (sectionChange)="pickSection($event)"
        (productChange)="pickProduct($event)"
        (allProducts)="pickProduct(NEW_PRODUCT)"
        (projectChange)="projectChange.emit($event)"
        (openProject)="openProject.emit()"
        fill
      >
        <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto" shellMainSide>
          <ng-container [ngTemplateOutlet]="sideTree" />
        </div>
        <ng-container [ngTemplateOutlet]="shellCanvas" />
      </ethlete-shell-main>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    NgTemplateOutlet,
    PartTreeComponent,
    DesignCanvasComponent,
    ProvideColorDirective,
    SketchViewComponent,
    FlowViewComponent,
    NewProductFormComponent,
    CommentDraftComponent,
    CommentThreadComponent,
    InboxComponent,
    ShellMainComponent,
    NoteBodyComponent,
    NoteFormComponent,
    InventoryViewComponent,
    ExceptionListComponent,
    MotionStripComponent,
  ],
  providers: [provideCommentStore(), provideNoteStore()],
  host: {
    class: 'block size-full min-h-0',
    '(window:keydown)': 'handleCommentKey($event)',
  },
})
export class SystemViewComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  protected commentStore = injectCommentStore();
  protected noteStore = injectNoteStore();
  private viewContext = injectViewContext();
  private injector = inject(Injector);
  public port = input<number | null>(null);
  public epoch = input(0);
  public checkout = input('');
  public project = input('');
  public projects = input<string[]>([]);

  public projectThemes = input<Record<string, Themes>>({});
  public lists = input(NO_LIST_REVISIONS);

  public frameRevisions = input(NO_FRAME_REVISIONS);

  public projectChange = output<string>();

  public openProject = output();

  public partCanvas = viewChild<DesignCanvasComponent>('partCanvas');

  private sketchView = viewChild<SketchViewComponent>('sketchView');

  private flowView = viewChild<FlowViewComponent>('flowView');

  protected productsRevision = computed(() => this.lists().products);

  private callsRevision = computed(() => this.lists().calls);
  private sketchesRevision = computed(() => this.lists().sketches);
  private flowsRevision = computed(() => this.lists().flows);
  private allRevision = computed(() => this.lists().all);
  protected readonly BADGE = BADGE;
  protected readonly CHANGED_OUTSIDE_SKETCH = CHANGED_OUTSIDE_SKETCH;

  protected readonly NOTE = NOTE;

  protected readonly AUTHORS_LABEL_OF = authorsLabelOf;

  protected readonly NEW_PRODUCT_COMMAND = 'npx et design product new web';
  protected readonly INVENTORY_LABELS = STUDIO_LABELS.inventory;
  protected readonly LABELS = STUDIO_LABELS.shell;

  protected readonly NEW_PRODUCT = NEW_PRODUCT;

  protected copied = signal(false);

  private productReloads = signal(0);

  protected reading = toSignal(
    toObservable(
      computed(() => ({
        port: this.port(),
        epoch: this.epoch(),
        revision: this.productsRevision(),
        reloads: this.productReloads(),
      })),
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
      computed(() => ({
        port: this.port(),
        epoch: this.epoch(),
        revision: this.callsRevision(),
        reloads: this.callReloads(),
      })),
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

  protected inventoryShown = signal(rememberedView().inventoryShown ?? false);

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  protected productNames = computed(() => this.products().map((listed) => listed.name));

  private sketchRead = toSignal(
    toObservable(
      computed(() => ({
        port: this.port(),
        product: this.product()?.name,
        epoch: this.epoch(),
        revision: this.sketchesRevision(),
        reloads: this.sketchReloads(),
        statusChanges: this.statusChanges(),
      })),
    ).pipe(
      scan(
        (known: { port: number | null; product: string | undefined; first: boolean }, request) => ({
          port: request.port,
          product: request.product,
          first: known.port !== request.port || known.product !== request.product,
        }),
        { port: null, product: undefined, first: true },
      ),
      switchMap(({ port, product, first }) =>
        port && product
          ? (first
              ? concat(listedSketches$({ port, product, quick: true }), listedSketches$({ port, product }))
              : listedSketches$({ port, product })
            ).pipe(
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
        revision: this.flowsRevision(),
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
      { kind: 'surface' as const, label: STUDIO_LABELS.shell.surfaceTheme, ...themes.surface },
      { kind: 'color' as const, label: STUDIO_LABELS.shell.colorTheme, ...themes.color },
    ].filter((theme) => theme.names.length > 1);
  });

  private nodes = computed(() => {
    const entries = new Map<string, TreeEntry>();
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

      children.set(node.key, [...node.entries.map(leaf), ...sections.map(branch)]);

      return { value: node.key, label: node.label };
    };

    children.set(null, this.tree().map(branch));

    return { entries, children, frames };
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
      (this.awaitingPicked()
        ? undefined
        : (parts.find((candidate) => partKeyOf(candidate) === pickedPartKeyOf(this.picked())) ??
          parts.find((candidate) => partKeyOf(candidate) === first)));

    return listed ? { key: partKeyOf(listed), listed } : null;
  });

  public selectedKey = computed(() => {
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

  public view = linkedSignal<string | null, number>({
    source: this.cameraKey,
    computation: (_key, previous) => Math.max(Date.now(), (previous?.value ?? 0) + 1),
  });

  protected callFrames = computed(() => {
    const port = this.port();
    const call = this.call();

    if (!port || !call) return [];

    return callFramesOf({
      port,
      call,
      epoch: this.epoch(),
      revision: this.callsRevision(),
      view: this.view(),
      surface: this.surface(),
      color: this.color(),
    });
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
      view: this.view(),
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

  public expandedValues = computed(() => {
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

  protected partTreeLayers = computed<PartTreeLayer[]>(() => {
    const open = new Set(this.expandedValues());
    const selected = this.selectedKey();
    const partOf = (entry: TreeEntry): PartTreePart => ({
      name: entry.name,
      key: entry.key,
      selected: entry.key === selected,
      ...(entry.badges.includes('error') ? { warns: entry.title ?? true } : {}),
      ...(entry.frames
        ? { open: open.has(entry.key), states: entry.frames.map(({ key, name }) => ({ key, name })) }
        : { leaf: true }),
    });
    const sectionOf = (section: TreeSection): PartTreePart => ({
      name: section.label,
      key: section.key,
      open: open.has(section.key),
      states: section.entries.map(({ key, name }) => ({ key, name, selected: key === selected })),
    });

    return this.tree().map((group) => ({
      title: group.label,
      key: group.key,
      open: open.has(group.key),
      parts: [...group.entries.map(partOf), ...(group.sections ?? []).map(sectionOf)],
    }));
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
  protected partMotions = computed(() => {
    const motions = this.part()?.listed.motions;

    return motions && Object.keys(motions).length > 0 ? motions : null;
  });
  protected presetNames = computed(() => Object.keys(this.product()?.presets ?? {}));
  public shownPart = computed(() => this.sketch()?.target ?? this.part()?.key ?? null);

  public commentable = computed(
    () => !this.creating() && !this.call() && (this.sketchShown() !== null || this.part() !== null),
  );

  protected panel = signal<'open' | 'hidden'>('open');

  protected pageShell = computed<PageShell>(() => ({
    tree: this.partTreeLayers(),
    product: this.product()?.name ?? '',
    products: this.productNames(),
    project: this.project(),
    projects: this.projects(),
    panel: this.panel(),
  }));

  private railSection = signal<Exclude<ShellSection, 'Inbox'>>('System');

  protected section = computed<ShellSection>(() => (this.commentStore.panelOpen() ? 'Inbox' : this.railSection()));

  protected inventoryPage = computed(() => {
    const port = this.port();
    const part = this.part();
    const read = this.reading();

    if (!port || !part || !read || read.error || read.products.length === 0) return null;
    if (this.section() !== 'System' || this.creating() || this.call() || this.awaitingPicked()) return null;
    if (this.sketchShown() || this.flowShown()) return null;

    return this.inventoryShown() && part.listed.layer === 'pages' ? { port, part: part.key } : null;
  });

  protected inboxLoad = computed<InboxLoad>(() => {
    if (this.commentStore.loaded()) return 'loaded';

    return this.commentStore.loadError() ? 'error' : 'loading';
  });

  protected inboxComments = computed(() => {
    const now = Date.now();

    return [...this.commentStore.comments(), ...this.commentStore.resolved()].map((comment) =>
      inboxCommentOf(comment, now),
    );
  });

  protected activePart = computed(() => inboxPartOf(this.shownPart() ?? ''));

  constructor() {
    const source = computed(() => {
      const port = this.port();
      const product = this.product()?.name;

      return { address: port && product ? { port, product } : null, revision: this.allRevision() };
    });

    this.commentStore.connect(source);
    this.noteStore.connect(source);

    effect(() => {
      const product = this.product();

      if (!product || this.creating() || this.call()) {
        this.viewContext.drop('system');

        return;
      }

      const sketch = this.sketch();
      const canvas = this.partCanvas();
      const part = sketch?.target ?? (this.flow() ? null : (this.part()?.key ?? null));

      this.viewContext.put('system', {
        product: product.name,
        part,
        partFile: product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? null,
        sketch: sketch?.target ?? null,
        sketchDir: sketch?.dir ?? null,
        selection: canvas ? selectionOf(canvas.frames(), canvas.selectedId()) : null,
        state: canvas ? stateOf(canvas.frames(), { id: canvas.selectedId(), cellId: canvas.selectedCellId() }) : null,
      });
    });
    this.destroyRef.onDestroy(() => this.viewContext.drop('system'));
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
  public jumpTo(comment: NumberedComment) {
    if (this.flowView()?.jumpTo(comment)) return;

    const sketchKey = sketchKeyOf(comment.part);
    const key = comment.sketch && this.nodes().entries.has(sketchKey) ? sketchKey : comment.part;

    if (key === this.selectedKey()) this.focusComment(comment);
    else {
      this.activate(key);
      afterNextRender(() => this.focusComment(comment), { injector: this.injector });
    }
  }

  protected pickSection(section: ShellSection) {
    this.panel.set('open');
    this.commentStore.showPanel(section === 'Inbox');

    if (section !== 'Inbox') this.railSection.set(section);
  }

  protected jumpToComment(id: string) {
    const comment = this.commentStore.comments().find((open) => open.id === id);

    if (comment) this.jumpTo(comment);
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

  protected runShellAction(action: PageShellAction) {
    switch (action.kind) {
      case 'pick':
        return this.activate(action.key);
      case 'collapse':
        return this.panel.set('hidden');
      case 'section':
        return this.pickSection(action.section);
      case 'product':
        return this.pickProduct(action.name);
      case 'allProducts':
        return this.pickProduct(NEW_PRODUCT);
      case 'project':
        return this.projectChange.emit(action.name);
      case 'openProject':
        return this.openProject.emit();
    }
  }

  protected toggleInventory() {
    const inventoryShown = !this.inventoryShown();

    this.inventoryShown.set(inventoryShown);
    rememberView({ inventoryShown });
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
