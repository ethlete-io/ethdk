import config from '@design-config';
import studioLogo from '@studio-design/assets/studio-app-icon.svg';

const LOGO_DATA: Record<string, string> = {
  '.ethlete/design/studio/assets/studio-app-icon.svg': studioLogo,
  'apps/timetrack/src-tauri/icons/128x128.png': '/@assets/timetrack/128x128.png',
};

export const railLogos = (products: string[]): Record<string, string> =>
  Object.fromEntries(
    products.flatMap((name) => {
      const logo = (config.products as Record<string, { logo?: string }>)[name]?.logo;
      const file = logo ? LOGO_DATA[logo] : undefined;

      return file ? [[name, file]] : [];
    }),
  );
