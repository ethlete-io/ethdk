const DAY = 24 * 60 * 60;

export const etimeSeconds = (etime) => {
  const [days, clock] = etime.includes('-') ? etime.split('-') : ['0', etime];
  const [seconds = 0, minutes = 0, hours = 0] = clock.split(':').map(Number).reverse();

  return Number(days) * DAY + hours * 3600 + minutes * 60 + seconds;
};

export const staleDesignServers = (psOutput, { root, minSeconds = 3600 }) =>
  psOutput
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\S+)\s+(.*)$/.exec(line))
    .filter((match) => match && /index\.js design\b/.test(match[3]))
    .filter((match) => match[3].includes(`${root}/`))
    .map((match) => ({ pid: Number(match[1]), age: match[2], seconds: etimeSeconds(match[2]), command: match[3] }))
    .filter((server) => server.seconds > minSeconds);

export const staleServerWarnings = (servers) =>
  servers.map(
    (server) => `push-suite: warning: design server pid ${server.pid} has run for ${server.age} (not killed)`,
  );
