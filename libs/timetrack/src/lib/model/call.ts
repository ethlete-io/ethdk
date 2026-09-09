/** One stretch a process held the microphone, and what the rules made of it. */
export type CallWindow = {
  from: Date;
  to: Date;
  /** The process that held the microphone, raw. This is what a rule matched, and what a rule may match. */
  appId: string;
  /** The last window title that application had before the call opened. Empty when it had none. */
  title: string;
  /** Whether a rule said this was work. Nothing saying so means no — see `classifyCalls`. */
  countsAsWork: boolean;
};

/** What a call reads as: the window it was named from, or the process alone when it had no title. */
export const callLabel = (call: CallWindow) => call.title || call.appId;
