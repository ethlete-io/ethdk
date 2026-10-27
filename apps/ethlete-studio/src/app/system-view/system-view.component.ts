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
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
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
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { FramePoint } from '../components/design-canvas/canvas-pin';
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
  TreeGroup,
  TreeSection,
  arrangementOf,
  authorsLabelOf,
  callFramesOf,
  callKeyOf,
  framesOf,
  partColumnsOf,
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
import { SketchViewComponent } from './sketch-view.component';

type Reading = { products: ListedProduct[]; error: string | null };

const BADGE =
  'shrink-0 whitespace-nowrap rounded-full border border-[var(--et-surface-border-solid)] px-1.5 py-px text-[1rem] text-[var(--et-surface-color-subtle-solid)]';

const BADGE_ACCENT =
  'shrink-0 whitespace-nowrap rounded-full border border-[var(--et-theme-color-primary-solid)] px-1.5 py-px text-[1rem] text-[var(--et-theme-color-primary-solid)]';

/** Never a product name: a product is a directory, and a directory name holds no slash. */
const NEW_PRODUCT = '/new';

const NOTE = 'm-0 max-w-130 self-center justify-self-center p-6 text-small text-[var(--et-surface-color-subtle-solid)]';

@Component({
  selector: 'ethlete-system-view',
  template: `
    <ng-template #pinThread let-pin>
      <ethlete-comment-thread [commentId]="pin.id" />
    </ng-template>

    <aside
      class="flex min-h-0 flex-col overflow-y-auto border-r border-[var(--et-surface-border-solid)] bg-[var(--et-surface-background-solid)] pb-4 text-[var(--et-surface-color-solid)]"
      etProvideSurface="dark-elevated"
    >
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
                    >inherits from {{ listed.base }}</span
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
                [style.color]="entry.key === selectedKey() ? 'var(--et-theme-color-primary-solid)' : null"
                [title]="entry.title ?? ''"
                class="min-w-0 truncate"
              >
                {{ node.label }}
              </span>
              @for (badge of entry.badges; track badge) {
                @if (badge === 'error') {
                  <span [class]="BADGE_ACCENT" etProvideColor="danger">error</span>
                } @else if (badge === 'question') {
                  <span [class]="BADGE_ACCENT" data-tree-question>question</span>
                } @else {
                  <span [class]="BADGE">{{ badge }}</span>
                }
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
          class="flex gap-0.5 rounded-[0.6rem] border border-[var(--et-surface-border-solid)] bg-[var(--et-surface-background-solid)] p-0.5"
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

    <ng-template #commentModeButton>
      <button
        [pressed]="commentStore.active()"
        (click)="commentStore.toggle()"
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
        <h2 class="mb-2 text-h4 text-[var(--et-surface-color-solid)]">{{ heading }}</h2>
        <p>Run this in the checkout to create one:</p>
        <div class="my-3 flex items-center gap-2">
          <pre
            class="m-0 flex-1 rounded-md border border-[var(--et-surface-border-solid)] p-3 font-mono text-[var(--et-surface-color-solid)]"
            >{{ NEW_PRODUCT_COMMAND }}</pre>
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
          <header class="flex items-center gap-3 border-b border-[var(--et-surface-border-solid)] px-4 py-3">
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
              <span class="text-[1.2rem] text-[var(--et-theme-color-primary-solid)]" etProvideColor="danger">{{
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
            [revision]="tick()"
            [surface]="surface()"
            [color]="color()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            (cameraChange)="rememberCamera($event)"
            (decide)="reloadSketches()"
          >
            <ng-container [ngTemplateOutlet]="themeBar" />
            <ng-container [ngTemplateOutlet]="commentModeButton" />
          </ethlete-sketch-view>
        } @else if (awaitingPicked()) {
        } @else if (part(); as partShown) {
          <div class="absolute top-3 right-4 z-1 flex gap-2">
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
            <ng-container [ngTemplateOutlet]="commentModeButton" />
          </div>
          <ethlete-design-canvas
            #partCanvas
            [frames]="notedFrames()"
            [arrangement]="arrangement()"
            [columns]="partColumns()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            [pins]="partPins()"
            [pointing]="commentStore.active()"
            [draft]="commentStore.draft()"
            [pinPopover]="pinThread"
            (cameraChange)="rememberCamera($event)"
            (pointPick)="startComment(frames(), $event)"
            class="min-h-0"
          >
            @if (commentStore.draft()) {
              <ethlete-comment-draft canvasDraft />
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
        [selected]="shownPart()"
        (jump)="jumpTo($event)"
        (dismiss)="commentStore.showPanel(false)"
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
    CommentDraftComponent,
    CommentThreadComponent,
    CommentPanelComponent,
  ],
  providers: [provideCommentStore()],
  host: {
    class: 'grid min-h-0 grid-cols-[28rem_minmax(0,1fr)_auto]',
    '(window:keydown)': 'handleCommentKey($event)',
  },
})
export class SystemViewComponent {
  private destroyRef = inject(DestroyRef);
  protected commentStore = injectCommentStore();
  private injector = inject(Injector);
  public port = input<number | null>(null);
  public epoch = input(0);
  public checkout = input('');

  public projectThemes = input<Record<string, Themes>>({});

  public tick = input(0);
  private partCanvas = viewChild<DesignCanvasComponent>('partCanvas');
  private sketchView = viewChild<SketchViewComponent>('sketchView');
  protected readonly BADGE = BADGE;

  protected readonly BADGE_ACCENT = BADGE_ACCENT;

  protected readonly NOTE = NOTE;

  protected readonly AUTHORS_LABEL_OF = authorsLabelOf;

  protected readonly NEW_PRODUCT_COMMAND = 'npx et design product new web';

  protected readonly NEW_PRODUCT = NEW_PRODUCT;

  protected copied = signal(false);

  protected reading = toSignal(
    toObservable(computed(() => ({ port: this.port(), epoch: this.epoch(), tick: this.tick() }))).pipe(
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

  private cameras = signal(rememberedView().cameras ?? {});

  protected transferring = signal(false);

  protected transferError = signal('');

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  protected pickerValue = computed(() => (this.creating() ? NEW_PRODUCT : (this.product()?.name ?? NEW_PRODUCT)));

  private sketchList = toSignal(
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
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  public sketches = computed(() => this.sketchList() ?? []);

  private listsRead = computed(() => this.callList() !== null && this.sketchList() !== null);

  private tree = computed(() =>
    treeOf(this.product()?.parts ?? [], {
      calls: this.calls(),
      sketches: this.sketches(),
      comments: this.commentStore.comments(),
    }),
  );

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
    const leaf = (entry: TreeEntry): TreeNode<string> => {
      entries.set(entry.key, entry);

      return { value: entry.key, label: entry.name, isLeaf: true };
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

    return { entries, counts, children };
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

    if (call) return callKeyOf(call.slug);

    return sketch ? sketchKeyOf(sketch.target) : (this.part()?.key ?? null);
  });

  protected cameraKey = computed(() => {
    const call = this.call();
    const part = this.part();

    const sketch = this.sketch();

    if (call) return callKeyOf(call.slug);
    if (sketch) return `${this.product()?.name} ${sketchKeyOf(sketch.target)}`;

    return part ? `${this.product()?.name} ${part.key}` : null;
  });

  protected restoredCamera = computed(() => {
    const key = this.cameraKey();

    return key ? (this.cameras()[key] ?? null) : null;
  });

  protected arrangement = computed(() => {
    const part = this.part();

    return part ? arrangementOf(part.listed) : 'sheet';
  });

  protected partColumns = computed(() => {
    const part = this.part();

    return part ? partColumnsOf(part.listed) : [];
  });

  protected frames = computed(() => {
    const port = this.port();
    const product = this.product();
    const part = this.part();

    if (!port || !product || !part) return [];

    return framesOf({
      port,
      product,
      part: part.listed,
      epoch: this.epoch(),
      revision: this.tick(),
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

    return this.tree().flatMap((group) => [
      ...open(group, isGroupOpen(group, context)),
      ...(group.sections ?? []).flatMap((section) => open(section, isSectionOpen(section, context))),
    ]);
  });

  protected partPins = computed(() => pinsOf(this.frames(), this.commentStore.comments()));
  protected notedFrames = computed(() =>
    withOtherSizeNotes(this.frames(), { comments: this.commentStore.comments(), everyInteraction: true }),
  );
  protected shownPart = computed(() => this.sketch()?.target ?? this.part()?.key ?? null);

  protected commentable = computed(
    () => !this.creating() && !this.call() && (this.sketchShown() !== null || this.part() !== null),
  );

  constructor() {
    this.commentStore.connect(
      computed(() => {
        const port = this.port();
        const product = this.product()?.name;

        return { address: port && product ? { port, product } : null, revision: this.tick() };
      }),
    );
  }

  protected startComment(frames: CanvasFrame[], pick: FramePoint) {
    const draft = commentDraftOf(frames, pick);

    if (draft) this.commentStore.start(draft);
  }

  protected handleCommentKey(event: KeyboardEvent) {
    if (!this.commentable()) return;
    if (event.key === 'Escape' && this.commentStore.draft()) this.commentStore.cancel();
    else if (event.key === 'Escape' && this.commentStore.active()) this.commentStore.end();
    else if (isCommentModeKey(event) && !event.repeat) this.commentStore.toggle();
  }

  /** Shows the part or sketch a comment sits on, then moves the camera to its pin and opens it. */
  protected jumpTo(comment: NumberedComment) {
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
    rememberView({ cameras });
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

  private focusComment(comment: NumberedComment) {
    const sketchView = this.sketchView();
    const canvas = this.partCanvas();

    if (sketchView) return sketchView.jumpTo(comment);
    if (!canvas) return;

    const frame = otherSizeFrameOf(this.frames(), comment);

    if (this.partPins().some((pin) => pin.id === comment.id)) canvas.openPin(comment.id);
    else if (frame) canvas.focusFrame(frame);
  }
}
