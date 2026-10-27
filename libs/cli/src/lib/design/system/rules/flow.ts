import { goneStateOf } from '../comments/comment';
import { DesignFlow, flowStateKeyOf, FlowState, listFlows } from '../flows/flow';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from '../sketch/overlay';
import { listSketches, Sketch } from '../sketch/sketch';

const nameOf = (state: FlowState) => `${state.part} "${state.state}"`;

const sketchOnlyOf = (product: ResolvedProduct, key: string) =>
  listSketches({ productDir: product.dir, product: product.name }).find(
    (sketch): sketch is Sketch => typeof sketch !== 'string' && sketch.target === key && sketch.variants.length > 0,
  );

/** Why a frame points at nothing; a part the product lacks is looked up in the first variant of its open sketch. */
const goneFrameOf = (product: ResolvedProduct, frame: FlowState) => {
  const reason = goneStateOf({ product, part: frame.part, state: frame.state });
  const sketch =
    reason && !product.parts.some((part) => partKeyOf(part) === frame.part) && sketchOnlyOf(product, frame.part);

  if (!sketch) return reason;

  const variant = sketch.variants[0] as string;
  const sketched = overlaySketch({ product, sketch, variant });
  const gone = goneStateOf({ product: sketched, part: frame.part, state: frame.state });

  return gone && `${gone} in sketch variant ${variant}`;
};

const problemsOfFlow = (product: ResolvedProduct, flow: DesignFlow): string[] => {
  const seen = new Set<string>();
  const doubled = flow.frames.flatMap((frame) => {
    const key = flowStateKeyOf(frame);

    if (seen.has(key)) return [`shows ${nameOf(frame)} twice - a state is one frame per flow`];
    seen.add(key);

    return [];
  });
  const gone = flow.frames.flatMap((frame) => {
    const reason = goneFrameOf(product, frame);

    return reason ? [`${reason} - fix or drop the frame`] : [];
  });
  const loose = flow.lines.flatMap((line, index) =>
    [line.from, line.to]
      .filter((end) => !seen.has(flowStateKeyOf(end)))
      .map((end) => `lines[${index}] names ${nameOf(end)}, which is no frame of the flow - add it to frames`),
  );

  const ids = new Set<string>();
  const twice = flow.notes.flatMap((note) => {
    if (ids.has(note.id)) return [`has two notes with the id "${note.id}" - give each its own`];
    ids.add(note.id);

    return [];
  });

  return [...doubled, ...gone, ...loose, ...twice];
};

/**
 * A flow file that cannot be read, a frame whose part or state is gone (a part that exists only as a sketch
 * counts with the states of its first variant), a line between states the flow does not show,
 * and two free notes with one id.
 */
export const flowProblemsOf = (product: ResolvedProduct): Problem[] => {
  const { flows, unreadable } = listFlows(product.dir);

  return [
    ...unreadable.map(({ file, problem }) => ({ rule: 'FLOW', file, message: problem })),
    ...flows.flatMap((flow) =>
      problemsOfFlow(product, flow).map((message) => ({ rule: 'FLOW', file: flow.file, message })),
    ),
  ];
};
