import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GROUPS = ['sdk', 'studio', 'timetrack'];

const APP_GROUP_PROJECTS = {
  studio: ['ethlete-studio'],
  timetrack: ['timetrack-app', 'timetrack', 'timetrack-e2e', 'timetrack-vscode'],
};

const DESIGN_TOOL = 'libs/cli/src/lib/design/';
const DESIGN_TOOL_PROJECT = 'cli';

const FORCE = true;

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

export const selectGroups = ({ changedFiles, affected, roots, dependencies, force = [] }) => {
  const projects = Object.fromEntries(GROUPS.map((group) => [group, new Set()]));
  const run = Object.fromEntries(GROUPS.map((group) => [group, false]));
  const forced = new Set(force);
  const affectedSet = new Set(affected);

  for (const file of changedFiles) {
    if (ownerOf(file, roots)) continue;
    const rule = UNOWNED_RULES.find(({ pattern }) => pattern.test(file));
    const groups = rule ? rule.groups : ['sdk'];
    for (const group of groups) {
      run[group] = true;
      if (rule?.force) forced.add(group);
    }
    for (const project of rule?.projects ?? []) projects[groupOf(project)].add(project);
  }

  const designToolFiles = changedFiles.filter((file) => ownerOf(file, roots) === DESIGN_TOOL_PROJECT);
  const designToolOnly =
    affectedSet.has(DESIGN_TOOL_PROJECT) &&
    designToolFiles.length > 0 &&
    designToolFiles.every((file) => file.startsWith(DESIGN_TOOL)) &&
    ![...dependencyClosure(DESIGN_TOOL_PROJECT, dependencies)].some((dep) => affectedSet.has(dep));

  for (const project of affectedSet) {
    const group = designToolOnly && project === DESIGN_TOOL_PROJECT ? 'studio' : groupOf(project);
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

export const githubOutput = (selection) =>
  GROUPS.flatMap((group) => [
    `${group}=${selection[group].run}`,
    `${group}_projects=${selection[group].projects.join(',')}`,
  ]).join('\n') + '\n';

const NO_BASE = /^0*$/;

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
    if (!base || NO_BASE.test(base)) return { roots, dependencies, changedFiles: [], affected: [], noBase: true };

    const changedFiles = execFileSync('git', ['diff', '--name-only', '--no-renames', base, head], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const affected = JSON.parse(
      execFileSync('yarn', ['nx', 'show', 'projects', '--affected', `--base=${base}`, `--head=${head}`, '--json'], {
        encoding: 'utf8',
      }),
    );
    return { roots, dependencies, changedFiles, affected, noBase: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const parseArgs = (argv) => {
  const args = { base: '', head: 'HEAD', force: [], githubOutput: '' };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1] ?? '';
    if (argv[i] === '--base') args.base = value;
    else if (argv[i] === '--head') args.head = value;
    else if (argv[i] === '--force') args.force = value.split(',').filter(Boolean);
    else if (argv[i] === '--github-output') args.githubOutput = value;
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
  const selection = selectGroups({ ...workspace, force: workspace.noBase ? GROUPS : args.force });
  for (const group of GROUPS) {
    const { run, projects } = selection[group];
    console.log(`${group}: ${run ? `runs (${projects.join(', ') || 'repo checks only'})` : 'skipped'}`);
  }
  if (args.githubOutput) appendFileSync(args.githubOutput, githubOutput(selection));
}
