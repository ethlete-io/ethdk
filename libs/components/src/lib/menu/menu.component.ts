import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import {
  AutoSurfaceDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  createComponentId,
  injectErrorTheme,
  injectPrefersReducedMotion,
  injectRenderer,
  signalElementDimensions,
} from '@ethlete/core';
import { SpinnerComponent } from '../loader';
import { MenuDirective, MenuPanelDirective } from './headless';

const RESIZE_ANIMATION_CLASS = 'et-menu--resizing';

@Component({
  selector: 'et-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, SpinnerComponent],
  hostDirectives: [MenuPanelDirective, ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-menu',
  },
})
export class MenuComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  protected menu = inject(MenuDirective, { optional: true });
  protected errorColorTheme = injectErrorTheme();
  private prefersReducedMotion = injectPrefersReducedMotion();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();

  private headerElement = viewChild<ElementRef<HTMLElement>>('menuHeader');
  private bodyElement = viewChild<ElementRef<HTMLElement>>('menuBody');

  // observed instead of the host: the host's used size is overridden by the resize animation
  // itself, so observing it directly would feed the animation back into the observer
  private headerDimensions = signalElementDimensions(this.headerElement);
  private bodyDimensions = signalElementDimensions(this.bodyElement);

  protected search = computed(() => this.menu?.registeredSearch() ?? null);
  protected searchLoading = computed(() => this.search()?.loading() ?? false);
  protected searchError = computed(() => this.search()?.error() ?? null);
  protected searchErrorId = createComponentId('et-menu-search-error');

  private lastBlockSize: number | null = null;
  private resizeAnimation: Animation | null = null;

  constructor() {
    // the panel renders inside a detached overlay pane, so color context from the
    // trigger location has to be re-applied here instead of cascading via the DOM
    // (the surface context is handled the same way by AutoSurfaceDirective)
    effect(() => {
      const contextColorProvider = this.contextColorProvider;

      untracked(() => {
        if (contextColorProvider) {
          this.ownColorProvider.syncWithProvider(contextColorProvider);
        }
      });
    });

    // lets the search input reference the error line rendered below it via aria-describedby
    effect(() => {
      this.search()?.errorElementId.set(this.searchErrorId);
    });

    // animate the menu's block size when its content changes while open
    // (e.g. search filtering items away or the search error line appearing)
    effect(() => {
      this.headerDimensions();
      this.bodyDimensions();

      untracked(() => this.animateToCurrentBlockSize());
    });

    this.destroyRef.onDestroy(() => this.resizeAnimation?.cancel());
  }

  private animateToCurrentBlockSize() {
    const host = this.elementRef.nativeElement;

    // while an animation runs the rect reflects the animated size; without one the layout has
    // already jumped to the new size, so the previously stored value is the visual starting point
    const from =
      this.resizeAnimation?.playState === 'running' ? host.getBoundingClientRect().height : this.lastBlockSize;

    this.resizeAnimation?.cancel();
    this.resizeAnimation = null;

    const to = host.getBoundingClientRect().height;
    this.lastBlockSize = to;

    if (from === null || to === 0 || Math.abs(from - to) < 1 || this.prefersReducedMotion()) {
      return;
    }

    this.renderer.addClass(host, RESIZE_ANIMATION_CLASS);

    const animation = host.animate([{ blockSize: `${from}px` }, { blockSize: `${to}px` }], {
      duration: 160,
      easing: 'ease',
    });

    const cleanup = () => {
      this.renderer.removeClass(host, RESIZE_ANIMATION_CLASS);

      if (this.resizeAnimation === animation) {
        this.resizeAnimation = null;
      }
    };

    animation.finished.then(cleanup).catch(cleanup);
    this.resizeAnimation = animation;
  }
}
