import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { dirname, resolve } from 'path';
import { CACHE_DIR } from './design-config';

export const STUDIO_LIST_WIDTH_PATH = '/__design/list-width';

/** The gitignored file in which the design server keeps the width Studio last measured for its sketch list. */
export const studioListWidthPathOf = (target: string) => resolve(target, CACHE_DIR, 'studio-list-width.json');

const widthOf = (value: unknown) => {
  const width = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['width'] : undefined;

  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? Math.round(width) : null;
};

const parsedOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** The sketch list width Studio last posted to the design server of `target`, or null when it never did. */
export const studioListWidthOf = (target: string) => {
  const path = studioListWidthPathOf(target);

  return existsSync(path) ? widthOf(parsedOf(readFileSync(path, 'utf8'))) : null;
};

/** Answers `POST /__design/list-width` with a JSON body `{ width }`, sent as text/plain, by saving the width. */
export const studioListWidthMiddleware = (target: string) => (request: IncomingMessage, response: ServerResponse) => {
  response.setHeader('access-control-allow-origin', '*');

  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.end();

    return;
  }

  const chunks: Buffer[] = [];

  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => {
    const width = widthOf(parsedOf(Buffer.concat(chunks).toString('utf8')));

    if (width !== null) {
      const path = studioListWidthPathOf(target);

      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify({ width })}\n`);
    }

    response.statusCode = width === null ? 400 : 204;
    response.end();
  });
};
