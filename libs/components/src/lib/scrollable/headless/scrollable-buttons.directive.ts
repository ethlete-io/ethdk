import { Directive, computed, effect, inject, input } from '@angular/core';
import { BREAKPOINT_ORDER, Breakpoint, ProvideColorDirective, injectCurrentBreakpoint } from '@ethlete/core';
import { BUTTON_SIZES, BUTTON_VARIANTS, ButtonSize, ButtonVariant } from '../../button/button.types';
import { ScrollableButtonsComponent } from './scrollable-buttons.component';
import { ScrollableResponsive, injectScrollableConfig } from './scrollable-config';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableButtonPosition } from './scrollable.types';

/** Options for `etScrollableButtons`. */
export type ScrollableButtonsConfig = {
  /**
   * `'inside'` floats the two buttons over the track's edges; `'inline'` puts them beside the track at
   * the row's ends; `'footer'` puts them in a row below it, next to the dots when `etScrollableNavigation`
   * is on too. A value per breakpoint is allowed. Falls back to `provideScrollableConfig`. @default 'inside'
   */
  position?: ScrollableResponsive<ScrollableButtonPosition>;
  /**
   * Keep the buttons in view while the page scrolls past a tall track, rather than letting them travel
   * off with it. Only meaningful with `position: 'inside'`. @default false
   */
  sticky?: boolean;
  /** Size of the two icon buttons. @default 'xs' */
  size?: ButtonSize;
  /** Button variant. `'filled'` gives the buttons a `color` fill. Falls back to `provideScrollableConfig`. @default 'transparent' */
  variant?: ButtonVariant;
  /**
   * Turn the buttons on or off, optionally per breakpoint. Falls back to `provideScrollableConfig`, and
   * to `true` when the directive is applied explicitly. @default true
   */
  enabled?: ScrollableResponsive<boolean>;
};

/**
 * Adds the previous/next scroll buttons to an `<et-scrollable>`. Applied on the `<et-scrollable>` itself,
 * or - with `provideScrollableConfig({ buttons: { enabled: true } })` - on every scrollable that imports
 * `SCROLLABLE_NAVIGATION_IMPORTS`. Ships in `SCROLLABLE_NAVIGATION_IMPORTS`.
 *
 * The buttons are decorative - `aria-hidden`, not tabbable - because a scroll container is already
 * keyboard-operable. Controls that must be reachable belong to the consumer.
 */
@Directive({
  selector: 'et-scrollable, [etScrollable]',
  host: {
    '[class.et-scrollable--sticky-buttons]': 'enabled() && sticky() && position() === "inside"',
    '[class.et-scrollable--inline-buttons]': 'enabled() && position() === "inline"',
  },
})
export class ScrollableButtonsDirective {
  private scrollable = inject(ScrollableDirective);

  private defaults = injectScrollableConfig();
  private currentBreakpoint = injectCurrentBreakpoint();
  private colorProvider = inject(ProvideColorDirective, { optional: true, self: true });

  public config = input<ScrollableButtonsConfig | '' | null>(null, { alias: 'etScrollableButtons' });

  private resolved = computed(() => {
    const config = this.config();

    return config === '' || config === null ? {} : config;
  });

  public position = computed(
    () => this.resolve(this.resolved().position) ?? this.resolve(this.defaults.buttons?.position) ?? 'inside',
  );
  public sticky = computed(() => this.resolved().sticky ?? this.defaults.buttons?.sticky ?? false);
  public size = computed(() => this.resolved().size ?? this.defaults.buttons?.size ?? BUTTON_SIZES.XS);
  public variant = computed(
    () => this.resolved().variant ?? this.defaults.buttons?.variant ?? BUTTON_VARIANTS.TRANSPARENT,
  );
  public color = computed(() => (this.colorProvider?.effectiveColor() ? undefined : this.defaults.buttons?.color));
  public enabled = computed(() => {
    const own = this.resolve(this.resolved().enabled);

    if (own !== undefined) return own;

    const provided = this.defaults.buttons?.enabled;

    if (provided !== undefined) return this.resolve(provided) ?? false;

    return this.config() !== null;
  });

  constructor() {
    effect(() => {
      if (this.enabled()) {
        this.scrollable.activateChildIntersections();
      }
    });
    this.scrollable.registerChrome({
      key: 'buttons',
      slot: computed(() => (this.position() === 'footer' ? 'footer' : 'overlay')),
      component: ScrollableButtonsComponent,
      inputs: computed(() => ({
        position: this.position(),
        size: this.size(),
        variant: this.variant(),
        color: this.color(),
      })),
      enabled: this.enabled,
      order: 0,
    });
  }

  private resolve<T>(value: ScrollableResponsive<T> | undefined): T | undefined {
    if (value === undefined || typeof value !== 'object' || value === null) return value as T | undefined;

    const map = value as Partial<Record<Breakpoint, T>>;
    const current = BREAKPOINT_ORDER.indexOf(this.currentBreakpoint());

    for (let i = current; i >= 0; i--) {
      const match = map[BREAKPOINT_ORDER[i] as Breakpoint];

      if (match !== undefined) return match;
    }

    return undefined;
  }
}
