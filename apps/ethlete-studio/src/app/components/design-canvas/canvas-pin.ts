/** A numbered marker on a frame. Without a point it sits on the frame's top right corner. */
export type CanvasPin = {
  id: string;
  frameId: string;
  label: string;
  text: string;
  /** Marks the pin with an accent dot. */
  dot?: boolean;
  /** CSS pixels from the frame's top left corner. */
  point?: { x: number; y: number };
};

/** A point on a frame the user clicked in pointing mode, in CSS pixels from its top left corner; `null` for the whole state. */
export type FramePoint = { frameId: string; point: { x: number; y: number } | null };

/** An accent rectangle over a frame, in CSS pixels from its top left corner. */
export type FrameOutline = { frameId: string; x: number; y: number; width: number; height: number };
