import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { groupOf } from './ci-groups.mjs';

const SDK_PROJECTS = ['cli', 'agent-rules'];
const MAX_OUTPUT = 16 * 1024 * 1024;
const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'sdk-decouple-probe', version: '1.0.0' },
  },
};

export const appProjectsFrom = (nodes) =>
  Object.entries(nodes)
    .filter(([name]) => ['studio', 'timetrack'].includes(groupOf(name)))
    .map(([name, { data }]) => ({ name, root: data.root }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

export const probeSteps = () => [
  { name: 'yarn install', command: 'yarn', args: ['install'] },
  ...['build', 'test', 'lint'].map((target) => ({
    name: `nx ${target} cli agent-rules`,
    command: 'yarn',
    args: [
      'nx',
      'run-many',
      '-t',
      target,
      '-p',
      ...SDK_PROJECTS,
      '--skip-nx-cache',
      '--output-style=static',
      ...(target === 'test' ? ['--run'] : []),
    ],
  })),
  ...SDK_PROJECTS.map((project) => ({
    name: `npm pack --dry-run ${project}`,
    command: 'npm',
    args: ['pack', '--dry-run', '--json'],
    directory: `dist/libs/${project}`,
    quiet: true,
  })),
  {
    name: 'design mcp initialize',
    command: process.execPath,
    args: ['dist/libs/cli/src/index.js', 'design', 'mcp'],
    input: JSON.stringify(INITIALIZE) + '\n',
    timeout: 15_000,
  },
];

export const initializedServer = (output) => {
  for (const line of output.split('\n')) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }

    const result = message?.result;
    if (
      message?.jsonrpc === '2.0' &&
      message.id === INITIALIZE.id &&
      !('error' in message) &&
      typeof result?.protocolVersion === 'string' &&
      result.capabilities &&
      typeof result.capabilities === 'object' &&
      typeof result.serverInfo?.name === 'string' &&
      typeof result.serverInfo.version === 'string'
    ) {
      return result.serverInfo;
    }
  }
  return undefined;
};

const relativePath = (path) => path.replace(/^\.\//, '').replace(/\/$/, '');
const withinRoot = (path, root) => path === root || path.startsWith(root + '/');
const pathsIn = (text) => text.split(/[\s"'=;&|(),]+/).map(relativePath);

export const staleManifestEntries = (manifest, output, deletedRoots, scratch) => {
  const missingPaths = output
    .split('\n')
    .filter((line) => /ENOENT|Cannot find module|No such file or directory|Workspace not found/i.test(line))
    .flatMap(pathsIn)
    .map((path) => (path.startsWith(scratch + '/') ? relative(scratch, path) : path))
    .filter((path) => deletedRoots.some((root) => withinRoot(path, root)));

  return {
    workspaces: (manifest.workspaces ?? []).filter((workspace) =>
      deletedRoots.some(
        (root) => relativePath(workspace) === root && missingPaths.some((path) => withinRoot(path, root)),
      ),
    ),
    scripts: Object.entries(manifest.scripts ?? {})
      .filter(([, script]) => pathsIn(script).some((path) => missingPaths.includes(path)))
      .map(([name]) => name),
  };
};

const runCommand = ({ command, args, input, timeout }, cwd, env) =>
  spawnSync(command, args, {
    cwd,
    env,
    input,
    timeout,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
  });

const runStep = (step, cwd, env, retry) => {
  console.log(`sdk-decouple-probe: ${step.name}`);
  const result = runCommand(step, cwd, env);
  if (result.stdout && (!step.quiet || result.status !== 0)) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0 && !result.error) return result.stdout;
  if (retry?.(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)) return runStep(step, cwd, env);
  throw new Error(`${step.name} failed (${result.error?.message ?? result.signal ?? `exit ${result.status}`})`);
};

const copyWorkingTree = (repo, scratch, env) => {
  const files = runStep(
    {
      name: 'copy working tree',
      command: 'git',
      args: ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--deduplicate'],
      quiet: true,
    },
    repo,
    env,
  );
  for (const file of new Set(files.split('\0').filter((name) => name && !name.endsWith('/')))) {
    const from = join(repo, file);
    const stat = lstatSync(from, { throwIfNoEntry: false });
    if (!stat || stat.isDirectory()) continue;
    const to = join(scratch, file);
    mkdirSync(dirname(to), { recursive: true });
    if (stat.isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else copyFileSync(from, to);
  }
};

const removeAppProjects = (scratch, nodes) => {
  const root = realpathSync(scratch);
  const projects = appProjectsFrom(nodes).map((project) => {
    const directory = realpathSync(resolve(root, project.root));
    const rel = relative(root, directory);
    if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) {
      throw new Error(`delete app projects: invalid root for ${project.name}: ${project.root}`);
    }
    return { ...project, directory };
  });
  for (const project of projects) {
    console.log(`sdk-decouple-probe: delete ${project.name} (${project.root})`);
    rmSync(project.directory, { recursive: true, force: true });
  }
  return projects.map((project) => project.root);
};

const dropStaleManifestEntries = (scratch, deletedRoots, output) => {
  const file = join(scratch, 'package.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const { workspaces, scripts } = staleManifestEntries(manifest, output, deletedRoots, scratch);
  if (!workspaces.length && !scripts.length) return false;

  for (const workspace of workspaces) {
    console.log(`sdk-decouple-probe: drop scratch package.json workspace ${workspace}`);
  }
  if (workspaces.length)
    manifest.workspaces = manifest.workspaces.filter((workspace) => !workspaces.includes(workspace));
  for (const script of scripts) {
    console.log(`sdk-decouple-probe: drop scratch package.json script ${script}`);
    delete manifest.scripts[script];
  }
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  return true;
};

const runChecks = (scratch, env, deletedRoots) => {
  const [install, build, ...checks] = probeSteps();
  const run = (step) =>
    runStep(step, join(scratch, step.directory ?? ''), env, (failure) =>
      dropStaleManifestEntries(scratch, deletedRoots, failure),
    );

  run(install);
  run(build);
  const failures = [];
  for (const step of checks) {
    try {
      const output = run(step);
      if (step.input) {
        const server = initializedServer(output);
        if (!server) throw new Error(`${step.name} failed (no valid initialize response)`);
        console.log(`sdk-decouple-probe: initialized ${server.name} ${server.version}`);
      }
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
};

const runProbe = (repo) => {
  const temp = mkdtempSync(join(tmpdir(), 'sdk-decouple-probe-'));
  try {
    const scratch = join(temp, 'checkout');
    const graphFile = join(temp, 'graph.json');
    const env = {
      ...process.env,
      NX_NO_CLOUD: 'true',
      NX_DAEMON: 'false',
      NX_WORKSPACE_DATA_DIRECTORY: join(temp, 'graph-data'),
      NX_CACHE_DIRECTORY: join(temp, 'nx-cache'),
      YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
    };

    runStep(
      { name: 'read Nx project graph', command: 'yarn', args: ['nx', 'graph', `--file=${graphFile}`] },
      repo,
      env,
    );
    const { graph } = JSON.parse(readFileSync(graphFile, 'utf8'));
    copyWorkingTree(repo, scratch, env);
    const deletedRoots = removeAppProjects(scratch, graph.nodes);
    env.NX_WORKSPACE_DATA_DIRECTORY = join(temp, 'probe-data');

    runChecks(scratch, env, deletedRoots);
    console.log('sdk-decouple-probe: passed');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    runProbe(resolve(import.meta.dirname, '../..'));
  } catch (error) {
    console.error(`sdk-decouple-probe: ${error.message}`);
    process.exitCode = 1;
  }
}
