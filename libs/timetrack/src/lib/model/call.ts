/** One stretch a process held the microphone, and what the rules made of it. */
export type CallWindow = {
  from: Date;
  to: Date;
  /** The process that held the microphone, raw. This is what a rule matched, and what a rule may match. */
  appId: string;
  /** The last window title that application had before the call opened. Empty when it had none. */
  title: string;
  /**
   * How long the call's own application held the focus inside this window.
   *
   * It separates a call the user took part in from a voice room left open in the background — see
   * `classifyCalls`. It is 0 on a day whose window source reported nothing, where attendance cannot be
   * read at all.
   */
  attendedMs: number;
  /** Whether the user attended, and a rule said this was work. Nothing saying so means no — see `classifyCalls`. */
  countsAsWork: boolean;
};

/** What a call reads as: the window it was named from, or the process alone when it had no title. */
export const callLabel = (call: CallWindow) => call.title || call.appId;
