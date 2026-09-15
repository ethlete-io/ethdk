import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
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
      <et-banner
        description="The name list does not hold these, so they are sent as they are. Add the ones that name a client, a product, or a project."
        type="warning"
        heading="Words that go out as written"
      >
        <div class="flex flex-wrap gap-2" etBannerBody>
          @for (word of words(); track word) {
            <button
              [attr.data-unmasked-word]="word"
              (click)="store.addMaskedName(word)"
              et-button
              variant="outline"
              size="sm"
            >
              Mask {{ word }}
            </button>
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
}
