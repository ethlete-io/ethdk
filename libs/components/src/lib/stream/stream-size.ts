export const streamSizeAttribute = (value: string | number) =>
  typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value;

const DEFAULT_STREAM_ASPECT_RATIO = 16 / 9;

export const resolveStreamAspectRatio = (ratio: number | undefined) =>
  ratio !== undefined && Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_STREAM_ASPECT_RATIO;
