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
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, TreeNode } from '@ethlete/components';
import { PartTreeComponent, PartTreeLayer, PartTreePart } from '../design-parts/part-tree/part-tree.component';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, catchError, concat, debounceTime, finalize, from, map, of, scan, switchMap } from 'rxjs';
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
import { placeableFramesOf } from '../components/design-canvas/canvas-frame';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import {
  ThemePick,
  camerasWith,
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
import { NumberedComment, otherSizeFrameOf } from './comment-pins';
import { InboxComponent, InboxLoad } from '../design-parts/inbox/inbox.component';
import { StartComponent } from '../design-parts/start/start.component';
import { SystemEmptyComponent } from '../design-parts/system-page/system-empty.component';
import { ShellSection } from '../design-parts/shell-main/shell-main.component';
import { ShellPageComponent } from '../design-parts/shell-main/shell-page.component';
import { inboxCommentOf, inboxPartOf } from './inbox-comments';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { SketchViewComponent } from './sketch-view.component';
import { FlowViewComponent } from './flow-view.component';
import { InventoryViewComponent } from './inventory-view.component';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { PageShell, PageShellAction } from './page-shell';
import { ExceptionListComponent } from './exception-list.component';
import { openPointGroupsOf } from './open-points';
import { partOpenPoints$ } from '../../host/design-open-points';
import { OpenPointsChipComponent } from '../design-parts/system-page/open-points-chip.component';
import { flowKeyOf, withFlowGroup } from './flow-frames';
import { ListedFlow, flowChanges$, listedFlows$ } from '../../host/design-flows';
import { NO_FRAME_REVISIONS, revisionOf, sketchRevisionOf } from '../studio-view/frame-revisions';
import { NO_LIST_REVISIONS } from '../studio-view/list-revisions';

type Reading = { products: ListedProduct[]; error: string | null };

const BADGE =
  'shrink-0 whitespace-nowrap rounded-full border border-(--et-surface-border-solid) px-1.5 py-px text-[1rem] text-(--et-surface-color-subtle-solid)';

/** A product switch keeps the old read until the new product answers; that read must not show. */
const itemsOf = <T>(read: { product: string; items: T[] } | null, product: string | undefined) =>
  read && read.product === product ? read.items : null;

const PART_ZOOM_CHIP_CLASS =
  'absolute bottom-space-3 right-[max(var(--space-3),calc(100%-var(--spacing)*250+var(--space-3)))]';

const NOTE = 'm-0 max-w-130 self-center justify-self-center p-6 text-small text-(--et-surface-color-subtle-solid)';

const failsToLoad = (problems: { rule: string }[]) => problems.some((problem) => problem.rule === 'LOAD');

@Component({
  selector: 'ethlete-system-view',
  template: `
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

    <ng-template #shellCanvas>
      <main class="relative grid size-full min-h-0 min-w-0 pl-(--st-shell-inset-left)">
        @if (!port()) {
          <p [class]="NOTE">{{ LABELS.startServer }}</p>
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
              class="-ms-(--st-shell-inset-left) min-h-0"
            />
          </div>
        } @else if (reading(); as read) {
          @if (read.error) {
            <p [class]="NOTE">{{ read.error }}</p>
          } @else if (sketchShown()) {
          } @else if (flowShown()) {
          } @else if (awaitingPicked()) {
          } @else if (part(); as partShown) {
            <div class="absolute top-space-3 right-space-3 z-1 flex gap-2">
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
              <ethlete-open-points-chip [part]="partShown.key" [groups]="openPointGroups()" />
            </div>
            <ethlete-design-canvas
              #partCanvas
              [frames]="frames()"
              [cameraKey]="cameraKey()"
              [restoredCamera]="restoredCamera()"
              [zoomChipClass]="PART_ZOOM_CHIP_CLASS"
              (cameraChange)="rememberCamera($event)"
              class="-ms-(--st-shell-inset-left) min-h-0"
            />
          } @else {
            <ethlete-system-empty
              [product]="product()?.name ?? ''"
              (copyPrompt)="copyText(EMPTY_LABELS.emptyPrompt(product()?.name ?? ''))"
              flush
            />
          }
        }
      </main>
    </ng-template>

    @if (startPage(); as start) {
      <ethlete-start
        [repo]="start.repo"
        (copyPrompt)="copyText(START_LABELS.prompt(start.repo))"
        (otherRepo)="openProject.emit()"
        (openRepo)="openProject.emit()"
      />
    } @else if (section() === 'Inbox') {
      <ethlete-inbox
        [comments]="inboxComments()"
        [activePart]="activePart()"
        [selectedId]="null"
        [showResolved]="commentStore.resolvedShown()"
        [shell]="pageShell()"
        [load]="inboxLoad()"
        (showResolvedChange)="commentStore.showResolved($event)"
        (retry)="commentStore.retry()"
        (pick)="jumpToComment($event)"
        (shellAction)="runShellAction($event)"
        class="h-full!"
      >
        <ng-container [ngTemplateOutlet]="shellCanvas" />
      </ethlete-inbox>
    } @else if (flowsPage(); as page) {
      <ethlete-flow-view
        [port]="page.port"
        [product]="page.product"
        [flows]="page.flows"
        [flow]="page.flow"
        [sketches]="sketches()"
        [epoch]="epoch()"
        [revision]="page.revision"
        [view]="view()"
        [surface]="surface()"
        [color]="color()"
        [shell]="pageShell()"
        (shellAction)="runShellAction($event)"
      />
    } @else if (sketchPage(); as shown) {
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
        [shell]="pageShell()"
        (decide)="reloadSketches()"
        (merging)="mergingSketch.set($event ? shown.sketch.target : null)"
        (mergeComplete)="selectMerged($event)"
        (expandedChange)="rememberOpen($event)"
        (shellAction)="runShellAction($event)"
      />
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
      <ethlete-shell-page [section]="section()" [shell]="pageShell()" (action)="runShellAction($event)">
        <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto" shellMainSide>
          <ng-container [ngTemplateOutlet]="sideTree" />
        </div>
        <ng-container [ngTemplateOutlet]="shellCanvas" />
      </ethlete-shell-page>
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
    InboxComponent,
    ShellPageComponent,
    SystemEmptyComponent,
    StartComponent,
    InventoryViewComponent,
    ExceptionListComponent,
    OpenPointsChipComponent,
  ],
  providers: [provideCommentStore()],
  host: { class: 'block size-full min-h-0' },
})
export class SystemViewComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  protected commentStore = injectCommentStore();
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

  protected productsRevision = computed(() => this.lists().products);

  private callsRevision = computed(() => this.lists().calls);
  private sketchesRevision = computed(() => this.lists().sketches);
  private flowsRevision = computed(() => this.lists().flows);
  private allRevision = computed(() => this.lists().all);
  protected readonly BADGE = BADGE;

  protected readonly NOTE = NOTE;
  protected readonly PART_ZOOM_CHIP_CLASS = PART_ZOOM_CHIP_CLASS;

  protected readonly LABELS = STUDIO_LABELS.shell;
  protected readonly INVENTORY_LABELS = STUDIO_LABELS.inventory;
  protected readonly START_LABELS = STUDIO_LABELS.start;
  protected readonly EMPTY_LABELS = STUDIO_LABELS.system;

  protected reading = toSignal(
    toObservable(
      computed(() => ({
        port: this.port(),
        epoch: this.epoch(),
        revision: this.productsRevision(),
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

  public products = computed(() => this.reading()?.products ?? []);

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

  private picked = signal(rememberedView().systemEntry ?? null);

  private cameras = signal(rememberedView().movedCameras ?? {});

  protected transferring = signal(false);

  protected transferError = signal('');

  protected inventoryShown = signal(rememberedView().inventoryShown ?? false);

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  public productNames = computed(() => this.products().map((listed) => listed.name));

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

    return { port, product, flow, revision: this.flowRevisionOf(product.name, flow) };
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

  protected openPointGroups = toSignal(
    toObservable(
      computed(() => {
        const port = this.port();
        const product = this.product()?.name;
        const part = this.part()?.key;

        return port && product && part ? { address: { port, product }, part, revision: this.allRevision() } : null;
      }),
    ).pipe(
      switchMap((asked) =>
        asked
          ? partOpenPoints$(asked.address, asked.part).pipe(
              map(openPointGroupsOf),
              catchError(() => of([])),
            )
          : of([]),
      ),
    ),
    { initialValue: [] },
  );

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

  public placeableFrames = computed(() => placeableFramesOf(this.frames()));

  public shownPart = computed(() => this.sketch()?.target ?? this.part()?.key ?? null);

  public panel = signal<'open' | 'hidden'>('open');

  protected pageShell = computed<PageShell>(() => ({
    tree: this.partTreeLayers(),
    product: this.product()?.name ?? '',
    products: this.productNames(),
    project: this.project(),
    projects: this.projects(),
    panel: this.panel(),
  }));

  private railSection = signal<Exclude<ShellSection, 'Inbox'>>(
    rememberedView().systemEntry?.startsWith(flowKeyOf('')) ? 'Flows' : 'System',
  );

  protected section = computed<ShellSection>(() => (this.commentStore.panelOpen() ? 'Inbox' : this.railSection()));

  protected sketchPage = computed(() => {
    const read = this.reading();

    if (!read || read.error || read.products.length === 0) return null;
    if (this.section() === 'Inbox' || this.call()) return null;

    return this.sketchShown();
  });

  protected startPage = computed(() => {
    const read = this.reading();

    if (!this.port() || !read || read.error || read.products.length > 0) return null;

    return { repo: this.project() };
  });

  protected flowsPage = computed(() => {
    const port = this.port();
    const product = this.product();
    const read = this.reading();

    if (!port || !product || !read || read.error || read.products.length === 0) return null;
    if (this.section() !== 'Flows' || this.call()) return null;

    const flows = this.flowList() ?? [];
    const flow = this.flow() ?? flows[0] ?? null;

    return { port, product, flows, flow, revision: flow ? this.flowRevisionOf(product.name, flow) : 0 };
  });

  protected inventoryPage = computed(() => {
    const port = this.port();
    const part = this.part();
    const read = this.reading();

    if (!port || !part || !read || read.error || read.products.length === 0) return null;
    if (this.section() !== 'System' || this.call() || this.awaitingPicked()) return null;
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
  }

  /** Shows the part or sketch a comment sits on, moves the camera to its pin and opens it. */
  public jumpTo(comment: NumberedComment) {
    const sketchKey = sketchKeyOf(comment.part);
    const key = comment.sketch && this.nodes().entries.has(sketchKey) ? sketchKey : comment.part;

    if (key === this.selectedKey()) this.focusComment(comment);
    else {
      this.activate(key);
      afterNextRender(() => this.focusComment(comment), { injector: this.injector });
    }
  }

  public pickSection(section: ShellSection) {
    this.panel.set('open');
    this.commentStore.showPanel(section === 'Inbox');

    if (section !== 'Inbox') this.railSection.set(section);
    if (section === 'System' && this.flow()) this.activate(this.part()?.key ?? '');
    if (section === 'Sketches' && !this.sketch()) this.openFirstSketch();
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

    this.picked.set(key);
    if (key.startsWith(flowKeyOf(''))) this.railSection.set('Flows');
    rememberView({ systemEntry: key });
  }

  public pickProduct(systemProduct: string) {
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

  protected copyText(text: string) {
    from(navigator.clipboard.writeText(text))
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected selectMerged(target: string) {
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

  private openFirstSketch() {
    const first = this.sketches()[0];

    if (first) this.activate(sketchKeyOf(first.target));
  }

  private flowRevisionOf(product: string, flow: ListedFlow) {
    return Math.max(
      0,
      ...flow.frames.map((frame) =>
        revisionOf(this.frameRevisions(), { product, part: frame.part, sketch: null, errored: false }),
      ),
    );
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

    if (frame) canvas.focusFrame(frame);
  }
}
