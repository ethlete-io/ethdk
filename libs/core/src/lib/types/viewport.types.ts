export type Vec2 = [number, number];

export interface ViewportConfig {
  breakpoints: {
    xs: Vec2;
    sm: Vec2;
    md: Vec2;
    lg: Vec2;
    xl: Vec2;
    '2xl': Vec2;
  };
}

export type Breakpoint = keyof ViewportConfig['breakpoints'];
