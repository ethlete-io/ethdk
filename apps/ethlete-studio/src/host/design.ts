import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

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

/** One open question of an exploration, and every option drawn for it. */
export type Call = {
  slug: string;
  /** The feature the call belongs to. A call without one is loose. */
  feature: string | null;
  eyebrow: string;
  headline: string;
  intro: string;
  frameWidth: number;
  options: CallOption[];
};

/** A checkout's design work: where its calls live, which port draws them, and the calls themselves. */
export type Project = {
  callsRoot: string;
  port: number;
  defaultCall: string | null;
  calls: Call[];
};

/** Reads every call of a checkout. The checkout must carry a `design-explore.config.json`. */
export const designProject$ = (checkout: string): Observable<Project> =>
  invokeHost$<Project>('design_project', { checkout });

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
