import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GROUPS = ['sdk', 'studio', 'timetrack'];

const APP_GROUP_PROJECTS = {
  studio: ['ethlete-studio'],
  timetrack: ['timetrack-app', 'timetrack', 'timetrack-e2e', 'timetrack-vscode'],
};

const DESIGN_TOOL_PROJECTS = ['design', 'cli'];

const FORCE = true;

const ROOT_SCRIPT_GROUPS = [
  { prefix: 'studio:', group: 'studio', projects: ['ethlete-studio'] },
  { prefix: 'timetrack:', group: 'timetrack', projects: ['timetrack-app'] },
];

const appsJobGroups = (job) => (job.startsWith('timetrack') ? ['timetrack'] : ['studio']);
const WORKFLOW_GROUPS = {
  'ci.yml': () => ['sdk'],
  'publish.yml': () => ['sdk'],
  'ci-apps.yml': appsJobGroups,
  'release-apps.yml': () => ['studio', 'timetrack'],
  'ci-groups.yml': () => GROUPS,
  'ci-repo.yml': () => GROUPS,
  'ci-pr.yml': () => GROUPS,
  'ci-next.yml': () => GROUPS,
  'ci-main.yml': () => GROUPS,
};
const HELPER = /tools\/scripts\/[\w.-]+/g;

// First match wins: the broad .github/actions rule must stay below the cef one.
const UNOWNED_RULES = [
  { pattern: /^(plans|\.changeset|\.claude\/handoffs)\//, groups: [] },
  { pattern: /^tools\/scripts\/ci-groups(\.spec)?\.mjs$/, groups: GROUPS, force: FORCE },
  { pattern: /^\.github\/workflows\/ci-(groups|repo|next|main|pr)\.yml$/, groups: GROUPS, force: FORCE },
  { pattern: /^\.github\/workflows\/(ci-apps|release-apps)\.yml$/, groups: ['studio', 'timetrack'], force: FORCE },
  { pattern: /^\.github\/workflows\/(ci|publish)\.yml$/, groups: ['sdk'], force: FORCE },
  { pattern: /^\.github\/actions\/cef\//, groups: ['studio', 'timetrack'], force: FORCE },
  { pattern: /^\.github\/actions\//, groups: GROUPS, force: FORCE },
  { pattern: /^(\.ethlete|tools\/studio-release-smoke)\//, groups: ['studio'], projects: ['ethlete-studio'] },
];

export const groupOf = (project) =>
  Object.entries(APP_GROUP_PROJECTS).find(([, projects]) => projects.includes(project))?.[0] ?? 'sdk';

const ownerOf = (file, roots) => {
  let owner;
  for (const [project, root] of Object.entries(roots)) {
    if (file.startsWith(`${root}/`) && (!owner || root.length > roots[owner].length)) owner = project;
  }
  return owner;
};

const dependencyClosure = (project, dependencies) => {
  const seen = new Set();
  const visit = (name) => {
    for (const dep of dependencies[name] ?? []) {
      if (!seen.has(dep)) {
        seen.add(dep);
        visit(dep);
      }
    }
  };
  visit(project);
  return seen;
};

/** Maps each tools/scripts file a CI workflow calls to the groups whose jobs call it. */
export const workflowHelperGroups = (workflows) => {
  const helpers = {};
  for (const [name, text] of Object.entries(workflows)) {
    const groupsOf = WORKFLOW_GROUPS[name];
    if (!groupsOf) continue;
    let job = '';
    let inJobs = false;
    for (const line of text.split('\n')) {
      if (/^jobs:\s*$/.test(line)) inJobs = true;
      else if (/^\S/.test(line)) inJobs = false;
      const jobKey = inJobs && /^ {2}([\w-]+):\s*$/.exec(line);
      if (jobKey) job = jobKey[1];
      for (const [helper] of line.matchAll(HELPER)) {
        helpers[helper] = [...new Set([...(helpers[helper] ?? []), ...groupsOf(job)])];
      }
    }
  }
  return helpers;
};

const changedKeys = (before = {}, after = {}) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );

/** The groups a root package.json change runs: script changes by name prefix, anything else the SDK group. */
export const rootManifestRule = (base, head) => {
  const otherFields = changedKeys({ ...base, scripts: null }, { ...head, scripts: null });
  if (!base || !head || otherFields.length) return { groups: ['sdk'] };
  const groups = new Set();
  const projects = new Set();
  for (const script of changedKeys(base.scripts, head.scripts)) {
    const match = ROOT_SCRIPT_GROUPS.find(({ prefix }) => script.startsWith(prefix));
    if (!match) groups.add('sdk');
    else {
      groups.add(match.group);
      for (const project of match.projects) projects.add(project);
    }
  }
  return { groups: groups.size ? [...groups] : ['sdk'], projects: [...projects] };
};

/** Every group runs in full when there is no green run to diff against. */
export const forcedGroups = ({ noBase, noPreviousBuild, force }) => (noBase || noPreviousBuild ? GROUPS : force);

export const selectGroups = ({
  changedFiles,
  affected,
  roots,
  dependencies,
  force = [],
  helperGroups = {},
  rootManifests,
}) => {
  const projects = Object.fromEntries(GROUPS.map((group) => [group, new Set()]));
  const run = Object.fromEntries(GROUPS.map((group) => [group, false]));
  const forced = new Set(force);
  const affectedSet = new Set(affected);

  for (const file of changedFiles) {
    if (ownerOf(file, roots)) continue;
    const rule = helperGroups[file]
      ? { groups: helperGroups[file], force: FORCE }
      : file === 'package.json' && rootManifests
        ? rootManifestRule(rootManifests.base, rootManifests.head)
        : UNOWNED_RULES.find(({ pattern }) => pattern.test(file));
    const groups = rule ? rule.groups : ['sdk'];
    for (const group of groups) {
      run[group] = true;
      if (rule?.force) forced.add(group);
    }
    for (const project of rule?.projects ?? []) projects[groupOf(project)].add(project);
  }

  const [designTool, designToolHost] = DESIGN_TOOL_PROJECTS;
  const owners = changedFiles.map((file) => ownerOf(file, roots));
  const designToolOnly =
    affectedSet.has(designTool) &&
    owners.includes(designTool) &&
    !owners.includes(designToolHost) &&
    !DESIGN_TOOL_PROJECTS.flatMap((project) => [...dependencyClosure(project, dependencies)]).some(
      (dep) => !DESIGN_TOOL_PROJECTS.includes(dep) && affectedSet.has(dep),
    );

  for (const project of affectedSet) {
    const group = designToolOnly && DESIGN_TOOL_PROJECTS.includes(project) ? 'studio' : groupOf(project);
    projects[group].add(project);
  }

  for (const group of forced) {
    run[group] = true;
    for (const project of Object.keys(roots)) {
      if (groupOf(project) === group) projects[group].add(project);
    }
  }

  return Object.fromEntries(
    GROUPS.map((group) => [
      group,
      { run: run[group] || projects[group].size > 0, projects: [...projects[group]].sort() },
    ]),
  );
};

export const githubOutput = (selection, base = '') =>
  [
    ...GROUPS.flatMap((group) => [
      `${group}=${selection[group].run}`,
      `${group}_projects=${selection[group].projects.join(',')}`,
    ]),
    `base=${base}`,
  ].join('\n') + '\n';

const NO_BASE = /^0*$/;

const gitSucceeds = (args, cwd) => {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** False when `base` is empty, missing from the clone, or not an ancestor of `head`. */
export const usableBase = (base, head, cwd = process.cwd()) =>
  !!base &&
  !NO_BASE.test(base) &&
  gitSucceeds(['cat-file', '-e', `${base}^{commit}`], cwd) &&
  gitSucceeds(['merge-base', '--is-ancestor', base, head], cwd);

const readManifest = (rev) => {
  try {
    return JSON.parse(execFileSync('git', ['show', `${rev}:package.json`], { encoding: 'utf8' }));
  } catch {
    return undefined;
  }
};

const readWorkflows = () => {
  const dir = '.github/workflows';
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name in WORKFLOW_GROUPS)
      .map((name) => [name, readFileSync(join(dir, name), 'utf8')]),
  );
};

const readWorkspace = (base, head) => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-groups-'));
  try {
    const graphFile = join(dir, 'graph.json');
    execFileSync('yarn', ['nx', 'graph', `--file=${graphFile}`], { stdio: ['ignore', 'ignore', 'inherit'] });
    const { graph } = JSON.parse(readFileSync(graphFile, 'utf8'));
    const roots = Object.fromEntries(Object.entries(graph.nodes).map(([name, node]) => [name, node.data.root]));
    const dependencies = Object.fromEntries(
      Object.entries(graph.dependencies).map(([name, deps]) => [
        name,
        deps.map((dep) => dep.target).filter((target) => target in roots),
      ]),
    );
    const helperGroups = workflowHelperGroups(readWorkflows());
    if (!usableBase(base, head)) {
      return { roots, dependencies, helperGroups, changedFiles: [], affected: [], noBase: true };
    }

    const changedFiles = execFileSync('git', ['diff', '--name-only', '--no-renames', base, head], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const affected = JSON.parse(
      execFileSync('yarn', ['nx', 'show', 'projects', '--affected', `--base=${base}`, `--head=${head}`, '--json'], {
        encoding: 'utf8',
      }),
    );
    const rootManifests = { base: readManifest(base), head: readManifest(head) };
    return { roots, dependencies, helperGroups, rootManifests, changedFiles, affected, noBase: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const parseArgs = (argv) => {
  const args = { base: '', head: 'HEAD', force: [], githubOutput: '', noPreviousBuild: false };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1] ?? '';
    if (argv[i] === '--base') args.base = value;
    else if (argv[i] === '--head') args.head = value;
    else if (argv[i] === '--force') args.force = value.split(',').filter(Boolean);
    else if (argv[i] === '--github-output') args.githubOutput = value;
    else if (argv[i] === '--no-previous-build') args.noPreviousBuild = value === 'true';
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  const unknown = args.force.filter((group) => group !== 'all' && !GROUPS.includes(group));
  if (unknown.length) throw new Error(`unknown group ${unknown.join(', ')}`);
  if (args.force.includes('all')) args.force = GROUPS;
  return args;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const workspace = readWorkspace(args.base, args.head);
  const force = forcedGroups({ ...workspace, noPreviousBuild: args.noPreviousBuild, force: args.force });
  const selection = selectGroups({ ...workspace, force });
  const verifiedBase = workspace.noBase || args.noPreviousBuild ? '' : args.base;
  if (!verifiedBase) console.log(`No verified base to diff from (base '${args.base}'): every group runs.`);
  for (const group of GROUPS) {
    const { run, projects } = selection[group];
    console.log(`${group}: ${run ? `runs (${projects.join(', ') || 'repo checks only'})` : 'skipped'}`);
  }
  if (args.githubOutput) appendFileSync(args.githubOutput, githubOutput(selection, verifiedBase));
}
