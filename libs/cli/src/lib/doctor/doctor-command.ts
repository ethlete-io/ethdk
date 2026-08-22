import { ComposeTool, composeToolNames, composeBinary, resolveComposeTool } from '../api/compose';
import { join } from 'path';
import { API_DEFINITIONS_FILE_NAMES, loadApiDefinitions } from '../api/load-definitions';
import { checkoutProblem, resolveApiCheckout } from '../api/resolve-checkout';
import { diagnoseLocalConfig } from '../config/diagnose';
import { LEGACY_LOCAL_CONFIG_FILE_NAME, LOCAL_CONFIG_FILE_NAME, readLocalConfigFile } from '../config/local-config';

const indent = (text: string) => text.replace(/\n/g, '\n    ');

const describeComposeTool = (composeTools?: ComposeTool[]) => {
  const tool = resolveComposeTool(composeTools);

  return tool
    ? { line: `container engine: ${composeBinary(tool.compose).join(' ')}`, problems: [] }
    : { line: undefined, problems: [`No compose tool found. Tried: ${composeToolNames(composeTools).join(', ')}.`] };
};

const describeApis = (root: string, apiInvocation: string) => {
  const { found, apis, fileName } = loadApiDefinitions(root);

  if (!found) return { lines: [], problems: [] };

  const lines: string[] = [];
  const problems: string[] = [];

  for (const [name, api] of Object.entries(apis)) {
    const checkout = resolveApiCheckout({ root, name, api });

    if (checkout.ok) {
      lines.push(`${fileName}: ${name} → ${checkout.checkout.composePath}`);
    } else {
      problems.push(checkoutProblem({ failure: checkout, name, invocation: apiInvocation }));
    }
  }

  return { lines, problems };
};

/** Reports every problem with this machine's setup, so `et api` does not have to find them one at a time. */
export const doctorCommand = ({
  root,
  apiInvocation = 'et api',
  composeTools,
}: {
  root: string;
  apiInvocation?: string;
  composeTools?: ComposeTool[];
}) => {
  // A file that exists but cannot be parsed still has to be reported, so this asks whether the file
  // is there rather than whether it could be read.
  const hasConfig = [LOCAL_CONFIG_FILE_NAME, LEGACY_LOCAL_CONFIG_FILE_NAME].some(
    (fileName) => readLocalConfigFile(join(root, fileName)).status !== 'absent',
  );
  const hasApis = loadApiDefinitions(root).found;

  if (!hasConfig && !hasApis) {
    console.log(`Nothing to check: ${root} has no ${LOCAL_CONFIG_FILE_NAME} and no ${API_DEFINITIONS_FILE_NAMES[0]}.`);

    return 0;
  }

  const configProblems = diagnoseLocalConfig({ root });
  const compose = describeComposeTool(composeTools);
  const apis = describeApis(root, apiInvocation);

  const problems = [...configProblems, ...compose.problems, ...apis.problems];

  for (const line of [compose.line, ...apis.lines].filter(Boolean)) {
    console.log(`  ${line}`);
  }

  if (problems.length === 0) {
    console.log('\nNo problems found.');

    return 0;
  }

  console.error(`\n${problems.length} problem(s):\n`);

  for (const problem of problems) {
    console.error(`  - ${indent(problem)}`);
  }

  return 1;
};
