import { signal } from '@angular/core';
import { QueryDevtoolsHost } from '../query-devtools-host';

/**
 * A stand-in for the panel behind {@link QUERY_DEVTOOLS_HOST}, for specs that mount a single tab. Only
 * the members the mounted tab reads have to be present - pass them in `overrides`.
 */
export const createQueryDevtoolsTestHost = (overrides: Partial<QueryDevtoolsHost> = {}): QueryDevtoolsHost =>
  ({
    clientNames: signal<string[]>([]),
    repositories: signal([]),
    eventLog: signal([]),
    eventClient: signal<string | null>(null),
    eventErrorsOnly: signal(false),
    eventSelectedQueryId: signal<string | null>(null),
    eventSelectedQuery: signal(null),
    faultClients: signal([]),
    queryFacets: signal(new Set()),
    queryRecentFirst: signal(false),
    queryTreeView: signal(false),
    queryEntries: signal([]),
    overridesPersist: () => false,
    overridesScopeLabel: () => 'not kept',
    toggleOverridesPersist: () => undefined,
    toggleFacet: () => undefined,
    resetDevtools: () => undefined,
    ...overrides,
  }) as unknown as QueryDevtoolsHost;
