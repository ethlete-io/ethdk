import { SKETCH_NARROW_SAMPLE } from '../design-parts/sketches/sketches-sample';

type Props = Record<string, unknown>;

/** Replaces a design-only prop that picks sample data with the inputs that data needs. */
export const DESIGN_HARNESS_SAMPLES: Record<string, (props: Props) => Props> = {
  'pages/sketches': (props) => (props['part'] === 'narrow' ? { ...props, ...SKETCH_NARROW_SAMPLE } : props),
};
