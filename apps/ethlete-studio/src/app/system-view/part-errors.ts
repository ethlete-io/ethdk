import { BuildReadyStatus } from '../design-parts/system-page/build-ready-footer.component';

/** The messages of every load failure a part reports: its LOAD problems and the errors of its sketch targets. */
export const partErrorsOf = ({
  problems = [],
  targets = [],
}: {
  problems?: { rule: string; message: string }[];
  targets?: { variant: string; error?: string }[];
}) => [
  ...problems.filter((problem) => problem.rule === 'LOAD').map((problem) => problem.message),
  ...targets.flatMap((target) => (target.error ? [target.error] : [])),
];

/** Blocks the pick: a part with a reported error is never build-ready, whichever view shows it. */
export const gatedByPartErrors = (status: BuildReadyStatus, errors: string[]): BuildReadyStatus => {
  if (errors.length === 0) return status;

  const own = errors.map((text) => ({ kind: 'sdk-error' as const, text }));

  return {
    ...status,
    state: 'blocked',
    blockers: [...own, ...(status.state === 'blocked' ? status.blockers : [])],
  } as BuildReadyStatus;
};
