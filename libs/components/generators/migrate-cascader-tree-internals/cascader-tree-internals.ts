import { RemovedExport } from '../removed-exports/removed-exports.js';

const NAMES = ['toChildrenObservable', 'toSearchObservable', 'toPathObservable', 'nodesEqual', 'indexOfNode'] as const;

export const CASCADER_TREE_INTERNALS_REMOVALS: readonly RemovedExport[] = NAMES.map((name) => ({
  name,
  todo: `${name} is no longer exported; it is a cascader internal. A data source may return an array, a Promise or an Observable as it is, and node equality is the compareWith of the cascader applied to node.value.`,
}));
