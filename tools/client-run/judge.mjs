import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { frameFindingsOf, probeFrame } from './frame-probe.mjs';
import { decodePng, differenceOf, inkOf } from './png.mjs';
import { leftRefusalsOf, readTranscript } from './transcript.mjs';
import { treeFindingsOf } from './tree-check.mjs';

const EMPTY_INK = 0.004;
const SAME = 0;
const MAX_SHOTS = 150;
const SHOT_TIMEOUT_MS = 240_000;
const FRAME_HEIGHT = 800;
const PAGE_MARGIN = 40;

const progress = (line) => console.error(`client-run judge: ${line}`);

const freePort = () =>
  new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });

const startServer = async (target, log) => {
  const port = await freePort();
  const child = spawn('node', ['node_modules/@ethlete/cli/src/index.js', 'design'], {
    cwd: target,
    env: { ...process.env, DE_PORT: String(port) },
    stdio: ['ignore', log, log],
  });
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`the design server exited ${child.exitCode}`);
    for (const base of [`http://127.0.0.1:${port}`, `http://[::1]:${port}`]) {
      const answer = await fetch(`${base}/__design/queue`).catch(() => null);
      if (answer?.ok) return { base, stop: () => child.kill('SIGTERM') };
    }
    await new Promise((done) => setTimeout(done, 1000));
  }
  child.kill('SIGTERM');
  throw new Error('the design server did not answer within 180 s');
};

const json = async (url) => (await fetch(url, { signal: AbortSignal.timeout(SHOT_TIMEOUT_MS) })).json();

const statesOf = async (base, query) => {
  const answer = await fetch(`${base}/__design/shot?${new URLSearchParams(query)}`, {
    signal: AbortSignal.timeout(SHOT_TIMEOUT_MS),
  });
  const text = await answer.text();
  const listed = /state=<one of: ([^>]*)>/.exec(text);
  return listed ? listed[1].split(', ') : { problem: text.trim().slice(0, 200) };
};

/** Opens the frame a shot of `view` draws, at the width the shot came out, and probes what it shows. */
const probeView = async ({ base, browser, view, width }) => {
  const page = await browser.newPage({ viewport: { width: width + PAGE_MARGIN, height: FRAME_HEIGHT } });
  try {
    const { product, part, state, sketch, variant } = view;
    const search = new URLSearchParams({ product, part, state, ...(sketch ? { sketch, variant } : {}) });
    return await probeFrame({ page, url: `${base}/frame.html?${search}`, width });
  } finally {
    await page.close();
  }
};

/** What Studio shows for a run: the product parts and the sketch variants, each state as a picture. */
const collectShots = async ({ base, shotsDir, browser }) => {
  const products = await json(`${base}/__design/system`);
  const shots = [];
  const views = [];
  const allSketches = [];
  for (const product of products) {
    for (const part of product.parts.filter((p) => p.origin !== 'base'))
      for (const state of part.states) views.push({ product: product.name, part: `${part.layer}/${part.name}`, state });
    const { sketches } = await json(`${base}/__design/sketches?product=${encodeURIComponent(product.name)}`);
    for (const sketch of sketches) {
      allSketches.push(sketch);
      shots.push({ kind: 'sketch', product: product.name, sketch });
      for (const part of sketch.targetParts ?? [sketch.target])
        for (const variant of sketch.variants) {
          const query = { product: product.name, part, sketch: sketch.target, variant };
          const states = await statesOf(base, query);
          progress(
            `states ${part} ${sketch.target}/${variant}: ${Array.isArray(states) ? states.length : states.problem}`,
          );
          if (!Array.isArray(states)) shots.push({ ...query, state: null, problem: states.problem });
          else for (const state of states) views.push({ ...query, state });
        }
    }
  }
  for (const view of views.slice(0, MAX_SHOTS)) {
    const query = { ...view, priority: 'low' };
    const answer = await fetch(`${base}/__design/shot?${new URLSearchParams(query)}`, {
      signal: AbortSignal.timeout(SHOT_TIMEOUT_MS),
    }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) }));
    if (!answer.ok) {
      shots.push({ ...view, problem: `${answer.status} ${(await answer.text()).trim().slice(0, 200)}` });
      continue;
    }
    const png = Buffer.from(await answer.arrayBuffer());
    const file = join(
      shotsDir,
      `${[view.sketch, view.variant, view.part, view.state]
        .filter(Boolean)
        .join('_')
        .replace(/[^\w.-]+/g, '-')}.png`,
    );
    writeFileSync(file, png);
    progress(`shot ${file.split('/').pop()}`);
    const picture = decodePng(png);
    const frame = await probeView({ base, browser, view, width: picture.width }).catch((error) => ({
      error: String(error).slice(0, 200),
    }));
    shots.push({ ...view, file, note: answer.headers.get('x-et-note'), picture, frame });
  }
  return { shots, sketches: allSketches, skipped: Math.max(views.length - MAX_SHOTS, 0) };
};

const where = (shot) =>
  `${shot.part}${shot.variant ? ` Variante ${shot.variant}` : ''}${shot.state ? `, Zustand ${shot.state}` : ''}`;

/** The findings a human would notice in Studio, from the collected shots and the agent's transcript. */
export const findingsOf = ({ shots, refusals, result, tree = [] }) => {
  const findings = [];
  const add = (seen, cause, file) => findings.push({ seen, cause, file });
  for (const { seen, cause } of tree) add(seen, cause);
  for (const shot of shots) {
    if (shot.kind === 'sketch') {
      const { sketch } = shot;
      if (sketch.status !== 'ready')
        add(
          `Sketch ${sketch.target} steht in Studio auf „${sketch.status}“, nicht zur Wahl bereit.`,
          sketch.readyRefusal
            ? `Ready verweigert: ${JSON.stringify(sketch.readyRefusal).slice(0, 160)}`
            : 'Agent hat `sketch ready` nicht erreicht.',
        );
      continue;
    }
    if (shot.problem) add(`${where(shot)}: Zelle zeigt „Zeichnen fehlgeschlagen“.`, shot.problem);
    else if (shot.note) add(`${where(shot)}: Bild leer oder beschnitten.`, shot.note, shot.file);
    else if (inkOf(shot.picture) < EMPTY_INK)
      add(
        `${where(shot)}: Zelle ist leer (eine Fläche, kein Inhalt).`,
        'Zustand zeichnet nichts Sichtbares.',
        shot.file,
      );
    if (shot.frame?.error) add(`${where(shot)}: Rahmen nicht prüfbar.`, shot.frame.error);
    else if (shot.frame)
      for (const { seen, cause } of frameFindingsOf(shot.frame)) add(`${where(shot)}: ${seen}`, cause, shot.file);
  }
  const drawn = shots.filter((shot) => shot.picture);
  const groups = Map.groupBy(drawn, (shot) => `${shot.sketch ?? ''}|${shot.part}`);
  for (const group of groups.values()) {
    const variants = [...new Set(group.map((shot) => shot.variant))].filter(Boolean);
    for (let i = 0; i < variants.length; i++)
      for (let j = i + 1; j < variants.length; j++) {
        const pairs = group
          .filter((shot) => shot.variant === variants[i])
          .map((one) => [one, group.find((two) => two.variant === variants[j] && two.state === one.state)])
          .filter(([, two]) => two);
        if (pairs.length && pairs.every(([one, two]) => differenceOf(one.picture, two.picture) <= SAME))
          add(
            `${group[0].part}: Varianten ${variants[i]} und ${variants[j]} sehen gleich aus.`,
            'Variante ändert nichts Sichtbares.',
            pairs[0][0].file,
          );
      }
    for (const variant of variants.length ? variants : [undefined]) {
      const states = group.filter((shot) => shot.variant === variant);
      const seen = new Set();
      for (const one of states) {
        if (seen.has(one)) continue;
        const same = states.filter(
          (two) => two !== one && !seen.has(two) && differenceOf(one.picture, two.picture) <= SAME,
        );
        if (!same.length) continue;
        for (const shot of same) seen.add(shot);
        add(
          `${where({ ...one, state: null })}: Zustände ${[one, ...same].map((shot) => shot.state).join(', ')} sehen gleich aus.`,
          'Zustand zeichnet keinen sichtbaren Unterschied.',
          one.file,
        );
      }
    }
  }
  for (const call of refusals)
    add(
      `Agent ließ eine Ablehnung offen: \`design ${call.key}\`.`,
      (call.output ?? '')
        .split('\n')
        .find((line) => line.trim() && !/^Exit code/.test(line))
        ?.trim()
        .slice(0, 200) ?? '',
    );
  if (!result) add('Agent endete ohne Abschlussnachricht.', 'Lauf abgebrochen oder Zeitlimit.');
  return findings;
};

const markdownOf = ({ runDir, findings, skipped, result }) =>
  [
    `# Kunden-Vorlauf ${runDir.split('/').pop()}`,
    '',
    `Lauf: \`${runDir}\`. ${findings.length} Befunde${skipped ? `, ${skipped} Bilder nicht geprüft (Grenze ${MAX_SHOTS})` : ''}.`,
    '',
    ...findings.map(
      (f) => `- ${f.seen} Verdacht: ${f.cause}${f.file ? ` (\`${f.file.split('/').slice(-2).join('/')}\`)` : ''}`,
    ),
    '',
    '## Schlussnachricht des Agenten',
    '',
    (result?.text ?? '(keine)').trim(),
    '',
  ].join('\n');

/** Starts a design server of its own on the run's copy, judges what Studio would show, and writes `findings.md`. */
export const judgeRun = async ({ runDir, target, sdk, expected = { sketches: [] } }) => {
  const shotsDir = join(runDir, 'shots');
  mkdirSync(shotsDir, { recursive: true });
  const transcriptFile = join(runDir, 'transcript.jsonl');
  const transcript = existsSync(transcriptFile)
    ? readTranscript(readFileSync(transcriptFile, 'utf8'))
    : { calls: [], result: null };
  // The record names a pid of the agent's sandbox; a server started on the copy would stop that pid on the host.
  rmSync(join(target, 'tmp/design-resident/process.json'), { force: true });
  if (sdk) {
    rmSync(join(target, 'node_modules/@ethlete/cli'), { recursive: true, force: true });
    cpSync(join(sdk, 'dist/libs/cli'), join(target, 'node_modules/@ethlete/cli'), { recursive: true });
  }
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const server = await startServer(target, openSync(join(runDir, 'judge-server.log'), 'w')).catch(async (error) => {
    await browser.close();
    throw error;
  });
  try {
    const { shots, sketches, skipped } = await collectShots({ base: server.base, shotsDir, browser });
    writeFileSync(
      join(runDir, 'shots.json'),
      JSON.stringify(shots, (key, value) => (key === 'picture' ? undefined : value), 1),
    );
    const findings = findingsOf({
      shots,
      refusals: leftRefusalsOf(transcript),
      result: transcript.result,
      tree: treeFindingsOf({ expected, sketches }),
    });
    const markdown = markdownOf({ runDir, findings, skipped, result: transcript.result });
    writeFileSync(join(runDir, 'findings.md'), markdown);
    console.log(markdown);
    return findings;
  } finally {
    await browser.close();
    server.stop();
  }
};
