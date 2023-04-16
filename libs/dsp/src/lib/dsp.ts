import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { ColorScheme, DesignSystem, Pallet, PathsToProps } from './types';

const toDashCase = (str: string) => {
  return str.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`).replace(/\s+/g, '-');
};

const keysOf = <T extends object>(obj: T) => {
  return Object.keys(obj) as (keyof T)[];
};

const toRgb = (value: string) => {
  if (value.startsWith('#')) {
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);

    return `${r} ${g} ${b}`;
  } else if (value.startsWith('rgba')) {
    return value.replace('rgba', '').replace('(', '').replace(')', '').split(',').slice(0, 3).join(' ');
  } else if (value.startsWith('rgb')) {
    return value.replace('rgb', '').replace('(', '').replace(')', '');
  }

  throw new Error(`Could not convert ${value} to rgb`);
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
      const cssVariable = `${cssVarStart}-ref-color-${dashedPalletKey}`;
      cssVariables[cssVariable] = toRgb(palletOrColor); // this will be a hex color
      continue;
    }

    const colorKeys = keysOf(palletOrColor);

    for (const colorKey of colorKeys) {
      const shade = palletOrColor[colorKey];
      const cssVariable = `${cssVarStart}-ref-color-${dashedPalletKey}-${colorKey}`;
      cssVariables[cssVariable] = toRgb(shade);
    }
  }

  // Create the system variables
  const colorScheme = designSystem.sys.color;
  const colorSchemeKeys = keysOf(colorScheme);

  for (const colorSchemeKey of colorSchemeKeys) {
    const colorSchemeValue = colorScheme[colorSchemeKey];
    const dashedColorSchemeKey = toDashCase(colorSchemeKey);

    const cssVariable = `${cssVarStart}-sys-color-${dashedColorSchemeKey}`;

    // the colorSchemeValue is currently a string like neutral.50.
    // We need to replace it with the corresponding ref variable.
    const refVariablePath = colorSchemeValue
      .split('.')
      .map((v) => toDashCase(v))
      .join('-');

    const refVariable = `${cssVarStart}-ref-color-${refVariablePath}`;

    cssVariables[cssVariable] = `var(${refVariable})`;
  }

  return cssVariables;
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

export const generateTailwindConfig = (config: {
  designSystem: DesignSystem;
  cssVariables: Record<string, string>;
  includeFallbacks?: boolean;
}) => {
  const { cssVariables, includeFallbacks = true } = config;

  const tailwindConfig: {
    colors: Record<string, string>;
  } = {
    colors: {},
  };

  const cssKeys = keysOf(cssVariables);

  for (const cssKey of cssKeys) {
    if (cssKey.includes('color')) {
      const cssValue = cssVariables[cssKey];
      const tailwindKey = cssKey.replace(`--`, '');

      let twValue = '';

      if (cssValue.startsWith('var')) {
        const ref = cssValue.replace('var(', '').replace(')', '');
        const refValue = cssVariables[ref];

        const maybeFallback = includeFallbacks ? `, ${refValue}` : '';

        twValue = `rgb(${cssValue.replace(')', '')}${maybeFallback}) / <alpha-value>)`;
      } else {
        const maybeFallback = includeFallbacks ? `, ${cssValue}` : '';

        twValue = `rgb(var(${cssKey}${maybeFallback}) / <alpha-value>)`;
      }

      tailwindConfig.colors[tailwindKey] = twValue;
    }
  }

  return tailwindConfig;
};
