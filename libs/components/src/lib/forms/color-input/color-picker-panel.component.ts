import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AutoSurfaceDirective, ProvideColorDirective } from '@ethlete/core';
import { EYEDROPPER_ICON, IconDirective, provideIcons } from '../../icon/headless';
import { tap } from 'rxjs';
import { FormFieldComponent } from '../form-field/form-field.component';
import { injectOverlaySurfaceContext } from '../form-field/headless';
import { InputPrefixDirective, InputSuffixDirective } from '../form-field/partials';
import { InputComponent } from '../input/input.component';
import { injectColorInputLabels } from './color-input-labels';
import { ColorNotation } from './color-input.types';
import { COLOR_INPUT_TOKEN, ColorPickerAreaDirective, ColorPickerChannelDirective } from './headless';
import { detectColorNotation, formatHsvToHex, formatHsvToNotation, HsvColor } from './headless/internals/color-convert';
import { eyeDropperColor, isEyeDropperSupported } from './headless/internals/eye-dropper';

@Component({
  selector: 'et-color-picker-panel',
  templateUrl: './color-picker-panel.component.html',
  styleUrl: './color-picker-panel.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ColorPickerAreaDirective,
    ColorPickerChannelDirective,
    FormFieldComponent,
    IconDirective,
    InputComponent,
    InputPrefixDirective,
    InputSuffixDirective,
  ],
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

  protected canonicalHex = computed(() =>
    formatHsvToHex(this.colorInput.picker.hsv(), { alpha: this.colorInput.alpha() }),
  );

  protected opaqueHex = computed(() => formatHsvToHex({ ...this.colorInput.picker.hsv(), alpha: 1 }));

  protected notation = linkedSignal<readonly [ColorNotation, ...ColorNotation[]], ColorNotation>({
    source: () => this.colorInput.resolvedNotations(),
    // untracked: a linkedSignal computation tracks what it reads, and committing writes hex back to
    // the value - tracking it would pull the display to hex after every entry
    computation: (offered) => {
      const bound = untracked(() => detectColorNotation(this.colorInput.value()));

      return bound && offered.includes(bound) ? bound : offered[0];
    },
  });

  private displayColor = computed(() =>
    formatHsvToNotation(this.colorInput.picker.hsv(), { notation: this.notation(), alpha: this.colorInput.alpha() }),
  );

  protected colorDraft = linkedSignal(() => this.displayColor());

  protected notationWarning = linkedSignal<HsvColor, string | null>({
    source: () => this.colorInput.picker.hsv(),
    computation: () => null,
  });

  protected notationLabel = computed(() => this.labels()[this.notation()]);

  protected canSwitchNotation = computed(() => this.colorInput.resolvedNotations().length > 1);

  protected huePercent = computed(() => (this.colorInput.picker.hsv().hue / 360) * 100);

  protected alphaPercent = computed(() => this.colorInput.picker.hsv().alpha * 100);

  constructor() {
    inject(AutoSurfaceDirective).matchOverlaySurface();

    injectOverlaySurfaceContext({ panelBody: this.panelBody, resizingClass: 'et-color-picker-panel--resizing' });
  }

  protected commitColorDraft() {
    const entered = this.colorDraft();
    const enteredNotation = detectColorNotation(entered);
    const isOffered = !!enteredNotation && this.colorInput.resolvedNotations().includes(enteredNotation);

    this.notationWarning.set(null);

    if (enteredNotation) {
      if (isOffered) {
        this.notation.set(enteredNotation);
      }

      // the advisory is set after the commit, never before: committing changes the picked color,
      // which is what drops a stale advisory
      this.colorInput.picker.commitColor(entered);

      if (!isOffered) {
        this.notationWarning.set(this.labels().notationConverted(this.notationLabel()));
      }
    }

    this.colorDraft.set(this.displayColor());
  }

  protected handleDraftInput(draft: string) {
    this.colorDraft.set(draft);

    this.notationWarning.set(null);
  }

  protected switchNotation() {
    const offered = this.colorInput.resolvedNotations();
    const next = offered[(offered.indexOf(this.notation()) + 1) % offered.length];

    if (next) {
      this.notation.set(next);
      this.notationWarning.set(null);
    }
  }

  protected handleColorKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    this.commitColorDraft();
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
