import { Channel, invoke } from '@tauri-apps/api/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { HostShellMissingError, hasHostShell, invokeHost$ } from './invoke';

/** What the user ruled about a variant. A variant without one is still open. */
export type Verdict = 'chosen' | 'rejected';

/** One drawn answer to a call, as the call file declares it. */
export type CallVariant = {
  key: string;
  name: string;
  round: string | null;
  verdict: Verdict | null;
  claim: string;
  cost: string;
};

/**
 * How a call is drawn. A wireframe shows the bare workflow with mocked values, and draws no logic
 * and no interaction state. A design call draws the real thing.
 */
export type CallMode = 'wireframe' | 'design';

/** The design order, from the foundations to a clickable prototype. */
export const CALL_STAGES = ['themes', 'ci', 'wireframe', 'component', 'element', 'page', 'prototype'] as const;

export type CallStage = (typeof CALL_STAGES)[number];

/** A quick exploration of an idea, outside the ordered stages. */
export const SKETCH_STAGE = 'sketch';

/** Where calls made before a stage was required are listed. */
export const LEGACY_STAGE = 'legacy';

/** One pass over a call, as the call file declares it. */
export type CallRound = {
  key: string;
  title: string;
};

/** One part of a wireframe's inventory: an SDK component, or a new one with its own component call. */
export type InventoryPart = {
  part: string;
  sdk: string | null;
  new: boolean;
  /** The slug of the component call a new part is drawn in. */
  call: string | null;
};

export type CallClosed = 'shipped' | 'superseded';

/** One open question of an exploration, and every variant drawn for it. */
export type Call = {
  slug: string;
  /** The feature the call belongs to. A call without one is loose. */
  feature: string | null;
  /** Where the call sits in the design order, or `sketch`. A call without one is invalid unless it is legacy. */
  stage: CallStage | typeof SKETCH_STAGE | null;
  /** A call made before the stage was required. It needs no stage. */
  legacy: boolean;
  /** A closed call is settled, whatever its variants say. */
  closed: CallClosed | null;
  /** The slug of the call this one is parked on. It is on hold until that call settles. */
  waitsFor: string | null;
  /** The parts a wireframe lists, the queue of component calls. Empty when it declares none. */
  inventory: InventoryPart[];
  eyebrow: string;
  headline: string;
  intro: string;
  frameWidth: number;
  /** The mode every variant of the call is drawn in. A call that names none is in `design`. */
  mode: CallMode;
  /** True when a full agent session already wrote its state into the call's folder. */
  handoff: boolean;
  /** When the call's folder was last written, in seconds since the epoch. */
  touched: number;
  /** Every round the call declares, in the order it wrote them. A call may declare none. */
  rounds: CallRound[];
  variants: CallVariant[];
};

/** A checkout's design work: where its calls live, which port draws them, and the calls themselves. */
export type Project = {
  callsRoot: string;
  port: number;
  defaultCall: string | null;
  /** The themes each design project names, keyed by the project. The first name of a list is the default. */
  themes: Record<string, Themes>;
  calls: Call[];
};

/** The surface and colour themes a design project draws in. */
export type Themes = {
  surface: string[];
  color: string[];
};

/** Reads every call of a checkout. The checkout must carry a `.ethlete/design/config.json`. */
export const designProject$ = (checkout: string): Observable<Project> =>
  invokeHost$<Project>('design_project', { checkout });

/**
 * Reports every change under the checkout's calls root. A call or a variant that an agent or an
 * editor wrote outside this window reaches the list through it, so nothing waits for a reload.
 */
export const designChanges$ = (checkout: string): Observable<void> =>
  new Observable<void>((subscriber) => {
    if (!hasHostShell()) {
      subscriber.error(new HostShellMissingError());

      return;
    }

    const changes = new Channel<void>();

    changes.onmessage = () => subscriber.next();

    invoke('design_watch', { checkout, changes }).catch((error: unknown) => subscriber.error(error));
  });

/** What a checkout's design server is doing, and what Studio may do about it. */
export type ServerState = {
  port: number;
  listening: boolean;
  /** True when this Studio started the server. Only then can Studio stop it again. */
  managed: boolean;
  /** True when something listens that this Studio did not start. */
  foreign: boolean;
  /** True when the server runs another cli build than the one on disk, or reports none. */
  stale: boolean;
  /** True when a server Studio started has since ended. `log` holds its last output. */
  exited: boolean;
  log: string[];
};

/** Reads whether the checkout's design server answers on its port. */
export const designServerState$ = (checkout: string): Observable<ServerState> =>
  invokeHost$<ServerState>('design_server_state', { checkout });

/** Starts the checkout's design server. Answers once the port accepts connections. */
export const designServerStart$ = (checkout: string): Observable<ServerState> =>
  invokeHost$<ServerState>('design_server_start', { checkout });

/** Stops the server this Studio started. A server somebody else started stays up. */
export const designServerStop$ = (checkout: string): Observable<ServerState> =>
  invokeHost$<ServerState>('design_server_stop', { checkout });

/** Stops whatever listens on the checkout's port, whoever started it, and starts Studio's own server. */
export const designServerRestart$ = (checkout: string): Observable<ServerState> =>
  invokeHost$<ServerState>('design_server_restart', { checkout });

/** Where one variant is drawn: the checkout's design server port, the call and the variant. */
export type FrameAddress = {
  port: number;
  slug: string;
  variant: string;
  /** Changes when the server started again, so a frame that met a dead port loads once more. */
  epoch?: number;
  /** The surface theme the frame root wears. */
  surface?: string;
  /** The colour theme the frame root wears. */
  color?: string;
};

/** The address the checkout's design server draws one variant at. */
export const frameUrl = ({ port, slug, variant, epoch, surface, color }: FrameAddress) =>
  `http://localhost:${port}/frame.html?call=${encodeURIComponent(slug)}&variant=${encodeURIComponent(variant)}` +
  (surface ? `&surface=${encodeURIComponent(surface)}` : '') +
  (color ? `&color=${encodeURIComponent(color)}` : '') +
  (epoch ? `&epoch=${epoch}` : '');

/** The address of a PNG of a whole variant at `width`, drawn like a part shot, renewed with each `revision`. */
export const callShotUrl = ({ width, revision, ...address }: FrameAddress & { width: number; revision?: number }) =>
  frameUrl(address).replace('/frame.html?', '/__design/shot?') +
  `&width=${width}` +
  (revision ? `&revision=${revision}` : '');

export type DesignRoots = {
  /** The folder a scan walks. Empty until the user names one. */
  search: string;
  /** Every checkout the user keeps, in alphabetical order. */
  roots: string[];
};

/** Reads the checkouts Studio keeps. */
export const designRoots$ = (): Observable<DesignRoots> => invokeHost$<DesignRoots>('design_roots');

/** Keeps a checkout. A checkout that carries no design work is refused. */
export const designRootsAdd$ = (checkout: string): Observable<DesignRoots> =>
  invokeHost$<DesignRoots>('design_roots_add', { checkout });

/** Drops a checkout from the list. The checkout itself is left alone. */
export const designRootsForget$ = (checkout: string): Observable<DesignRoots> =>
  invokeHost$<DesignRoots>('design_roots_forget', { checkout });

/** Names the folder a scan walks. An empty name drops it again. */
export const designRootsSearch$ = (folder: string): Observable<DesignRoots> =>
  invokeHost$<DesignRoots>('design_roots_search', { folder });

/** Reports every checkout under the folder that carries design work, kept or not. */
export const designScan$ = (folder: string): Observable<string[]> => invokeHost$<string[]>('design_scan', { folder });

export type PartOrigin = 'product' | 'base' | 'overridden';

/** What a rule, or the loading of a part's module, finds wrong. `LOAD` means the part does not render. */
export type SystemProblem = {
  rule: string;
  file: string;
  message: string;
};

/** A viewport a product's parts are drawn at. Without a height, the frame grows with its content. */
export type SystemPreset = { width: number; height?: number };

export type ListedPart = {
  layer: string;
  name: string;
  origin: PartOrigin;
  note: string | null;
  states: string[];
  widths?: number[];
  problems: SystemProblem[];
};

export type ListedProduct = {
  name: string;
  base: string | null;
  presets: Record<string, SystemPreset>;
  /** Missing from an `@ethlete/cli` older than product themes. */
  themes?: Themes;
  parts: ListedPart[];
  problems: SystemProblem[];
};

/** What a failed read of the system or the calls tells the user. A 404 means a cli older than the route. */
export const designReadError = (status: number) =>
  status === 404
    ? "This checkout's @ethlete/cli has no system view. Update it."
    : `The design server answered ${status}.`;

export const listedSystem$ = (port: number): Observable<ListedProduct[]> =>
  fromFetch(`http://localhost:${port}/__design/system`).pipe(
    switchMap((response) => {
      if (!response.ok) throw new Error(designReadError(response.status));

      return response.json() as Promise<ListedProduct[]>;
    }),
  );

export type PartAddress = {
  port: number;
  product: string;
  /** `<layer>/<name>`. */
  part: string;
  state: string;
  epoch?: number;
  surface?: string;
  color?: string;
  /** Draws the part at the size of its content instead of the size of the frame. */
  fit?: boolean;
};

const themeQuery = ({ surface, color }: { surface?: string; color?: string }) =>
  (surface ? `&surface=${encodeURIComponent(surface)}` : '') + (color ? `&color=${encodeURIComponent(color)}` : '');

const partQuery = ({ product, part, state }: PartAddress) =>
  `product=${encodeURIComponent(product)}&part=${encodeURIComponent(part)}&state=${encodeURIComponent(state)}`;

export const partFrameUrl = (address: PartAddress) =>
  `http://localhost:${address.port}/frame.html?${partQuery(address)}${themeQuery(address)}` +
  (address.fit ? '&fit' : '') +
  (address.epoch ? `&epoch=${address.epoch}` : '');

/**
 * The address of a PNG of one state of a part at one preset or one container width, or fitted to its
 * content with neither, renewed with each `revision`.
 */
export const partShotUrl = (address: PartAddress & { preset?: string; width?: number; revision?: number }) =>
  `http://localhost:${address.port}/__design/shot?${partQuery(address)}` +
  (address.preset ? `&preset=${encodeURIComponent(address.preset)}` : '') +
  (address.width ? `&width=${address.width}` : '') +
  themeQuery(address) +
  (address.epoch ? `&epoch=${address.epoch}` : '') +
  (address.revision ? `&revision=${address.revision}` : '');

/** A call of the old design-call workflow, as the design server lists it. One that fails to load carries its error. */
export type ListedCall =
  | {
      slug: string;
      project: string;
      eyebrow: string;
      headline: string;
      stage: string | null;
      legacy: boolean;
      transferred: boolean;
      closed: string | null;
      frameWidth: number;
      variants: { key: string; name: string }[];
    }
  | { slug: string; project: string; error: string };

export const listedCalls$ = (port: number): Observable<ListedCall[]> =>
  fromFetch(`http://localhost:${port}/__design/calls`).pipe(
    switchMap((response) => {
      if (!response.ok) throw new Error(designReadError(response.status));

      return response.json() as Promise<ListedCall[]>;
    }),
  );

export type TransferResult = 'marked' | 'already' | 'missing' | 'unreadable';

/** Writes `transferred: true` into a call's `call.ts`. A missing or unreadable call fails. */
export const transferCall$ = (port: number, slug: string): Observable<TransferResult> =>
  fromFetch(`http://localhost:${port}/__design/transfer?call=${encodeURIComponent(slug)}`, { method: 'POST' }).pipe(
    switchMap((response) =>
      from(response.json() as Promise<{ result: TransferResult }>).pipe(
        map(({ result }) => {
          if (!response.ok) throw new Error(`The design server could not mark ${slug} transferred: ${result}.`);

          return result;
        }),
      ),
    ),
  );

export type SketchDecision =
  | { kind: 'pick'; variant: string; comment?: string; decidedAt: string }
  | { kind: 'discard'; comment?: string; decidedAt: string };

/** An open sketch of a product: `target` is `<layer>/<name>`, and each variant lists the rule problems it has laid over the product. */
export type ListedSketch = {
  target: string;
  status: 'in progress' | 'ready';
  createdAt: string;
  decision?: SketchDecision;
  product: string;
  layer: string;
  name: string;
  dir: string;
  variants: string[];
  problems: { variant: string; problems: SystemProblem[] }[];
};

export type ListedSketches = { sketches: ListedSketch[]; unreadable: SystemProblem[] };

/** The parts a merge of one variant changes, and the elements and pages that show them, each as `<layer>/<name>`. */
export type MergePreview = { changed: string[]; affected: string[] };

export type SketchAddress = { port: number; product: string; sketch: string };

const sketchUrl = ({ path, port, product, sketch, extra = '' }: SketchAddress & { path: string; extra?: string }) =>
  `http://localhost:${port}/__design/${path}?product=${encodeURIComponent(product)}&sketch=${encodeURIComponent(sketch)}${extra}`;

/** Reads a design server answer, and fails with the server's own `error` message when it refuses. */
const designAnswer$ = <TResult>(url: string, init?: RequestInit): Observable<TResult> =>
  fromFetch(url, init).pipe(
    switchMap((response) =>
      from(response.json().catch(() => null) as Promise<unknown>).pipe(
        map((body) => {
          if (response.ok) return body as TResult;

          const error =
            body !== null && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
              ? body.error
              : null;

          throw new Error(error ?? designReadError(response.status));
        }),
      ),
    ),
  );

// A string body goes as text/plain, a simple request: the design server answers no CORS preflight.
const postJson = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const listedSketches$ = (port: number, product: string): Observable<ListedSketches> =>
  designAnswer$<ListedSketches>(`http://localhost:${port}/__design/sketches?product=${encodeURIComponent(product)}`);

export const sketchPreview$ = (address: SketchAddress & { variant: string }): Observable<MergePreview> =>
  designAnswer$<MergePreview>(
    sketchUrl({ ...address, path: 'sketch-preview', extra: `&variant=${encodeURIComponent(address.variant)}` }),
  );

export type SketchDecisionWrite =
  { kind: 'pick'; variant: string; comment?: string } | { kind: 'discard'; comment?: string };

/** Writes the user's pick or discard into `sketch.json`. A pick needs a sketch that is ready. */
export const decideSketch$ = (address: SketchAddress, decision: SketchDecisionWrite): Observable<void> =>
  designAnswer$<unknown>(sketchUrl({ ...address, path: 'sketch-decision' }), postJson(decision)).pipe(
    map(() => undefined),
  );

/** Merges the picked variant into the product with `note` as the reason, and answers the merged parts. */
export const mergeSketch$ = (address: SketchAddress, note: string): Observable<string[]> =>
  designAnswer$<{ merged: string[] }>(sketchUrl({ ...address, path: 'sketch-merge' }), postJson({ note })).pipe(
    map(({ merged }) => merged),
  );

/** Deletes the sketch with all its variants. */
export const discardSketch$ = (address: SketchAddress): Observable<void> =>
  designAnswer$<unknown>(sketchUrl({ ...address, path: 'sketch-discard' }), { method: 'POST' }).pipe(
    map(() => undefined),
  );
