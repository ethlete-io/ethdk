import { Observable } from 'rxjs';
import { ProductAddress, designAnswer$ } from './design';

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
  covered: boolean;
};

/**
 * An inline SVG, an image or an open overlay of a rest frame. `owned` is drawn by the embedded part `owner`;
 * `finding` has no owner. `number` counts per kind within its frame only.
 */
export type InventoryItem = {
  number: number;
  kind: 'asset' | 'overlay';
  status: 'owned' | 'finding';
  what: string;
  id: string;
  label: string | null;
  owner: string | null;
  box: InventoryBox | null;
  covered: boolean;
};

/** A rest frame of a page; `shot` is a server path to its picture. */
export type InventoryFrame = {
  state: string;
  preset: string | null;
  width: number | null;
  shot: string;
  controls: InventoryControl[];
  items: InventoryItem[];
};

/** The control inventory of a page part, and its hash. */
export type Inventory = {
  part: string;
  hash: string;
  ids: string[];
  findings: number;
  frames: InventoryFrame[];
};

const inventoryUrl = ({ port, product, path, part }: ProductAddress & { path: string; part?: string }) =>
  `http://localhost:${port}/__design/${path}?product=${encodeURIComponent(product)}${
    part === undefined ? '' : `&part=${encodeURIComponent(part)}`
  }`;

export const inventory$ = (address: ProductAddress & { part: string }): Observable<Inventory> =>
  designAnswer$<Inventory>(inventoryUrl({ ...address, path: 'inventory' }));
