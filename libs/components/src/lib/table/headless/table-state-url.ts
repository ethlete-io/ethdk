import { TableState } from '../table.types';

/**
 * Serialize a {@link TableState} to a compact string for a URL query param (or any
 * string store), so a table setup - column order, visibility, sort, filters, expanded
 * rows and any feature slices - is shareable as a link. Pair with {@link deserializeTableState}.
 * `createTableStateStorage` uses the same form, so a link and a stored setup are interchangeable.
 *
 * The result is a raw JSON string; when you assign it to an Angular Router query param
 * the router handles URL-encoding. Encode it yourself (`encodeURIComponent`) only when
 * building a URL string by hand.
 */
export const serializeTableState = (state: TableState) => JSON.stringify(state);

/**
 * Parse a {@link TableState} from a string produced by {@link serializeTableState}.
 * Returns `null` when the input is absent, malformed, or a version this build doesn't
 * understand - so a stale or hand-edited link degrades to "no restore" instead of throwing.
 */
export const deserializeTableState = (raw: string | null | undefined): TableState | null => {
  if (!raw) return null;

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Partial<TableState>;

  // v1 predates the `features` bag and v2 the expansion feature's slice; all three restore, so an older
  // link or stored setup keeps working - see TableState.
  if (![1, 2, 3].includes(candidate.v as number) || !Array.isArray(candidate.columns)) return null;

  return candidate as TableState;
};
