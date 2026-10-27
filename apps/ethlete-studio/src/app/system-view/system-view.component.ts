import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TREE_IMPORTS, TreeDataSource, TreeNode } from '@ethlete/components';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { catchError, finalize, from, map, of, switchMap, tap } from 'rxjs';
import { ListedCall, ListedProduct, Themes, listedCalls$, listedSystem$, transferCall$ } from '../../host/design';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import {
  ThemePick,
  camerasWith,
  rememberTheme,
  rememberView,
  rememberedView,
  themeKey,
  themeName,
} from '../call-view/remembered';
import { Camera } from '../components/design-canvas/canvas-math';
import {
  OpenContext,
  TreeEntry,
  TreeGroup,
  TreeSection,
  callFramesOf,
  callKeyOf,
  framesOf,
  holdersOf,
  isGroupOpen,
  isSectionOpen,
  partKeyOf,
  treeOf,
} from './system-tree';

type Reading = { products: ListedProduct[]; error: string | null };

@Component({
  selector: 'ethlete-system-view',
  template: `
    <aside class="studio__system-tree" etProvideSurface="dark-elevated">
      @if (products().length > 1) {
        <select
          [value]="product()?.name ?? ''"
          (change)="pickProduct($event)"
          class="studio__system-product"
          title="The product the system shows"
        >
          @for (listed of products(); track listed.name) {
            <option [value]="listed.name">{{ listed.name }}</option>
          }
        </select>
      } @else if (product(); as only) {
        <h1 class="studio__system-title">{{ only.name }}</h1>
      }

      <et-tree
        [dataSource]="dataSource()"
        [expandedValues]="expandedValues()"
        (expandedValuesChange)="rememberOpen($event)"
        (nodeActivate)="activate($event.value)"
        class="studio__system-nav"
        selectionMode="none"
        aria-label="Design system"
      >
        <ng-template etTreeNodeDef let-node>
          @let entry = entryOf(node.value);
          @if (entry) {
            <span [class.studio__system-entry--active]="entry.key === selectedKey()" [title]="entry.title ?? ''">
              {{ node.label }}
            </span>
            @for (badge of entry.badges; track badge) {
              @if (badge === 'error') {
                <span class="studio__system-badge studio__system-badge--error" etProvideColor="danger">error</span>
              } @else {
                <span class="studio__system-badge">{{ badge }}</span>
              }
            }
          } @else {
            {{ node.label }}
            @if (countOf(node.value); as count) {
              <span class="studio__system-count">{{ count }}</span>
            }
          }
        </ng-template>
      </et-tree>
    </aside>

    <ng-template #themeBar>
      @for (themeSwitch of themeSwitches(); track themeSwitch.kind) {
        <div [attr.aria-label]="themeSwitch.label" class="studio__system-switch" role="group">
          @for (name of themeSwitch.names; track name) {
            <button
              [attr.aria-pressed]="name === themeSwitch.current"
              (click)="pickTheme(themeSwitch.kind, name)"
              type="button"
            >
              {{ name }}
            </button>
          }
        </div>
      }
    </ng-template>

    <main class="studio__system-main">
      @if (!port()) {
        <p class="studio__system-note">Start the design server to see the design system.</p>
      } @else if (call(); as shown) {
        <div class="studio__system-call">
          <header class="studio__system-call-head">
            <div class="studio__system-call-title">
              <span class="studio__system-call-eyebrow">{{ shown.slug }}</span>
              @if ('headline' in shown) {
                <h2>{{ shown.headline }}</h2>
              }
            </div>
            <ng-container [ngTemplateOutlet]="themeBar" />
            @if ('transferred' in shown && shown.transferred) {
              <span class="studio__system-badge">transferred</span>
            } @else if (!('error' in shown)) {
              <button
                [disabled]="transferring()"
                (click)="markTransferred(shown.slug)"
                class="studio__system-button"
                type="button"
              >
                Mark transferred
              </button>
            }
            @if (transferError(); as message) {
              <span class="studio__system-call-error" etProvideColor="danger">{{ message }}</span>
            }
          </header>
          <ethlete-design-canvas
            [frames]="callFrames()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            (cameraChange)="rememberCamera($event)"
            class="studio__system-canvas"
          />
        </div>
      } @else if (reading(); as read) {
        @if (read.error) {
          <p class="studio__system-note">{{ read.error }}</p>
        } @else if (read.products.length === 0) {
          <div class="studio__system-empty">
            <h2>No product yet</h2>
            <p>Run this in the checkout to create one:</p>
            <div class="studio__system-command">
              <pre>{{ NEW_PRODUCT_COMMAND }}</pre>
              <button (click)="copyCommand()" class="studio__system-button" type="button">
                {{ copied() ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p>Its parts live in <code>.ethlete/design/&lt;product&gt;/&lt;layer&gt;/&lt;name&gt;</code>.</p>
          </div>
        } @else if (part()) {
          @if (themeSwitches().length > 0) {
            <div class="studio__system-themes">
              <ng-container [ngTemplateOutlet]="themeBar" />
            </div>
          }
          <ethlete-design-canvas
            [frames]="frames()"
            [cameraKey]="cameraKey()"
            [restoredCamera]="restoredCamera()"
            (cameraChange)="rememberCamera($event)"
            class="studio__system-canvas"
          />
        } @else {
          <p class="studio__system-note">This product has no parts yet.</p>
        }
      }
    </main>
  `,
  styleUrl: './system-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, TREE_IMPORTS, DesignCanvasComponent, ProvideColorDirective, ProvideSurfaceDirective],
  host: { class: 'studio__system' },
})
export class SystemViewComponent {
  private destroyRef = inject(DestroyRef);
  public port = input<number | null>(null);
  public epoch = input(0);
  public checkout = input('');
  public projectThemes = input<Record<string, Themes>>({});

  public tick = input(0);

  protected readonly NEW_PRODUCT_COMMAND = 'npx et design product new web';

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

  public calls = toSignal(
    toObservable(
      computed(() => ({ port: this.port(), epoch: this.epoch(), tick: this.tick(), reloads: this.callReloads() })),
    ).pipe(switchMap(({ port }) => (port ? listedCalls$(port).pipe(catchError(() => of<ListedCall[]>([]))) : of([])))),
    { initialValue: [] },
  );

  private pickedProduct = signal(rememberedView().systemProduct ?? null);

  private picked = signal(rememberedView().systemEntry ?? null);

  private cameras = signal(rememberedView().cameras ?? {});

  protected transferring = signal(false);

  protected transferError = signal('');

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  private tree = computed(() => treeOf(this.product()?.parts ?? [], this.calls()));

  protected call = computed(() => this.calls().find((listed) => callKeyOf(listed.slug) === this.picked()) ?? null);

  protected part = computed(() => {
    const parts = this.product()?.parts ?? [];
    const first = treeOf(parts)[0]?.entries[0]?.key;
    const listed =
      parts.find((candidate) => partKeyOf(candidate) === this.picked()) ??
      parts.find((candidate) => partKeyOf(candidate) === first);

    return listed ? { key: partKeyOf(listed), listed } : null;
  });

  protected selectedKey = computed(() => {
    const call = this.call();

    return call ? callKeyOf(call.slug) : (this.part()?.key ?? null);
  });

  protected cameraKey = computed(() => {
    const call = this.call();
    const part = this.part();

    if (call) return callKeyOf(call.slug);

    return part ? `${this.product()?.name} ${part.key}` : null;
  });

  protected restoredCamera = computed(() => {
    const key = this.cameraKey();

    return key ? (this.cameras()[key] ?? null) : null;
  });

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

  private surface = computed(() => this.shownThemes()?.surface.current);

  private color = computed(() => this.shownThemes()?.color.current);

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

    this.picked.set(key);
    rememberView({ systemEntry: key });
  }

  protected pickProduct(event: Event) {
    const systemProduct = (event.target as HTMLSelectElement).value;

    this.pickedProduct.set(systemProduct);
    rememberView({ systemProduct });
  }

  protected pickTheme(kind: keyof ThemePick, name: string) {
    const key = this.shownThemes()?.key;

    if (!key) return;

    this.themePicks.update((picks) => ({ ...picks, [key]: { ...picks[key], [kind]: name } }));
    rememberTheme(key, { [kind]: name });
  }

  protected rememberCamera(camera: Camera) {
    const key = this.cameraKey();

    if (!key) return;

    const existing = new Set([
      ...this.calls().map((listed) => callKeyOf(listed.slug)),
      ...this.products().flatMap((listed) => listed.parts.map((part) => `${listed.name} ${partKeyOf(part)}`)),
    ]);
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
}
