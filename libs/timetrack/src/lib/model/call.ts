/** Nobody sat in the room, a deny rule matched it, or no rule and no accepted meeting said it was work. */
export type CallExclusion = 'unattended' | 'deny-rule' | 'no-rule';

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
  /** Why `countsAsWork` is false. Absent on a call that counts. */
  excludedBy?: CallExclusion;
  /**
   * Whether the user was in the room, which is presence whatever the work rules made of the call. A
   * meeting the day books nothing for is still a meeting somebody sat through — see `classifyCalls`.
   */
  isPresence: boolean;
};

/** What a call reads as: the window it was named from, or the process alone when it had no title. */
export const callLabel = (call: CallWindow) => call.title || call.appId;

const REVERSE_DOMAIN = /^[a-z]{2,4}\.[^.]+\.[^.]+/;

const titleCased = (name: string) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** What an application is called for a person to read: `com.slack.Slack` reads as `Slack`. */
export const appDisplayNameOf = (appId: string) => {
  if (!REVERSE_DOMAIN.test(appId)) return titleCased(appId);

  const segments = appId.split('.').slice(1);

  return titleCased(segments.find((segment) => /^[A-Z]/.test(segment)) ?? segments[0] ?? appId);
};

const EXCLUSION_REASON: Record<CallExclusion, string> = {
  'no-rule': 'no rule counts it as work',
  'deny-rule': 'a rule excludes it',
  unattended: 'never in front',
};

/** Why a call is not counted, short enough for a band: `Slack, no rule counts it as work`. */
export const callExclusionReasonOf = (call: Pick<CallWindow, 'appId' | 'excludedBy'>) =>
  call.excludedBy ? `${appDisplayNameOf(call.appId)}, ${EXCLUSION_REASON[call.excludedBy]}` : undefined;

/** The `countsAsWork` pattern that matches this application id and nothing looser. */
export const countsAsWorkPatternOf = (appId: string) => appId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
