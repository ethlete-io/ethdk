import { DesignSystem, generateCssVariables, writeCssVariables } from '@ethlete/dsp';
import jitiFactory from 'jiti';
import path from 'path';
import { transform } from 'sucrase';

function assertIsDesignSystem(designSystem: unknown): asserts designSystem is DesignSystem {
  if (
    !designSystem ||
    typeof designSystem !== 'object' ||
    (typeof designSystem === 'object' &&
      (!('name' in designSystem) || !('ref' in designSystem) || !('sys' in designSystem)))
  ) {
    console.error('No design system found or invalid design system');
    process.exit(1);
  }
}

export const dsp = async (args: string[]) => {
  const inputIndex = args.findIndex((arg) => arg.includes('--input') || arg.includes('-i'));
  const input = args[inputIndex + 1];

  if (!input) {
    console.error('No input file specified. Use -i or --input');
    process.exit(1);
  }

  const outputIndex = args.findIndex((arg) => arg.includes('--output') || arg.includes('-o'));

  const output = args[outputIndex + 1];

  if (!output) {
    console.error('No output file specified. Use -o or --output');
    process.exit(1);
  }

  const filePath = path.join(process.cwd(), input);

  const jiti = jitiFactory(__filename, {
    interopDefault: true,
    transform: (opts) => {
      return transform(opts.source, {
        transforms: ['typescript', 'imports'],
      });
    },
  });

  const designSystem = jiti(filePath);

  assertIsDesignSystem(designSystem);

  const cssVariables = generateCssVariables({
    designSystem,
  });

  try {
    await writeCssVariables({
      designSystem,
      cssVariables,
      output,
    });

    console.log(`Design system written to file at ${output}. Have a nice day! 😘`);
  } catch (error) {
    console.error(error);
  }
};
