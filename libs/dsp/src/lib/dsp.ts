import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { ColorScheme, DesignSystem, Pallet, PathsToProps } from './types';

const toDashCase = (str: string) => {
  return str.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`).replace(/\s+/g, '-');
};

const keysOf = <T extends object>(obj: T) => {
  return Object.keys(obj) as (keyof T)[];
};

export const createDesignSystem = <P extends Pallet, SC extends PathsToProps<P>>(config: {
  name: string;
  ref: {
    palette: P;
  };
  sys: {
    color: {
      [key in keyof ColorScheme]: SC;
    };
  };
}) => {
  return config satisfies DesignSystem;
};

export const writeCssVariables = async (config: {
  designSystem: DesignSystem;
  output: string;
  cssVariables: Record<string, string>;
}) => {
  const { cssVariables, output, designSystem } = config;

  let lastVar = '';
  const cssVariableStrings = Object.entries(cssVariables).map(([key, value]) => {
    const cssVar = `  ${key}: ${value};`;
    const isSwitching = lastVar.includes('ref') && key.includes('sys');

    lastVar = key;

    // Put a new line between the ref and sys variables for readability
    if (isSwitching) {
      return `\n${cssVar}`;
    }

    return cssVar;
  });

  const classSelector = `.theme--${toDashCase(designSystem.name)}`;

  const css = `/** This file is auto-generated. Do not edit. */

:root, 
${classSelector} {
${cssVariableStrings.join('\n')}
}
`;

  try {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, css);
  } catch (error) {
    console.error(error);
  }
};

export const generateCssVariables = (config: { designSystem: DesignSystem }) => {
  const { designSystem } = config;
  const pallet = designSystem.ref.palette;
  const palletKeys = keysOf(pallet);

  const cssVariables: Record<string, string> = {};
  const cssVarStart = `--${toDashCase(designSystem.name)}`;

  // Create the reference variables
  for (const palletKey of palletKeys) {
    const palletOrColor = pallet[palletKey];
    const dashedPalletKey = toDashCase(palletKey);

    if (typeof palletOrColor === 'string') {
      const cssVariable = `${cssVarStart}-ref-${dashedPalletKey}`;
      cssVariables[cssVariable] = palletOrColor; // this will be a hex color
      continue;
    }

    const colorKeys = keysOf(palletOrColor);

    for (const colorKey of colorKeys) {
      const shade = palletOrColor[colorKey];
      const cssVariable = `${cssVarStart}-ref-${dashedPalletKey}-${colorKey}`;
      cssVariables[cssVariable] = shade;
    }
  }

  // Create the system variables
  const colorScheme = designSystem.sys.color;
  const colorSchemeKeys = keysOf(colorScheme);

  for (const colorSchemeKey of colorSchemeKeys) {
    const colorSchemeValue = colorScheme[colorSchemeKey];
    const dashedColorSchemeKey = toDashCase(colorSchemeKey);

    const cssVariable = `${cssVarStart}-sys-${dashedColorSchemeKey}`;

    // the colorSchemeValue is currently a string like neutral.50.
    // We need to replace it with the corresponding ref variable.
    const refVariablePath = colorSchemeValue
      .split('.')
      .map((v) => toDashCase(v))
      .join('-');

    const refVariable = `${cssVarStart}-ref-${refVariablePath}`;

    cssVariables[cssVariable] = `var(${refVariable})`;
  }

  return cssVariables;
};
