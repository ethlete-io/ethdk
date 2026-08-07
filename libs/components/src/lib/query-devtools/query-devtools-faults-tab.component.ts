import { Component, ViewEncapsulation } from '@angular/core';
import { clamp } from '@ethlete/core';
import { clearQueryDevtoolsFaults, QUERY_DEVTOOLS_FAULT_STATUSES, setQueryDevtoolsFault } from '@ethlete/query';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { NumericFaultField } from './query-devtools-types';

/** The Faults tab: arms latency/failure injection per client - in-memory only, not persisted. */
@Component({
  selector: 'et-query-devtools-faults-tab',
  templateUrl: './query-devtools-faults-tab.component.html',
  styleUrl: './query-devtools-faults-tab.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsFaultsTabComponent {
  protected host = injectQueryDevtoolsHost();

  protected readonly FAULT_STATUSES = QUERY_DEVTOOLS_FAULT_STATUSES;
  protected readonly CLEAR_FAULTS = clearQueryDevtoolsFaults;

  /** The ceiling each numeric fault field is clamped to. */
  private readonly FAULT_LIMITS: Record<NumericFaultField, number> = {
    latencyMs: 60_000,
    failNext: 99,
    failRate: 100,
  };

  /**
   * Arms one numeric field of a client's fault from an input's raw value. Clamped here rather than left
   * to the input's `min`/`max`, which a typed-in (or pasted) value ignores.
   */
  protected armFaultValue(options: { clientName: string; field: NumericFaultField; value: string }) {
    const { clientName, field, value } = options;
    const parsed = clamp(Math.trunc(Number(value) || 0), 0, this.FAULT_LIMITS[field]);

    setQueryDevtoolsFault({ clientName, patch: { [field]: parsed } });
  }

  protected armFaultStatus(options: { clientName: string; value: string }) {
    setQueryDevtoolsFault({ clientName: options.clientName, patch: { status: Number(options.value) } });
  }

  /** Whether the default retry policy retries the status a client is armed to fail with. */
  protected isFaultStatusRetryable(status: number) {
    return QUERY_DEVTOOLS_FAULT_STATUSES.find((entry) => entry.status === status)?.retryable ?? false;
  }
}
