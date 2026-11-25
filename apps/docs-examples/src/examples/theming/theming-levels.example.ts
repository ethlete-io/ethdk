import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  AutoSurfaceDirective,
  injectParentSurface,
  injectSurfaceThemes,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  resolveSurfaceByElevation,
  SurfaceType,
} from '@ethlete/core';
import {
  ACCORDION_IMPORTS,
  anchoredOverlayStrategy,
  BUTTON_IMPORTS,
  createOverlayOpener,
  defineOverlay,
  MENU_IMPORTS,
  OverlayMainDirective,
  TAB_IMPORTS,
  TABLE_IMPORTS,
  TableColumns,
} from '@ethlete/components';
import { ROWS, SCHEMES, SURFACE_VALUES, ThemingLevelRow, TONES } from './theming-levels.data';

@Component({
  selector: 'app-theming-level',
  template: `
    <header class="app-theming-level-header">
      <strong>{{ label() }}</strong>
      <code>{{ surface()?.name ?? 'inherited' }}</code>
    </header>

    <dl class="app-theming-level-values">
      @for (value of values(); track value.label) {
        <div>
          <dt>{{ value.label }}</dt>
          <dd>{{ value.value }}</dd>
        </div>
      }
    </dl>

    <div class="app-theming-level-buttons">
      <button et-button size="sm" type="button">Filled</button>
      <button et-button size="sm" variant="outline" type="button">Outline</button>
      <button et-button size="sm" variant="transparent" type="button">Transparent</button>

      <div etMenu>
        <button etMenuTrigger et-button size="sm" variant="tonal" type="button">Menu</button>

        <ng-template etMenuSurface>
          <et-menu>
            <button et-menu-item type="button">First item</button>
            <button et-menu-item type="button">Second item</button>
          </et-menu>
        </ng-template>
      </div>
    </div>

    <et-accordion-group>
      <et-accordion label="Accordion header">Accordion content</et-accordion>
    </et-accordion-group>

    <et-table [data]="ROWS" [columns]="COLUMNS" [rowKey]="rowKey" rowInteractive />

    <et-tab-group>
      <et-tab label="Active tab">Tab content</et-tab>
      <et-tab label="Other tab">Other content</et-tab>
    </et-tab-group>

    <ng-content />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, BUTTON_IMPORTS, MENU_IMPORTS, TAB_IMPORTS, TABLE_IMPORTS],
})
export class ThemingLevelComponent {
  protected surface = injectParentSurface();

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  public label = input.required<string>();

  protected readonly ROWS = ROWS;
  protected readonly COLUMNS = {
    name: { header: 'State', value: (row) => row.name },
    value: { header: 'Look', value: (row) => row.value },
  } satisfies TableColumns<ThemingLevelRow>;

  protected values = signal(
    SURFACE_VALUES.map(({ label }) => ({ label, value: '' })),
    {
      equal: (a, b) => a.every((value, index) => value.value === b[index]?.value),
    },
  );

  constructor() {
    afterRenderEffect(() => {
      this.surface();

      const style = getComputedStyle(this.host.nativeElement);

      this.values.set(
        SURFACE_VALUES.map(({ label, token }) => ({ label, value: style.getPropertyValue(token).trim() })),
      );
    });
  }

  protected rowKey(row: ThemingLevelRow) {
    return row.id;
  }
}

@Component({
  selector: 'app-theming-levels-overlay',
  template: `<app-theming-level class="app-theming-level" data-level="overlay" label="Overlay" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [ThemingLevelComponent],
  hostDirectives: [OverlayMainDirective],
})
export class ThemingLevelsOverlayComponent {}

const levelsOverlay = defineOverlay({
  component: ThemingLevelsOverlayComponent,
  strategies: anchoredOverlayStrategy({ maxWidth: '420px' }),
  mode: 'non-modal',
});

@Component({
  selector: 'app-theming-levels-overlay-button',
  template: `
    <button (click)="overlay.open({ origin: $event })" et-button size="sm" type="button">Open overlay</button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class ThemingLevelsOverlayButtonComponent {
  protected overlay = createOverlayOpener(levelsOverlay);
}

@Component({
  selector: 'app-theming-levels-example',
  template: `
    <div class="app-example-row">
      <button (click)="toggleScheme()" et-button size="sm" variant="outline" type="button" data-switch="scheme">
        Scheme: {{ scheme() }}
      </button>
      <button (click)="nextTone()" et-button size="sm" variant="outline" type="button" data-switch="tone">
        Tone: {{ tone() }}
      </button>
      <button
        [attr.aria-pressed]="hoverNextLevel()"
        (click)="hoverNextLevel.set(!hoverNextLevel())"
        et-button
        size="sm"
        variant="outline"
        type="button"
        data-switch="hover-next-level"
      >
        Hover = next level: {{ hoverNextLevel() ? 'on' : 'off' }}
      </button>
    </div>

    <div
      [etProvideSurface]="rootSurface()"
      [etProvideColor]="tone()"
      [style.color-scheme]="scheme()"
      [style.--et-accordion-header-hover-background]="nextLevelBackground()"
    >
      <app-theming-level class="app-theming-level" data-level="root" label="Root">
        <div etAutoSurface>
          <app-theming-level class="app-theming-level" data-level="surface" label="Surface">
            <div etAutoSurface>
              <app-theming-level class="app-theming-level" data-level="card" label="Card">
                <app-theming-levels-overlay-button />
              </app-theming-level>
            </div>
          </app-theming-level>
        </div>
      </app-theming-level>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    AutoSurfaceDirective,
    BUTTON_IMPORTS,
    ProvideColorDirective,
    ProvideSurfaceDirective,
    ThemingLevelComponent,
    ThemingLevelsOverlayButtonComponent,
  ],
  styles: `
    app-theming-level {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 12px;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }

    .app-theming-level-header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .app-theming-level-values {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 4px 12px;
      margin: 0;
      font-size: 1.2rem;

      dt {
        color: var(--et-surface-color-muted-solid);
      }

      dd {
        margin: 0;
        font-family: monospace;
      }
    }

    .app-theming-level-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class ThemingLevelsExampleComponent {
  private themes = injectSurfaceThemes();
  protected scheme = signal<SurfaceType>('dark');
  protected tone = signal(TONES[0]);
  protected hoverNextLevel = signal(false);

  protected rootSurface = computed(() => resolveSurfaceByElevation(this.themes, this.scheme(), 0)?.name ?? null);

  protected nextLevelBackground = computed(() => {
    const next = resolveSurfaceByElevation(this.themes, this.scheme(), 1);

    return this.hoverNextLevel() && next ? `rgb(${next.background})` : null;
  });

  protected toggleScheme() {
    this.scheme.set(SCHEMES.find((scheme) => scheme !== this.scheme()) ?? 'dark');
  }

  protected nextTone() {
    this.tone.set(TONES[(TONES.indexOf(this.tone() ?? '') + 1) % TONES.length]);
  }
}
