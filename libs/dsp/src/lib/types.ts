export interface ColorPallet {
  0: string;
  10: string;
  20: string;
  30: string;
  40: string;
  50: string;
  60: string;
  70: string;
  80: string;
  90: string;
  95: string;
  99: string;
  100: string;
}

export interface Pallet {
  black: string;
  white: string;
  primary: ColorPallet;
  secondary: ColorPallet;
  tertiary: ColorPallet;
  error: ColorPallet;
  neutral: ColorPallet;
  neutralVariant: ColorPallet;
}

export interface ColorScheme {
  surfaceTint: string;
  onErrorContainer: string;
  onError: string;
  errorContainer: string;
  onTertiaryContainer: string;
  onTertiary: string;
  tertiaryContainer: string;
  tertiary: string;
  shadow: string;
  error: string;
  outline: string;
  onBackground: string;
  background: string;
  inverseOnSurface: string;
  inverseSurface: string;
  onSurfaceVariant: string;
  onSurface: string;
  surfaceVariant: string;
  surface: string;
  onSecondaryContainer: string;
  onSecondary: string;
  secondaryContainer: string;
  secondary: string;
  inversePrimary: string;
  onPrimaryContainer: string;
  onPrimary: string;
  primaryContainer: string;
  primary: string;
}

export interface DesignSystem {
  name: string;
  ref: {
    palette: Pallet;
  };
  sys: {
    color: ColorScheme;
  };
}

export type PathsToProps<T, V = string | number> = T extends V
  ? ''
  : {
      [K in Extract<keyof T, string | number>]: Dot<K, PathsToProps<T[K], V>>;
    }[Extract<keyof T, string | number>];

export type Dot<T extends string | number, U extends string | number> = '' extends U ? T : `${T}.${U}`;
