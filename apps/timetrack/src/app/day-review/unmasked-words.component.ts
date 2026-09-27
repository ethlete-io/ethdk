import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { pseudonymMap, unmaskedWords } from '@ethlete/timetrack';
import { injectTimetrackSettings } from '../settings';

/**
 * What the anonymiser could not account for in a payload, shown beside the payload itself.
 *
 * A name list grown by hand is only safe if the app says what is missing from it, and the moment to
 * say so is before the press and not after. Every word here goes out as written, so each one carries
 * the press that puts it on the list.
 *
 * Give it the text that is actually sent. It reads the printed payload rather than its fields, so a
 * field added to the request later is covered without a change here.
 */
@Component({
  selector: 'ethlete-unmasked-words',
  template: `
    @if (words().length) {
      <details>
        <summary class="cursor-pointer text-small text-et-warning-ink">{{ summary() }}</summary>

        <div class="mt-2 flex max-h-70 flex-wrap gap-2 overflow-y-auto">
          @for (entry of words(); track entry.word) {
            <button
              [attr.data-unmasked-word]="entry.word"
              (click)="store.addMaskedName(entry.word)"
              et-button
              variant="outline"
              size="sm"
            >
              Mask {{ entry.word }}
            </button>
          }
        </div>
      </details>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class UnmaskedWordsComponent {
  protected store = injectTimetrackSettings();

  /** The payload exactly as it is sent, printed. */
  public text = input.required<string>();

  protected words = computed(() =>
    unmaskedWords({
      text: this.text(),
      map: pseudonymMap(this.store.settings().reasoning.maskedNames),
    }),
  );

  protected summary = computed(() => {
    const total = this.words().length;
    const count = total === 1 ? '1 word goes' : `${total} words go`;

    return `${count} out unmasked`;
  });
}
