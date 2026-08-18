import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewEncapsulation, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AutoSurfaceDirective, ProvideColorDirective } from '@ethlete/core';
import { EYEDROPPER_ICON, IconDirective, provideIcons } from '../../icon/headless';
import { tap } from 'rxjs';
import { injectOverlaySurfaceContext } from '../form-field/headless';
import { injectColorInputLabels } from './color-input-labels';
import { COLOR_INPUT_TOKEN, ColorPickerAreaDirective, ColorPickerChannelDirective } from './headless';
import { formatHsvToHex } from './headless/internals/color-convert';
import { eyeDropperColor, isEyeDropperSupported } from './headless/internals/eye-dropper';

@Component({
  selector: 'et-color-picker-panel',
  templateUrl: './color-picker-panel.component.html',
  styleUrl: './color-picker-panel.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ColorPickerAreaDirective, ColorPickerChannelDirective, IconDirective],
  providers: [provideIcons(EYEDROPPER_ICON)],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  // the trigger promises `aria-haspopup="dialog"`, so the mounted pane has to be a named dialog -
  // without this, screen reader users land in an unnamed generic container
  host: {
    class: 'et-color-picker-panel',
    role: 'dialog',
    '[attr.aria-label]': 'labels().dialog',
  },
})
export class ColorPickerPanelComponent {
  protected colorInput = inject(COLOR_INPUT_TOKEN);
  protected labels = injectColorInputLabels();

  private destroyRef = inject(DestroyRef);
  private documentRef = inject(DOCUMENT);

  // observed instead of the host: the host's used size is overridden by the resize animation
  // itself, so observing it directly would feed the animation back into the observer
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  protected showEyeDropper = isEyeDropperSupported(this.documentRef);

  /** The picked color in the notation the control emits - what the field shows and the swatch paints. */
  protected canonicalHex = computed(() =>
    formatHsvToHex(this.colorInput.picker.hsv(), { alpha: this.colorInput.alpha() }),
  );

  /** The picked color at full opacity - the area thumb and the alpha gradient both need it. */
  protected opaqueHex = computed(() => formatHsvToHex({ ...this.colorInput.picker.hsv(), alpha: 1 }));

  protected huePercent = computed(() => (this.colorInput.picker.hsv().hue / 360) * 100);

  protected alphaPercent = computed(() => this.colorInput.picker.hsv().alpha * 100);

  constructor() {
    // this panel IS the overlay's own surface - paint the overlay's registered elevation exactly,
    // don't stack a level above it (the tracker is authoritative; content inside elevates off it)
    inject(AutoSurfaceDirective).matchOverlaySurface();

    injectOverlaySurfaceContext({ panelBody: this.panelBody, resizingClass: 'et-color-picker-panel--resizing' });
  }

  protected commitHex(event: Event) {
    const field = event.target as HTMLInputElement;

    if (!this.colorInput.picker.commitColor(field.value)) {
      // An unreadable entry is reverted rather than left standing: the bound value only rewrites the
      // field when the color actually changed, and a field disagreeing with the swatch above it
      // reads as a broken control.
      field.value = this.canonicalHex();
    }
  }

  protected handleHexKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') {
      return;
    }

    // the picker commits live, so Enter has nothing left to submit - and letting it through would
    // submit the form the field sits in
    event.preventDefault();
    this.commitHex(event);
  }

  protected openEyeDropper() {
    eyeDropperColor(this.documentRef)
      .pipe(
        tap((color) => this.colorInput.picker.commitColor(color)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
