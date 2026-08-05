import {
  Component,
  Injector,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  runInInjectionContext,
} from '@angular/core';
import {
  ColorTheme,
  ProvideColorDirective,
  RegisteredColorThemeName,
  injectErrorTheme,
  injectSuccessTheme,
  injectWarningTheme,
} from '@ethlete/core';
import { IconButtonComponent } from '../button/icon-button.component';
import { ICON_IMPORTS, TIMES_ICON, provideIcons } from '../icon';
import { injectBannerLabels } from './banner-labels';

export const BANNER_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export type BannerType = (typeof BANNER_TYPES)[keyof typeof BANNER_TYPES];

const ALERT_BANNER_TYPES: ReadonlySet<BannerType> = /* @__PURE__ */ new Set([BANNER_TYPES.WARNING, BANNER_TYPES.ERROR]);

/**
 * A static, dismissible page or section message - icon/description/actions are yours to project,
 * unlike `et-notification`, which is a transient, manager-driven toast.
 *
 * @example
 * <et-banner type="error" heading="Something went wrong" description="Please try again." dismissible>
 *   <i etIcon="et-triangle-exclamation"></i>
 *   <button et-text-button etBannerAction type="button">Retry</button>
 * </et-banner>
 */
@Component({
  selector: 'et-banner',
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, ...ICON_IMPORTS],
  // viewProviders, not providers: this must only resolve the dismiss icon in the component's own
  // template, never for a consumer's projected `[etIcon]` - `provideIcons` is a single value provider,
  // so on `providers` it would shadow whatever icon set the consumer registered for their own content.
  viewProviders: [provideIcons(TIMES_ICON)],
  hostDirectives: [ProvideColorDirective],
  host: {
    class: 'et-banner',
    '[attr.role]': 'role()',
    '[attr.data-type]': 'type()',
  },
})
export class BannerComponent {
  private provideColor = inject(ProvideColorDirective);
  private injector = inject(Injector);

  protected resolvedLabels = injectBannerLabels();

  public heading = input<string>();
  public description = input<string>();
  public type = input<BannerType>(BANNER_TYPES.INFO);
  public dismissible = input(false, { transform: booleanAttribute });

  /**
   * Overrides the type's default color theme. `info` has no semantic theme of its own (there is no
   * app-registered `type: 'info'` slot), so pass a theme name to color an informational banner -
   * otherwise it renders untinted.
   */
  public color = input<RegisteredColorThemeName | ColorTheme | null>(null);

  public dismiss = output<void>();

  protected role = computed(() => (ALERT_BANNER_TYPES.has(this.type()) ? 'alert' : 'status'));

  constructor() {
    // Only the type actually in use is injected, and only once it's rendered: an app that only ever
    // shows `info`/`error` banners shouldn't have to register `warning`/`success` themes it never renders.
    effect(() => {
      const explicitColor = this.color();

      if (explicitColor) {
        this.provideColor.forceColor(explicitColor);

        return;
      }

      const type = this.type();

      if (type === BANNER_TYPES.INFO) {
        this.provideColor.clearForcedColor();

        return;
      }

      const theme = runInInjectionContext(this.injector, () => {
        if (type === BANNER_TYPES.SUCCESS) return injectSuccessTheme();
        if (type === BANNER_TYPES.WARNING) return injectWarningTheme();
        return injectErrorTheme();
      });

      this.provideColor.forceColor(theme);
    });
  }
}
