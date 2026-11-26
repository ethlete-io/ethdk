import { AutoStandInDecision } from './auto-stand-in';

export type LoggedStandInDecision = AutoStandInDecision & { at: number };

const keyOf = (decision: AutoStandInDecision) =>
  [decision.repoPath, decision.branch, decision.workPath, decision.appId].map((part) => part ?? '').join('\u0000');

/** Holds the latest stand-in verdict per context and day, so a row that stays unnamed can be explained later. */
export const createStandInVerdictLog = () => {
  const days = new Map<string, Map<string, LoggedStandInDecision>>();

  return {
    record: (options: { day: string; at: number; decisions: readonly AutoStandInDecision[] }) => {
      const held = days.get(options.day) ?? new Map<string, LoggedStandInDecision>();

      for (const decision of options.decisions) held.set(keyOf(decision), { ...decision, at: options.at });

      days.set(options.day, held);
    },
    read: (day: string): LoggedStandInDecision[] => [...(days.get(day)?.values() ?? [])],
  };
};

export type StandInVerdictLog = ReturnType<typeof createStandInVerdictLog>;
