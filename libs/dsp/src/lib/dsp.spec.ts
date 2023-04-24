import { createDesignSystem, generateCssVariables, generateTailwindConfig, writeCssVariables } from './dsp';

describe('dsp', () => {
  const designSystem = createDesignSystem({
    name: 'et',
    ref: {
      palette: {
        black: '#000000',
        white: '#ffffff',
        primary: {
          0: '#000000',
          10: '#21005d',
          20: '#381e72',
          30: '#4f378b',
          40: '#6750a4',
          50: '#7f67be',
          60: '#9a82db',
          70: '#b69df8',
          80: '#d0bcff',
          90: '#eaddff',
          95: '#f6edff',
          99: '#fffbfe',
          100: '#ffffff',
        },
        secondary: {
          0: '#000000',
          10: '#1d192b',
          20: '#888888',
          30: '#4a4458',
          40: '#625b71',
          50: '#7a7289',
          60: '#958da5',
          70: '#b0a7c0',
          80: '#ccc2dc',
          90: '#e8def8',
          95: '#f6edff',
          99: '#fffbfe',
          100: '#ffffff',
        },
        tertiary: {
          0: '#000000',
          10: '#31111d',
          20: '#492532',
          30: '#633b48',
          40: '#7d5260',
          50: '#986977',
          60: '#b58392',
          70: '#d29dac',
          80: '#efb8c8',
          90: '#ffd8e4',
          95: '#ffecf1',
          99: '#fffbfa',
          100: '#ffffff',
        },
        error: {
          0: '#000000',
          10: '#410e0b',
          20: '#601410',
          30: '#8c1d18',
          40: '#b3261e',
          50: '#dc362e',
          60: '#e46962',
          70: '#ec928e',
          80: '#f2b8b5',
          90: '#f9dedc',
          95: '#fceeee',
          99: '#fffbf9',
          100: '#ffffff',
        },
        neutral: {
          0: '#000000',
          10: '#1c1b1f',
          20: '#313033',
          30: '#484649',
          40: '#605d62',
          50: '#787579',
          60: '#939094',
          70: '#aeaaae',
          80: '#c9c5ca',
          90: '#e6e1e5',
          95: '#f4eff4',
          99: '#fffbfe',
          100: '#ffffff',
        },
        neutralVariant: {
          0: '#000000',
          10: '#1d1a22',

          20: '#322f37',
          30: '#49454f',
          40: '#605d66',
          50: '#79747e',
          60: '#938f99',
          70: '#aea9b4',
          80: '#cac4d0',
          90: '#e7e0ec',
          95: '#f5eefa',
          99: '#fffbfe',
          100: '#ffffff',
        },
      },
    },
    sys: {
      color: {
        surfaceTint: 'primary.40',
        onErrorContainer: 'error.10',
        onError: 'error.100',
        errorContainer: 'error.90',
        onTertiaryContainer: 'tertiary.10',
        onTertiary: 'tertiary.100',
        tertiaryContainer: 'tertiary.90',
        tertiary: 'tertiary.40',
        shadow: 'neutral.0',
        error: 'error.40',
        outline: 'neutralVariant.50',
        onBackground: 'neutral.10',
        background: 'neutral.99',
        inverseOnSurface: 'neutral.95',
        inverseSurface: 'neutral.20',
        onSurfaceVariant: 'neutralVariant.30',
        onSurface: 'neutral.10',
        surfaceVariant: 'neutralVariant.90',
        surface: 'neutral.99',
        onSecondaryContainer: 'secondary.10',
        onSecondary: 'secondary.100',
        secondaryContainer: 'secondary.90',
        secondary: 'secondary.40',
        inversePrimary: 'primary.80',
        onPrimaryContainer: 'primary.10',
        onPrimary: 'primary.100',
        primaryContainer: 'primary.90',
        primary: 'primary.40',
      },
    },
  });

  it('should create a design system', () => {
    expect(designSystem).toBeTruthy();
  });

  it('should create a object containing css vars based on a design system ', () => {
    const cssVars = generateCssVariables({ designSystem });

    expect(cssVars).toBeTruthy();
  });

  it('should write a design system to a css file', () => {
    const cssVars = generateCssVariables({ designSystem });

    writeCssVariables({
      cssVariables: cssVars,
      output: './apps/playground/src/design-system.css',
      designSystem,
    });
  });

  it('should create a tailwind config', () => {
    const cssVars = generateCssVariables({ designSystem });
    const tailwindConfig = generateTailwindConfig({ designSystem, cssVariables: cssVars });

    expect(tailwindConfig).toBeTruthy();
  });
});
