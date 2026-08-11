import { execFileSync } from 'child_process';
import { loadConfig } from './config';
import { BranchParseResult, GitFlowConfig, GitFlowRule, parseBranch, stripRefPrefix, validateBranch } from './git-flow';

const git = (options: { root: string; args: string[] }) =>
  execFileSync('git', options.args, { cwd: options.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const currentBranch = (root: string) => git({ root, args: ['rev-parse', '--abbrev-ref', 'HEAD'] });

const allBranches = (root: string) => {
  const refs = git({ root, args: ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'] });
  const names = refs
    .split('\n')
    .filter((ref) => ref && !ref.endsWith('/HEAD'))
    .map(stripRefPrefix);

  return [...new Set(names)].sort();
};

const describeParse = (parse: BranchParseResult) => {
  const lines = [`  kind      ${parse.kind}${parse.deprecated ? ' (deprecated spelling)' : ''}`];

  if (parse.type) lines.push(`  type      ${parse.type}`);
  if (parse.storyKey)
    lines.push(`  story     ${parse.storyKey}${parse.inheritedFrom ? ` (from ${parse.inheritedFrom})` : ''}`);
  if (parse.taskKey) lines.push(`  task      ${parse.taskKey}`);
  if (parse.subject) lines.push(`  subject   ${parse.subject}`);
  if (parse.parent) lines.push(`  parent    ${parse.parent}`);
  if (parse.expectedBase) lines.push(`  base      ${parse.expectedBase}`);

  lines.push(`  merges to ${parse.expectedMrTargets.join(' or ') || '—'}`);

  if (parse.suggestedName) lines.push(`  rename to ${parse.suggestedName}`);

  return lines;
};

const checkOne = (options: { root: string; config: GitFlowConfig; branch: string; target?: string; push: boolean }) => {
  const { config, branch, target, push } = options;
  const report = validateBranch({ branch, target, push, config });

  console.log(`Branch: ${report.branch}${report.target ? ` → ${report.target}` : ''}`);

  if (report.ok) {
    console.log(`  ok     ${report.parse.kind}`);

    return 0;
  }

  for (const finding of report.findings) {
    console.log(`  ${finding.severity === 'error' ? 'error ' : 'warn  '} ${finding.rule}   ${finding.message}`);
  }

  if (report.blocked) {
    console.error('\nBlocked by the finding(s) above.');

    return 1;
  }

  console.log(
    `\nAdvisory only — nothing is blocked. Run \`ethlete-agents git-flow explain ${report.branch}\` for the full parse.`,
  );

  return 0;
};

const checkAll = (options: { root: string; config: GitFlowConfig }) => {
  const { root, config } = options;
  const branches = allBranches(root);
  const counts = new Map<GitFlowRule, number>();
  const offenders: string[] = [];
  let conforming = 0;
  let counted = 0;
  let deprecated = 0;

  for (const branch of branches) {
    const parse = parseBranch({ branch, config });

    for (const finding of parse.findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);

    if (parse.kind === 'protected') continue;

    if (parse.deprecated) {
      deprecated++;
      continue;
    }

    counted++;

    if (parse.ok) conforming++;
    else offenders.push(`  ${branch}${parse.suggestedName ? ` → ${parse.suggestedName}` : ''}`);
  }

  const ratio = counted === 0 ? 100 : Math.round((conforming / counted) * 100);

  console.log(
    `${conforming}/${counted} branches conform (${ratio}%), ${deprecated} deprecated, ${branches.length} scanned.`,
  );

  if (counts.size > 0) {
    console.log('\nFindings');
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([rule, count]) => console.log(`  ${String(count).padStart(4)}  ${rule}`));
  }

  if (offenders.length > 0) {
    console.log('\nNon-conforming');
    offenders.forEach((line) => console.log(line));
  }

  return 0;
};

const FLAGS_WITH_VALUE = ['--target', '--root'];

const positionalArgs = (args: string[]) =>
  args.filter((entry, index) => !entry.startsWith('--') && !FLAGS_WITH_VALUE.includes(args[index - 1] ?? ''));

const USAGE = `ethlete-agents git-flow — check branch names against the repo's git flow

  git-flow check [ref]     Validate a branch name (default: the current branch)
  git-flow check --all     Adoption report over every local and remote branch
  git-flow explain [ref]   Print what the parser saw

Options
  --target <branch>   Also validate the merge request target
  --push              Also report a direct push to a protected branch
`;

export const gitFlowCommand = (options: { root: string; argv: string[] }) => {
  const { root, argv } = options;
  const [subcommand, ...rest] = argv;
  const config = loadConfig({ root }).gitFlow;
  const targetIndex = rest.indexOf('--target');
  const target = targetIndex === -1 ? undefined : rest[targetIndex + 1];
  const ref = positionalArgs(rest)[0];

  if (subcommand === 'check') {
    if (rest.includes('--all')) return checkAll({ root, config });

    return checkOne({ root, config, branch: ref ?? currentBranch(root), target, push: rest.includes('--push') });
  }

  if (subcommand === 'explain') {
    const branch = ref ?? currentBranch(root);
    const parse = parseBranch({ branch, config });

    console.log(`Branch: ${parse.branch}`);
    describeParse(parse).forEach((line) => console.log(line));

    if (parse.findings.length > 0) {
      console.log('\nFindings');
      parse.findings.forEach((finding) => console.log(`  ${finding.rule}   ${finding.message}`));
    }

    console.log(`\nEnforcement: ${config.enforcement}`);

    return 0;
  }

  console.log(USAGE);

  return subcommand === undefined || subcommand === '--help' || subcommand === '-h' ? 0 : 1;
};
