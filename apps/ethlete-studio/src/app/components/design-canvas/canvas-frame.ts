export type CanvasFrame = {
  id: string;
  src: string;
  width: number;
  height?: number;
  label: string;
  row?: string;
  screenshot?: string;
  error?: string;
};

export type FrameMessage = { type: 'height'; height: number } | { type: 'escape' };

/** Reads a message the frame page posts to its parent. A cross-origin frame reaches the canvas only this way. */
export const frameMessageOf = (data: unknown): FrameMessage | null => {
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  if (data.type === 'design-explore:escape') return { type: 'escape' };
  if (data.type === 'design-explore:height' && 'height' in data && typeof data.height === 'number')
    return { type: 'height', height: data.height };

  return null;
};
