import { fromFetch } from 'rxjs/fetch';
import { Observable, from, map, switchMap } from 'rxjs';
import { ProductAddress, designAnswer$, designJson } from './design';

/**
 * `declared` is green; `owned` is drawn and declared by the embedded part `owner`; `undeclared` (red) has no
 * declaration; `unclassified` (amber) only looks interactive.
 */
export type InventoryStatus = 'declared' | 'owned' | 'undeclared' | 'unclassified';

/** In the shot's own pixels. */
export type InventoryBox = { x: number; y: number; width: number; height: number };

/** A numbered control; it keeps its number in every frame that draws it. */
export type InventoryControl = {
  number: number;
  id: string;
  label: string | null;
  status: InventoryStatus;
  kind: string;
  inputs: string[];
  surfaces: string[];
  owner: string | null;
  states: number;
  box: InventoryBox | null;
};

/** A rest frame of a page; `shot` is a server path to its picture. */
export type InventoryFrame = {
  state: string;
  preset: string | null;
  width: number | null;
  shot: string;
  controls: InventoryControl[];
};

export type InventoryApproval = { ids: string[]; hash: string; by: string; at: string };

export type InventoryState =
  | { state: 'approved' }
  | { state: 'reopened'; added: string[]; removed: string[]; changed: boolean }
  | { state: 'none' };

/** The control inventory of a page part, its hash, and whether its approval holds. */
export type Inventory = {
  part: string;
  hash: string;
  ids: string[];
  findings: number;
  approval: InventoryApproval | null;
  state: InventoryState;
  reason: string | null;
  frames: InventoryFrame[];
};

/** A refused approval: 409 when the part changed since it was shown, 422 while a control is undeclared or unclassified. */
export class InventoryRefusal extends Error {
  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const inventoryUrl = ({ port, product, path, part }: ProductAddress & { path: string; part?: string }) =>
  `http://localhost:${port}/__design/${path}?product=${encodeURIComponent(product)}${
    part === undefined ? '' : `&part=${encodeURIComponent(part)}`
  }`;

export const inventory$ = (address: ProductAddress & { part: string }): Observable<Inventory> =>
  designAnswer$<Inventory>(inventoryUrl({ ...address, path: 'inventory' }));

export const approveInventory$ = (
  address: ProductAddress,
  approval: { part: string; hash: string; by: string },
): Observable<Inventory> =>
  fromFetch(inventoryUrl({ ...address, path: 'inventory-approve' }), {
    method: 'POST',
    body: JSON.stringify(approval),
  }).pipe(
    switchMap((response) =>
      from(designJson(response).catch(() => null)).pipe(
        map((body) => {
          if (response.ok) return body as Inventory;

          const error = body !== null && typeof body === 'object' ? (body as Record<string, unknown>)['error'] : null;

          throw new InventoryRefusal(response.status, typeof error === 'string' ? error : `HTTP ${response.status}`);
        }),
      ),
    ),
  );
