#!/usr/bin/env node
/**
 * Release smoke gate: builds the unreleased SDK into real consumer apps, runs each app's production build
 * against it, then serves that build and loads its pages in headless Chromium.
 *
 * Fails on a build error, a page error, a console error, a request storm (more than `--storm` identical
 * requests within `--window` ms, the endless-loop class) or a main thread that stops answering.
 * The app's installed `node_modules/@ethlete/*` are moved aside and restored afterwards, also on failure
 * and Ctrl-C; a backup left by a killed run is restored on the next start.
 *
 * Usage:
 *   node tools/release-smoke/smoke.mjs [<app>...] [--skip-sdk-build] [--storm=10] [--window=5000] [--watch=10000]
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sdkRoot = resolve(here, '../..');
const config = JSON.parse(readFileSync(join(here, 'config.json'), 'utf8'));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? Number(match.split('=')[1]) : fallback;
};
const skipSdkBuild = args.includes('--skip-sdk-build');
const stormLimit = flag('storm', 10);
const stormWindowMs = flag('window', 5000);
const watchMs = flag('watch', 10000);
const selected = args.filter((arg) => !arg.startsWith('--'));
const apps = selected.length ? selected : Object.keys(config);

const unknown = apps.filter((name) => !(name in config));
if (unknown.length) {
  console.error(`Unknown app(s): ${unknown.join(', ')}. Configured: ${Object.keys(config).join(', ')}`);
  process.exit(1);
}

const BACKUP_DIR = '.release-smoke-backup';
const appRoot = (name) => resolve(sdkRoot, config[name].root);
const scopeDir = (name) => join(appRoot(name), 'node_modules/@ethlete');
const backupDir = (name) => join(appRoot(name), 'node_modules', BACKUP_DIR);

const restore = (name) => {
  const backup = backupDir(name);
  if (!existsSync(backup)) return;
  for (const lib of readdirSync(backup)) {
    const target = join(scopeDir(name), lib);
    rmSync(target, { recursive: true, force: true });
    renameSync(join(backup, lib), target);
  }
  const marker = join(backup, '..', `${BACKUP_DIR}.copied`);
  if (existsSync(marker)) {
    for (const lib of JSON.parse(readFileSync(marker, 'utf8')))
      rmSync(join(scopeDir(name), lib), { recursive: true, force: true });
    rmSync(marker);
  }
  rmSync(backup, { recursive: true, force: true });
  console.log(`  restored ${name}: node_modules/@ethlete/*`);
};

const restoreAll = () => {
  for (const name of apps) restore(name);
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(signal, () => {
    console.error(`\n${signal}: restoring node_modules before exit`);
    restoreAll();
    process.exit(130);
  });
process.on('exit', restoreAll);

const run = (command, commandArgs, options) =>
  new Promise((resolvePromise) => {
    console.log(`  $ ${command} ${commandArgs.join(' ')}`);
    const child = spawn(command, commandArgs, { stdio: 'inherit', ...options });
    child.on('exit', (code) => resolvePromise(code ?? 1));
    child.on('error', () => resolvePromise(1));
  });

const swapIn = (name) => {
  const scope = scopeDir(name);
  const backup = backupDir(name);
  mkdirSync(backup, { recursive: true });
  const added = config[name].libs.filter((lib) => !existsSync(join(scope, lib)));
  writeFileSync(join(backup, '..', `${BACKUP_DIR}.copied`), JSON.stringify(added));
  for (const lib of config[name].libs) {
    const installed = join(scope, lib);
    if (!added.includes(lib)) renameSync(installed, join(backup, lib));
    cpSync(join(sdkRoot, 'dist/libs', lib), installed, { recursive: true });
  }
};

const replacePlaceholders = (dir, placeholders, origin) => {
  const files = globSync('**/*.{js,mjs,html}', { cwd: dir }).map((file) => join(dir, file));
  for (const file of files) {
    let content = readFileSync(file, 'utf8');
    let changed = false;
    for (const [key, value] of Object.entries(placeholders)) {
      if (!content.includes(key)) continue;
      content = content.replaceAll(key, value.replaceAll('{origin}', origin));
      changed = true;
    }
    if (changed) writeFileSync(file, content);
  }
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const loadProxies = (name) => {
  const file = config[name].proxyConfig;
  if (!file) return [];
  const entries = JSON.parse(readFileSync(join(appRoot(name), file), 'utf8'));
  return Object.entries(entries).map(([prefix, entry]) => ({ prefix, ...entry }));
};

const proxyRequest = (req, res, proxy) => {
  let path = req.url;
  for (const [pattern, replacement] of Object.entries(proxy.pathRewrite ?? {}))
    path = path.replace(new RegExp(pattern), replacement);
  const target = new URL(proxy.target);
  const headers = { ...req.headers };
  if (proxy.changeOrigin) headers.host = target.host;
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const upstream = send(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: req.method,
      path: `${target.pathname.replace(/\/$/, '')}${path}`,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.setTimeout(15000, () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
};

const serve = (dir, proxies) =>
  new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const proxy = proxies.find((entry) => req.url.startsWith(entry.prefix));
      if (proxy) return proxyRequest(req, res, proxy);

      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = normalize(join(dir, pathname));
      if (!file.startsWith(dir + sep) || !existsSync(file) || statSync(file).isDirectory()) {
        if (extname(pathname)) {
          res.writeHead(404);
          return res.end();
        }
        file = join(dir, 'index.html');
      }
      res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolvePromise(server));
  });

const describeConsoleMessage = async (message) => {
  const parts = await Promise.all(
    message.args().map((arg) =>
      arg
        .evaluate((value) => {
          if (value instanceof Error) return `${value.name}: ${value.message}`;
          if (value && typeof value === 'object') {
            try {
              return value.message ?? JSON.stringify(value).slice(0, 300);
            } catch {
              return String(value);
            }
          }
          return String(value);
        })
        .catch(() => ''),
    ),
  );
  return parts.join(' ').trim() || message.text();
};

const smokePage = async (browser, url, appConfig) => {
  const failures = [];
  const notes = [];
  const ignored = (appConfig.ignoreConsole ?? []).map((pattern) => new RegExp(pattern));
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('pageerror', (error) => failures.push(`page error: ${error.message}`));
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    consoleErrors.push(
      describeConsoleMessage(message).then((text) => {
        if (ignored.some((pattern) => pattern.test(text))) notes.push(`ignored console error: ${text}`);
        else failures.push(`console error: ${text}`);
      }),
    );
  });

  const seen = new Map();
  const storms = new Map();
  let requestCount = 0;
  page.on('request', (request) => {
    requestCount++;
    const key = `${request.method()} ${request.url()}`;
    const now = Date.now();
    const recent = (seen.get(key) ?? []).filter((time) => now - time < stormWindowMs);
    recent.push(now);
    seen.set(key, recent);
    if (recent.length > stormLimit) storms.set(key, Math.max(storms.get(key) ?? 0, recent.length));
  });
  page.on('response', (response) => {
    if (response.status() >= 400) notes.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (appConfig.readySelector) await page.waitForSelector(appConfig.readySelector, { timeout: 30000 });
    await page.waitForTimeout(watchMs);
    const responsive = await Promise.race([
      page.evaluate(() => true),
      new Promise((resolveTimeout) => setTimeout(() => resolveTimeout(false), 5000)),
    ]);
    if (!responsive) failures.push('main thread did not answer within 5s');
  } catch (error) {
    failures.push(`load failed: ${error.message.split('\n')[0]}`);
  }

  for (const [key, count] of storms)
    failures.push(`request storm: ${count}x ${key} within ${stormWindowMs}ms (limit ${stormLimit})`);

  await Promise.all(consoleErrors);
  await context.close();
  return { failures, notes: [...new Set(notes)], requestCount };
};

const smokeApp = async (name) => {
  const appConfig = config[name];
  const root = appRoot(name);
  const result = { name, failures: [], notes: [] };
  const output = mkdtempSync(join(tmpdir(), `release-smoke-${name}-`));

  console.log(`\n${name}: swapping the SDK build into ${root}/node_modules/@ethlete`);
  swapIn(name);
  let buildCode;
  try {
    buildCode = await run(
      'npx',
      [
        'nx',
        'run',
        `${appConfig.project}:build${appConfig.configuration ? `:${appConfig.configuration}` : ''}`,
        `--output-path=${output}`,
        '--skip-nx-cache',
      ],
      { cwd: root, env: { ...process.env, CI: 'true', NX_DAEMON: 'false', NX_NO_CLOUD: 'true', NX_TUI: 'false' } },
    );
  } finally {
    restore(name);
  }
  if (buildCode !== 0) {
    result.failures.push(`production build exited with ${buildCode}`);
    rmSync(output, { recursive: true, force: true });
    return result;
  }

  const index = globSync('**/index.html', { cwd: output }).sort((a, b) => a.length - b.length)[0];
  if (!index) {
    result.failures.push(`no index.html in the build output ${output}`);
    return result;
  }
  const browserDir = join(output, dirname(index));
  const server = await serve(browserDir, loadProxies(name));
  const origin = `http://127.0.0.1:${server.address().port}`;
  replacePlaceholders(browserDir, appConfig.placeholders ?? {}, origin);

  const browser = await chromium.launch();
  try {
    for (const path of appConfig.paths ?? ['/']) {
      console.log(`  loading ${origin}${path} (watching ${watchMs}ms)`);
      const page = await smokePage(browser, `${origin}${path}`, appConfig);
      result.failures.push(...page.failures.map((failure) => `${path}: ${failure}`));
      result.notes.push(`${path}: ${page.requestCount} requests`, ...page.notes.map((note) => `${path}: ${note}`));
    }
  } finally {
    await browser.close();
    server.close();
    rmSync(output, { recursive: true, force: true });
  }
  return result;
};

restoreAll();

const libs = [...new Set(apps.flatMap((name) => config[name].libs))];
if (!skipSdkBuild) {
  console.log(`Building the SDK: ${libs.join(', ')}`);
  const code = await run('npx', ['nx', 'run-many', '-t', 'build', '-p', libs.join(',')], {
    cwd: sdkRoot,
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_TUI: 'false' },
  });
  if (code !== 0) {
    console.error('\n✖ release smoke: the SDK build failed');
    process.exit(1);
  }
}
const missingDist = libs.filter((lib) => !existsSync(join(sdkRoot, 'dist/libs', lib, 'package.json')));
if (missingDist.length) {
  console.error(`✖ release smoke: no build output for ${missingDist.join(', ')} in dist/libs`);
  process.exit(1);
}

const results = [];
for (const name of apps) results.push(await smokeApp(name));

console.log('\nRelease smoke summary');
for (const { name, failures, notes } of results) {
  console.log(`${failures.length ? '✖' : '✔'} ${name}`);
  for (const note of notes) console.log(`    ${note}`);
  for (const failure of failures) console.error(`  ✖ ${failure}`);
}
const failed = results.filter((result) => result.failures.length);
console.log(
  failed.length ? `\nFAIL: ${failed.length} of ${results.length} app(s)` : `\nPASS: ${results.length} app(s)`,
);
process.exit(failed.length ? 1 : 0);
