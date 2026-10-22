const svg = (config: { width: number; height: number; label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">` +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      `<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="24" text-anchor="middle" ` +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

export const WIDE_SRC = svg({ width: 800, height: 400, label: 'wide', fill: '#00ffa1' });
export const FALLBACK_SRC = svg({ width: 600, height: 300, label: 'fallback 600x300', fill: '#00d0ff' });
