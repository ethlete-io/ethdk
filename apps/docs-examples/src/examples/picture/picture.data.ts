const svg = (config: { width: number; height: number; label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">` +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      `<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="24" text-anchor="middle" ` +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

export const PICTURE_WIDE_SRC = svg({ width: 800, height: 450, label: 'wide 16:9', fill: '#00ffa1' });
export const PICTURE_TALL_SRC = svg({ width: 450, height: 600, label: 'tall 3:4', fill: '#00d0ff' });
export const PICTURE_FALLBACK_SRC = svg({ width: 800, height: 450, label: 'fallback', fill: '#ffd000' });

export const PICTURE_BROKEN_SRC = 'data:image/png;base64,this-is-not-an-image';
