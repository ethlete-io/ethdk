import { Directive, ElementRef, booleanAttribute, computed, inject, input } from '@angular/core';
import { SurfaceInteractiveDirective } from '@ethlete/core';

export const BUTTON_TYPES = {
  BUTTON: 'button',
  SUBMIT: 'submit',
  RESET: 'reset',
} as const;

type ButtonType = (typeof BUTTON_TYPES)[keyof typeof BUTTON_TYPES];

export const BUTTON_TONES = {
  THEME: 'theme',
  SURFACE: 'surface',
} as const;

export type ButtonTone = (typeof BUTTON_TONES)[keyof typeof BUTTON_TONES];

@Directive({
  selector: '[etButton]',
  exportAs: 'etButton',
  hostDirectives: [SurfaceInteractiveDirective],
  host: {
    '[attr.data-loading]': 'loading() ? true : null',
    '[attr.data-pressed]': 'pressed() ? true : null',
    '[attr.data-tone]': 'tone()',
    '[attr.data-muted-until-pressed]': 'mutedUntilPressed() ? true : null',
    '[attr.disabled]': 'IS_BUTTON && isInactive() ? "" : null',
    '[attr.aria-busy]': 'loading() ? true : null',
    '[attr.aria-disabled]': 'isInactive() ? true : null',
    '[attr.aria-pressed]': 'emitAriaPressed() && pressed() ? true : null',
    '[attr.type]': 'IS_BUTTON ? type() : null',
    '[attr.tabindex]': 'IS_ANCHOR && isInactive() ? -1 : null',
  },
})
export class ButtonDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public disabled = input(false, { transform: booleanAttribute });
  public loading = input(false, { transform: booleanAttribute });
  public type = input<ButtonType>('button');
  public pressed = input(false, { transform: booleanAttribute });
  public emitAriaPressed = input(true, { transform: booleanAttribute });

  /**
   * Where the button takes its color from: the ambient color theme (default), or the surface it sits
   * on. `surface` keeps every variant's structural signature - a filled button keeps a solid-ish
   * fill, an outline one keeps its border - and only swaps the tint source, so a secondary or
   * cancel action reads as chrome without needing a neutral color theme registered.
   *
   * A pressed toggle stays surface-toned too; its pressed state comes from the variant swap. Set
   * `mutedUntilPressed` instead when the pressed state should pick the color theme up.
   */
  public tone = input<ButtonTone>(BUTTON_TONES.THEME);

  // Opt-in: keep the button visually neutral (surface-themed) until it's pressed, only picking
  // up the provided color theme once active - for toggle-style buttons (e.g. a formatting
  // toolbar) where every button always being tinted by the ambient color theme reads as noise.
  public mutedUntilPressed = input(false, { transform: booleanAttribute });

  public readonly IS_BUTTON = this.elementRef.nativeElement.tagName === 'BUTTON';
  public readonly IS_ANCHOR = this.elementRef.nativeElement.tagName === 'A';

  public isInactive = computed(() => this.disabled() || this.loading());
}
