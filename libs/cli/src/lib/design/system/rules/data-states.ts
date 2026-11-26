import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { dataStatesOf, showsDataListOf } from '../sketch/part-definition';

/** A part with `data: 'list'` whose `dataStates` is not a literal map naming the loading, error and empty state. */
export const listPartsWithoutDataStatesOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => showsDataListOf(part.source) && !dataStatesOf(part.source))
    .map((part) => ({
      rule: 'DATA-STATES',
      file: part.file,
      message:
        "data: 'list' needs dataStates: { loading, error, empty }, each a string literal naming the state that draws it",
    }));
