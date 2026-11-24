import { FrameSize, frameSizeKey } from '../studio-view/remembered';

export type ShotSizeKind = 'frame' | 'picture';

const prefixOf = (kind: ShotSizeKind) => `sketch-${kind} `;

/**
 * The sizes of a sketch's shots by shot key: each one `live` reports, over the one stored for that shot from an earlier
 * visit, so a reopened sketch draws its cells at their last size before a frame or picture loaded. `stored` holds the
 * remembered sizes of the sketch's camera, keyed by frame id.
 */
export const shotSizesOf = ({
  stored,
  kind,
  live,
}: {
  stored: Record<string, FrameSize>;
  kind: ShotSizeKind;
  live: Record<string, FrameSize>;
}): Record<string, FrameSize> => {
  const prefix = prefixOf(kind);
  const remembered = Object.fromEntries(
    Object.entries(stored)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, size]) => [key.slice(prefix.length), size]),
  );

  return {
    ...remembered,
    ...Object.fromEntries(Object.entries(live).map(([shot, size]) => [shot, { ...remembered[shot], ...size }])),
  };
};

/** The remembered sizes with every size of `live` stored under the sketch's camera `cameraKey`. */
export const storedShotSizesWith = ({
  stored,
  cameraKey,
  kind,
  live,
}: {
  stored: Record<string, FrameSize>;
  cameraKey: string;
  kind: ShotSizeKind;
  live: Record<string, FrameSize>;
}): Record<string, FrameSize> => ({
  ...stored,
  ...Object.fromEntries(
    Object.entries(live).map(([shot, size]) => {
      const key = frameSizeKey(cameraKey, prefixOf(kind) + shot);

      return [key, { ...stored[key], ...size }];
    }),
  ),
});
