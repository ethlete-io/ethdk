import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { mountVisuallyHidden } from '@ethlete/core';
import { KBD_PLATFORM, kbdKeyLabel, KbdPlatform, kbdKeyName, parseKbdKeys } from './kbd-keys';
import { injectKbdLabels } from './kbd-labels';

/**
 * A keyboard shortcut rendered as keycaps, one cap per key, with the glyphs the current platform
 * prints on them - `mod+k` reads `⌘ K` on Apple and `Ctrl K` everywhere else.
 *
 * Use `mod` for the primary modifier rather than picking `meta` or `ctrl` yourself; that is the whole
 * point of the component. Keys are named case-insensitively and several spellings are accepted
 * (`cmd`, `option`, `escape`, `arrowup`, …). An unrecognised key is rendered as written.
 *
 * @example
 * <et-kbd keys="mod+k" />
 *
 * @example
 * <et-kbd keys="shift+alt+arrowup" />
 */
@Component({
  selector: 'et-kbd',
  template: `
    <span class="et-visually-hidden et-kbd-ally-text">{{ spokenLabel() }}</span>
    @for (key of keyLabels(); track $index) {
      <kbd class="et-kbd-key" aria-hidden="true">{{ key }}</kbd>
    }
  `,
  styleUrl: './kbd.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-kbd',
  },
})
export class KbdComponent {
  private detectedPlatform = inject(KBD_PLATFORM);
  private labels = injectKbdLabels();

  /** The shortcut, as keys joined by `+` - e.g. `mod+shift+k`. */
  public keys = input.required<string>();

  /** Renders the glyphs of this platform instead of the detected one. */
  public platform = input<KbdPlatform>();

  private resolvedPlatform = computed(() => this.platform() ?? this.detectedPlatform);

  protected keyLabels = computed(() =>
    parseKbdKeys(this.keys()).map((key) =>
      kbdKeyLabel(key, { platform: this.resolvedPlatform(), labels: this.labels() }),
    ),
  );

  protected spokenLabel = computed(() =>
    parseKbdKeys(this.keys())
      .map((key) => kbdKeyName(key, { platform: this.resolvedPlatform(), labels: this.labels() }))
      .join(' '),
  );

  constructor() {
    mountVisuallyHidden();
  }
}
