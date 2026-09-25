/** One stretch a process held the microphone, and what the rules made of it. */
export type CallWindow = {
  from: Date;
  to: Date;
  /** The process that held the microphone, raw. This is what a rule matched, and what a rule may match. */
  appId: string;
  /**
   * The title of the accepted meeting the call overlaps, else the window title it was named from — see
   * `titleAt`. Empty when neither exists. Rules match the window title, never the meeting's.
   */
  title: string;
  /**
   * How long the call's own application held the focus inside this window.
   *
   * It separates a call the user took part in from a voice room left open in the background — see
   * `classifyCalls`. It is 0 on a day whose window source reported nothing, where attendance cannot be
   * read at all.
   */
  attendedMs: number;
  /**
   * Whether the user attended, and a rule or an accepted meeting over it said this was work. Nothing
   * saying so means no, and a deny rule beats both — see `classifyCalls`.
   */
  countsAsWork: boolean;
  /**
   * Whether the user was in the room, which is presence whatever the work rules made of the call. A
   * meeting the day books nothing for is still a meeting somebody sat through — see `classifyCalls`.
   */
  isPresence: boolean;
};

/** What a call reads as: the window it was named from, or the process alone when it had no title. */
export const callLabel = (call: CallWindow) => call.title || call.appId;
