export const startedByStudio = (env: NodeJS.ProcessEnv = process.env) =>
  env['ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE'] === '1';
