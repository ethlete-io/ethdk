import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
import { pseudonymMap, unmaskedWords } from '@ethlete/timetrack';
import { injectTimetrackSettings } from '../settings';

const SHOWN_LIMIT = 12;

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
      <et-banner [description]="summary()" type="warning" heading="Words that go out as written">
        <div class="flex flex-col gap-2" etBannerBody>
          <div class="flex flex-wrap gap-2">
            @for (entry of shown(); track entry.word) {
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

          @if (rest().length) {
            <details class="rounded-md border border-et-surface-border p-3">
              <summary class="cursor-pointer text-small text-et-surface-muted">{{ restSummary() }}</summary>

              <div class="mt-2 flex max-h-70 flex-wrap gap-2 overflow-y-auto">
                @for (entry of rest(); track entry.word) {
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
        </div>
      </et-banner>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS],
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

  protected shown = computed(() => {
    const words = this.words();
    const named = words.filter((entry) => entry.likelyName);

    return (named.length ? named : words).slice(0, SHOWN_LIMIT);
  });

  protected rest = computed(() => {
    const shown = new Set(this.shown().map((entry) => entry.word));

    return this.words().filter((entry) => !shown.has(entry.word));
  });

  protected summary = computed(() => {
    const total = this.words().length;
    const count = total === 1 ? '1 word goes' : `${total} words go`;

    return `${count} out as written, because the name list does not hold them. The ones shaped like a name come first. Mask every one that names a client, a product, or a project.`;
  });

  protected restSummary = computed(() => {
    const count = this.rest().length;

    return count === 1 ? '1 more word, less like a name' : `${count} more words, less like a name`;
  });
}
