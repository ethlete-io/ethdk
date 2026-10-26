import { Channel, invoke } from '@tauri-apps/api/core';
import { Observable, catchError, map, of } from 'rxjs';
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

/** One entry of a project's design system, with the text of its `entry.md` and its preview call. */
export type SystemEntry = {
  project: string;
  name: string;
  entry: string | null;
  /** The slug of the preview call, `<project>/system/<name>`. Null while it does not exist. */
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

/** Lists the design system entries of every project of a checkout. */
export const designSystem$ = (checkout: string): Observable<SystemEntry[]> =>
  invokeHost$<SystemEntry[]>('design_system', { checkout });

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

/** What the last check said about one variant. A variant no run ever checked has none. */
export type CheckReceipt = {
  ok: boolean;
  /** When the check ran, in seconds since the epoch. */
  at: number;
  said: string;
};

/** Which variant of which call a check, or a verdict, is about. */
export type VariantAddress = {
  checkout: string;
  slug: string;
  variant: string;
};

/** Reads what the last `check_call` said about one variant, or `null` when no run ever checked it. */
export const designCheck$ = (address: VariantAddress): Observable<CheckReceipt | null> =>
  invokeHost$<CheckReceipt | null>('design_check', address);

/** The state `et design new`, `et design check --call` or `et design status` last recorded for a call. */
export type CallStatus = {
  state: 'scaffolded' | 'drawing' | 'checking' | 'ready' | 'failed';
  /** An ISO timestamp. */
  updatedAt: string;
  /** What a failed check said. */
  message?: string;
};

/** Reads the recorded state of each named call. A call with none is left out. */
export const designStatuses$ = (checkout: string, slugs: string[]): Observable<Record<string, CallStatus>> =>
  invokeHost$<Record<string, CallStatus>>('design_statuses', { checkout, slugs });

/** Emits whenever a recorded call state changes. */
export const designStatusChanges$ = (): Observable<void> =>
  new Observable<void>((subscriber) => {
    if (!hasHostShell()) {
      subscriber.error(new HostShellMissingError());

      return;
    }

    const changes = new Channel<void>();

    changes.onmessage = () => subscriber.next();

    invoke('design_status_watch', { changes }).catch((error: unknown) => subscriber.error(error));
  });

/** Which variant of which call the user ruled about, and how. */
export type VerdictWrite = {
  checkout: string;
  slug: string;
  variant: string;
  verdict: Verdict | null;
  /** Written as the note of the variant's round, replacing the one it had. Left out keeps the note. */
  note?: string;
};

/** Writes one variant's verdict into its call file. A `null` verdict opens the variant again. */
export const designSetVerdict$ = (write: VerdictWrite): Observable<void> =>
  invokeHost$<void>('design_set_verdict', write);

/** Which call closes, and how. A `null` state reopens it. */
export type ClosedWrite = {
  checkout: string;
  slug: string;
  closed: CallClosed | null;
};

/** Writes whether a call is closed into its call file. */
export const designSetClosed$ = (write: ClosedWrite): Observable<void> => invokeHost$<void>('design_set_closed', write);

/** Which call changes mode, and to which one. */
export type ModeWrite = {
  checkout: string;
  slug: string;
  mode: CallMode;
};

/**
 * Writes the mode into the call file. The mode belongs to the call, so every variant of it is
 * drawn under the same rules and the thumbnail column compares like with like.
 */
export const designSetMode$ = (write: ModeWrite): Observable<void> => invokeHost$<void>('design_set_mode', write);

/** How many variants a call gets, and what the round they answer asks. */
export type VariantsWrite = {
  checkout: string;
  slug: string;
  count: number;
  roundTitle: string;
};

/** The round Studio opened, and the key of every variant it created for it. */
export type AddedVariants = {
  round: string;
  keys: string[];
};

/**
 * Opens a new round on a call and creates the empty variants it asks for: a stub component file
 * each, and an entry each in the call file. The name, the claim and the cost stay empty, because
 * only the drawing can argue them.
 */
export const designAddVariants$ = (write: VariantsWrite): Observable<AddedVariants> =>
  invokeHost$<AddedVariants>('design_add_variants', write);

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

/** The address of a variant's thumbnail: a PNG the design server draws, renewed with each `revision`. */
export const thumbUrl = ({ revision, ...address }: FrameAddress & { revision?: number }) =>
  frameUrl(address).replace('/frame.html?', '/__design/thumb?') + (revision ? `&revision=${revision}` : '');

/**
 * Whether the design server on `port` has the thumbnail route. Without a call it answers 400, while
 * an `@ethlete/cli` older than the route answers 404. Draws nothing.
 */
export const drawsThumbs$ = (port: number): Observable<boolean> =>
  fromFetch(`http://localhost:${port}/__design/thumb`).pipe(
    map((response) => response.status !== 404),
    catchError(() => of(true)),
  );

/** The checkouts Studio keeps, and the folder a scan walks for more. */
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
