export type Theme = 'primary' | 'accent';

export interface ThemeConfig {
  themes: Theme[];
  defaultTheme: Theme;
}
