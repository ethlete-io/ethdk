import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { RepoNamingOffer, formatDurationMs } from '@ethlete/timetrack';

/**
 * The answer a checkout's own record already holds, offered as one click.
 *
 * It sits on the day screen rather than in the naming card, because the case it exists for is a
 * checkout whose time a donating rule hands away: nothing about it is waiting for a name, so the card
 * never lists it and the user is never asked. Read {@link RepoNamingOffer} for what the app may do
 * with it, which is offer it and nothing else.
 */
@Component({
  selector: 'ethlete-naming-offer',
  template: `
    @for (entry of listed(); track entry.offer.repoPath) {
      <div [attr.data-offer]="entry.offer.repoPath" class="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-small">
        <span class="text-et-surface-muted" data-offer-reason>{{ entry.reason }}</span>
        <button (click)="accept.emit(entry.offer)" et-button variant="outline" size="sm">
          Always log {{ entry.offer.label }} on {{ entry.offer.issueKey }}
        </button>
        <button (click)="dismiss.emit(entry.offer)" et-button variant="transparent" size="sm">Not this</button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class NamingOfferComponent {
  public offers = input.required<readonly RepoNamingOffer[]>();

  public accept = output<RepoNamingOffer>();
  /** The offer the user turned down, so the day stops proposing it. */
  public dismiss = output<RepoNamingOffer>();

  protected listed = computed(() =>
    this.offers().map((offer) => {
      const share = Math.round(offer.share * 100);
      const held = `${formatDurationMs(offer.loggedMs)} over ${offer.days} days`;
      const record = `${offer.label} files into ${offer.projectKey}, and ${share}% of your ${offer.projectKey} time is on ${offer.issueKey} — ${held}`;

      return {
        offer,
        reason: offer.supersedes.length
          ? `${record}. Taking this replaces the rule that donates its time.`
          : `${record}.`,
      };
    }),
  );
}
