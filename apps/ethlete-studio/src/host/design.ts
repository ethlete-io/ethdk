import { Channel, invoke } from '@tauri-apps/api/core';
import { Observable } from 'rxjs';
import { HostShellMissingError, hasHostShell, invokeHost$ } from './invoke';

/** What the user ruled about an option. An option without one is still open. */
export type Verdict = 'chosen' | 'rejected';

/** One drawn answer to a call, as the call file declares it. */
export type CallOption = {
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

/** One pass over a call, as the call file declares it. */
export type CallRound = {
  key: string;
  title: string;
};

/** One open question of an exploration, and every option drawn for it. */
export type Call = {
  slug: string;
  /** The feature the call belongs to. A call without one is loose. */
  feature: string | null;
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
  options: CallOption[];
};

/** A checkout's design work: where its calls live, which port draws them, and the calls themselves. */
export type Project = {
  callsRoot: string;
  port: number;
  defaultCall: string | null;
  calls: Call[];
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

/** What the last check said about one variant. A variant no run ever checked has none. */
export type CheckReceipt = {
  ok: boolean;
  /** When the check ran, in seconds since the epoch. */
  at: number;
  said: string;
};

/** Which option of which call a check, or a verdict, is about. */
export type OptionAddress = {
  checkout: string;
  slug: string;
  option: string;
};

/** Reads what the last `check_call` said about one option, or `null` when no run ever checked it. */
export const designCheck$ = (address: OptionAddress): Observable<CheckReceipt | null> =>
  invokeHost$<CheckReceipt | null>('design_check', address);

/** Which option of which call the user ruled about, and how. */
export type VerdictWrite = {
  checkout: string;
  slug: string;
  option: string;
  verdict: Verdict | null;
};

/** Writes one option's verdict into its call file. A `null` verdict opens the option again. */
export const designSetVerdict$ = (write: VerdictWrite): Observable<void> =>
  invokeHost$<void>('design_set_verdict', write);

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
export type OptionsWrite = {
  checkout: string;
  slug: string;
  count: number;
  roundTitle: string;
};

/** The round Studio opened, and the key of every option it created for it. */
export type AddedOptions = {
  round: string;
  keys: string[];
};

/**
 * Opens a new round on a call and creates one empty option per variant: a stub component file
 * each, and an entry each in the call file. The name, the claim and the cost stay empty, because
 * only the drawing can argue them.
 */
export const designAddOptions$ = (write: OptionsWrite): Observable<AddedOptions> =>
  invokeHost$<AddedOptions>('design_add_options', write);

/** What a checkout's design server is doing, and what Studio may do about it. */
export type ServerState = {
  port: number;
  listening: boolean;
  /** True when this Studio started the server. Only then can Studio stop it again. */
  managed: boolean;
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

/** Where one option is drawn: the checkout's design server port, the call and the option. */
export type FrameAddress = {
  port: number;
  slug: string;
  option: string;
  /** Changes when the server started again, so a frame that met a dead port loads once more. */
  epoch?: number;
};

/** The address the checkout's design server draws one option at. */
export const frameUrl = ({ port, slug, option, epoch }: FrameAddress) =>
  `http://localhost:${port}/frame.html?call=${encodeURIComponent(slug)}&option=${encodeURIComponent(option)}` +
  (epoch ? `&epoch=${epoch}` : '');
