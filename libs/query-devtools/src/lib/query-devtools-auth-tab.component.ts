import { Component, ViewEncapsulation } from '@angular/core';
import {
  clearQueryDevtoolsTokenTtl,
  QUERY_DEVTOOLS_TOKEN_TTL_LIMIT,
  QueryDevtoolsEntry,
  setQueryDevtoolsTokenTtl,
} from '@ethlete/query';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

/** The Auth tab: registered bearer auth providers, their tokens and their internal queries. */
@Component({
  selector: 'et-query-devtools-auth-tab',
  templateUrl: './query-devtools-auth-tab.component.html',
  styleUrl: './query-devtools-auth-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsFeaturesComponent, QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsAuthTabComponent {
  protected host = injectQueryDevtoolsHost();

  protected readonly TTL_LIMIT = QUERY_DEVTOOLS_TOKEN_TTL_LIMIT;

  /**
   * Arms an access-token lifetime from the input's raw value, or disarms on an empty one. Clamped here
   * rather than left to the input's `min`/`max`, which a typed-in (or pasted) value ignores.
   */
  protected armTokenTtl(options: { entry: QueryDevtoolsEntry; value: string }) {
    const { entry, value } = options;

    if (value.trim() === '') {
      this.clearTokenTtl(entry);

      return;
    }

    setQueryDevtoolsTokenTtl({ providerName: this.providerName(entry), seconds: Number(value) });
  }

  /** Presents the current token as long expired, which is what makes a refresh happen at once. */
  protected expireTokenNow(entry: QueryDevtoolsEntry) {
    setQueryDevtoolsTokenTtl({ providerName: this.providerName(entry), seconds: 0 });
  }

  protected clearTokenTtl(entry: QueryDevtoolsEntry) {
    clearQueryDevtoolsTokenTtl(this.providerName(entry));
  }

  private providerName(entry: QueryDevtoolsEntry) {
    return entry.meta.name ?? '';
  }
}
