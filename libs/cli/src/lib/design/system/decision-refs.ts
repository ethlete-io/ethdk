import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const REF = /ADR (\d{4})|Impl Q\d+|finding \d+/gu;

const adrExists = (target: string, number: string) => {
  const apps = join(target, 'apps');

  if (!existsSync(apps)) return false;

  return readdirSync(apps).some((app) => {
    const dir = join(apps, app, 'docs', 'adr');

    return existsSync(dir) && readdirSync(dir).some((file) => file.startsWith(`${number}-`));
  });
};

/** The decision refs in `text` an agent may act on: `ADR nnnn` naming an existing ADR file, `Impl Qn`, `finding n`. */
export const decisionRefsOf = (options: { target: string; text: string }) =>
  [...options.text.matchAll(REF)]
    .filter((match) => match[1] === undefined || adrExists(options.target, match[1]))
    .map((match) => match[0]);
