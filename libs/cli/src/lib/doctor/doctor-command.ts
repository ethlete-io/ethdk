import { composeToolNames, composeBinary, resolveComposeTool } from '../api/compose';
import { loadApiDefinitions } from '../api/load-definitions';
import { resolveApiCheckout } from '../api/resolve-checkout';
import { diagnoseLocalConfig } from '../config/diagnose';

const indent = (text: string) => text.replace(/\n/g, '\n    ');

const describeComposeTool = () => {
  const tool = resolveComposeTool();

  return tool
    ? { line: `container engine: ${composeBinary(tool.compose).join(' ')}`, problems: [] }
    : { line: undefined, problems: [`No compose tool found. Tried: ${composeToolNames().join(', ')}.`] };
};

const describeApis = (root: string) => {
  const { found, apis, fileName } = loadApiDefinitions(root);

  if (!found) return { lines: [], problems: [] };

  const lines: string[] = [];
  const problems: string[] = [];

  for (const [name, api] of Object.entries(apis)) {
    const checkout = resolveApiCheckout({ root, name, api });

    if (checkout.ok) {
      lines.push(`${fileName}: ${name} → ${checkout.checkout.composePath}`);
    } else {
      problems.push(checkout.problem);
    }
  }

  return { lines, problems };
};

/** Reports every problem with this machine's setup, so `et api` does not have to find them one at a time. */
export const doctorCommand = ({ root }: { root: string }) => {
  const configProblems = diagnoseLocalConfig({ root });
  const compose = describeComposeTool();
  const apis = describeApis(root);

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
