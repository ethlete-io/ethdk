import { IncomingMessage, ServerResponse } from 'http';
import { MOTION_MODES, MotionMode, MotionPictures } from './motion-shot';
import { PartAddress } from './shot';
import { MOTION_PATH } from './studio-api';
import { SketchVariant, SystemModules } from './system/system-modules';
import { send, sendShot, ThumbMissingError } from './thumb';

export type DeclaredMotion = { from: string; to: string; at?: number[] };

export type MotionDraw = PartAddress & {
  motion: string;
  at?: readonly number[];
  mode: MotionMode;
  params: URLSearchParams;
};

/** The JSON `GET /__design/motion` answers: one mode of a motion, its tracks and a URL per keyframe image. */
export type MotionAnswer = {
  product: string;
  part: string;
  motion: string;
  from: string;
  to: string;
  mode: MotionMode;
  preset: string | null;
  width: number | null;
  end: number;
  tracks: unknown[];
  keyframes: { ms: number; src: string }[];
};

type MotionSource = {
  system: SystemModules;
  motionOf: (draw: MotionDraw) => Promise<MotionPictures>;
  declaredOf: (address: {
    product: string;
    part: string;
    sketch: SketchVariant | null;
  }) => Promise<Record<string, DeclaredMotion>>;
};

export class MotionRequestError extends Error {
  constructor() {
    super(
      'design-explore: pass product, part, motion, and optionally sketch and variant, mode (full|reduced), preset or width, and frame=<ms>',
    );
  }
}

const askedOf = (params: URLSearchParams) => {
  const product = params.get('product');
  const part = params.get('part');
  const motion = params.get('motion');
  const sketch = params.get('sketch');
  const variant = params.get('variant');
  const preset = params.get('preset');
  const width = params.get('width');
  const mode = params.get('mode');
  const frame = params.get('frame');
  const pixels = width === null ? null : Number(width);
  const ms = frame === null ? null : Number(frame);

  if (
    !product ||
    !part ||
    !motion ||
    (mode !== null && !(MOTION_MODES as readonly string[]).includes(mode)) ||
    (pixels !== null && !(Number.isInteger(pixels) && pixels > 0)) ||
    (preset && pixels !== null) ||
    (ms !== null && !Number.isFinite(ms))
  )
    return null;

  return {
    product,
    part,
    motion,
    sketch: sketch && variant ? { target: sketch, variant } : null,
    preset,
    width: pixels,
    mode: (mode ?? 'full') as MotionMode,
    ms,
  };
};

/**
 * Draws one mode of a motion through `motionOf` and answers its JSON. A page without a preset or width draws at the
 * first product preset, as `et design motion shots` does.
 */
export const motionAnswerOf = async (options: MotionSource & { url: URL }) => {
  const { system, url } = options;
  const asked = askedOf(url.searchParams);

  if (!asked) throw new MotionRequestError();

  const { product, part, motion, sketch, mode } = asked;
  const motions = await options.declaredOf({ product, part, sketch });
  const declared = motions[motion];

  if (!declared) {
    throw new ThumbMissingError(
      `design-explore: ${part} has no motion "${motion}" (motions: ${Object.keys(motions).join(', ') || 'none'})`,
    );
  }

  const presets = system.productOf(product)?.presets ?? {};
  const preset =
    asked.preset ?? (part.startsWith('pages/') && asked.width === null ? (Object.keys(presets)[0] ?? null) : null);
  const width = preset ? null : asked.width;
  const pictures = await options.motionOf({
    product,
    part,
    state: declared.from,
    preset,
    width,
    sketch,
    interaction: null,
    motion,
    at: declared.at,
    mode,
    params: url.searchParams,
  });
  const srcOf = (ms: number) => {
    const params = new URLSearchParams(url.searchParams);

    params.set('frame', String(ms));

    return `${MOTION_PATH}?${params}`;
  };
  const answer: MotionAnswer = {
    product,
    part,
    motion,
    from: declared.from,
    to: declared.to,
    mode,
    preset,
    width,
    end: pictures.end,
    tracks: pictures.tracks,
    keyframes: pictures.keyframes.map(({ ms }) => ({ ms, src: srcOf(ms) })),
  };

  return { answer, pictures, ms: asked.ms };
};

/**
 * `GET /__design/motion?product=&part=&motion=` answers a {@link MotionAnswer}; with `&frame=<ms>` it answers the PNG of
 * that keyframe. Takes `sketch`+`variant`, `mode`, `preset` or `width`, `scale`, `surface` and `color` like the shot.
 */
export const motionMiddleware = (source: MotionSource) => (request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url ?? '', 'http://localhost');
  const answered = motionAnswerOf({ ...source, url });

  answered.catch((error: unknown) => {
    if (error instanceof MotionRequestError)
      send(response, { status: 400, type: 'text/plain; charset=utf-8', body: error.message });
    else sendShot(response, Promise.reject(error));
  });

  void answered.then(
    ({ answer, pictures, ms }) => {
      if (ms === null) {
        send(response, { status: 200, type: 'application/json', body: JSON.stringify(answer) });

        return;
      }

      const keyframe = pictures.keyframes.find((candidate) => candidate.ms === ms);

      if (keyframe) send(response, { status: 200, type: 'image/png', body: keyframe.png });
      else
        sendShot(
          response,
          Promise.reject(
            new ThumbMissingError(
              `design-explore: ${ms} ms is not a keyframe - the keyframes are at ${answer.keyframes.map((frame) => frame.ms).join(', ')} ms`,
            ),
          ),
        );
    },
    () => undefined,
  );
};
