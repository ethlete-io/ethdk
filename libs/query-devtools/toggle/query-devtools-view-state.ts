import { queryDevtoolsSettings, readQueryDevtoolsStore } from '@ethlete/query/devtools-contract';

/**
 * Where the panel's own view state lives - open/closed, dock, sizes, selection, filters. Bumped
 * whenever a shape change would make an older stored state restore into something wrong.
 */
export const QUERY_DEVTOOLS_VIEW_STATE_KEY = 'ethlete:query:devtools:v4';

/**
 * Whether the panel was open when this tab last stored its view state. Read by
 * `<et-query-devtools-lazy>`, which has to load the panel before it can ask the panel anything.
 */
export const wasQueryDevtoolsOpen = () =>
  readQueryDevtoolsStore<{ open?: boolean }>(queryDevtoolsSettings().viewState, QUERY_DEVTOOLS_VIEW_STATE_KEY)?.open ===
  true;
