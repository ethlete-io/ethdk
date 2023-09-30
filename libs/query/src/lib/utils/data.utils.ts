export interface QueryContainerConfig {
  /**
   * If `true`, the previous query will be aborted when a new query is pushed into the container.
   * @default true // Only if the request can be cached (GET, OPTIONS, HEAD and GQL_QUERY). Otherwise false.
   */
  abortPrevious?: boolean;

  /**
   * If `true`, the query will be aborted when the container is destroyed.
   * @default true // Only if the request can be cached (GET, OPTIONS, HEAD and GQL_QUERY). Otherwise false.
   */
  abortOnDestroy?: boolean;
}
