export const LOCAL_MAX_WORKERS = 2;

export const workerCountOf = ({ args, env, cores }) => {
  const asked = Number(args.includes('--workers') ? args[args.indexOf('--workers') + 1] : env['STUDIO_E2E_WORKERS']);

  if (asked >= 1) return Math.floor(asked);

  const byCores = Math.max(1, Math.min(8, Math.floor(cores / 4)));

  return env['CI'] ? byCores : Math.min(LOCAL_MAX_WORKERS, byCores);
};
