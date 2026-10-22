export const BANNER_EXAMPLES = {
  'banner/banner-error': () => import('./banner-error.example').then((m) => m.BannerErrorExampleComponent),
  'banner/banner-info': () => import('./banner-info.example').then((m) => m.BannerInfoExampleComponent),
  'banner/banner-warning': () => import('./banner-warning.example').then((m) => m.BannerWarningExampleComponent),
};
