// The table's headless layer: everything with state or logic but no visual opinion - the feature-host
// contract features register through, the pure row transforms (sort, filter, column reconciliation),
// the label set, the template-registration directives, the serialization adapters (URL, storage) and
// the query-backed rows sources.
//
// The feature *directives* that stamp a control into the table (filters, resize, reorder, selection,
// the column menu) stay at the domain root next to the components they stamp: they are orchestrators
// of presentation, so putting them here would only invert the dependency. `table.types.ts` and
// `table-errors.ts` also stay at the root - domain-wide infrastructure, per the architecture doc.
export * from './table-column-state';
export * from './table-csv-export';
export * from './table-csv-rows-from-pages';
export * from './table-features';
export * from './table-filter';
export * from './table-footer.directive';
export * from './table-labels';
export * from './table-rows-from-query';
export * from './table-rows-from-v2-query';
export * from './table-rows-source';
export * from './table-sort';
export * from './table-state-persistence.directive';
export * from './table-state-storage';
export * from './table-state-url';
export * from './table-templates';
