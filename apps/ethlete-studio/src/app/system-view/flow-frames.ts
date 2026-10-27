import { FlowState, ListedFlow } from '../../host/design-flows';
import { ListedSketch, partFrameUrl, partShotUrl } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { CanvasLine } from '../components/design-canvas/flow-layout';
import { FramesSource, TreeGroup, partKeyOf } from './system-tree';

export const flowKeyOf = (name: string) => `flow:${name}`;

export const frameIdOf = ({ part, state }: FlowState) => `${part} ${state}`;

/** The tree with a Flows group after the groups of parts, one entry per flow. */
export const withFlowGroup = (tree: TreeGroup[], flows: ListedFlow[]): TreeGroup[] => {
  if (flows.length === 0) return tree;

  const group: TreeGroup = {
    key: 'flows',
    label: 'Flows',
    entries: flows.map((flow) => ({
      key: flowKeyOf(flow.name),
      name: flow.name,
      title: flow.file,
      badges: flow.problems.length > 0 ? ['error'] : [],
    })),
  };
  const at = tree.findIndex((candidate) => candidate.key === 'sketches' || candidate.key.startsWith('legacy'));

  return at === -1 ? [...tree, group] : [...tree.slice(0, at), group, ...tree.slice(at)];
};

export type FlowFramesSource = Omit<FramesSource, 'part'> & {
  flow: ListedFlow;
  preset: string;
  sketches?: ListedSketch[];
};

const sketchedOf = (sketches: ListedSketch[], { product, key }: { product: string; key: string }) => {
  const sketch = sketches.find((candidate) => candidate.product === product && candidate.target === key);
  const variant = sketch?.variants[0];

  if (!sketch || variant === undefined) return null;

  const target = sketch.targets?.find((candidate) => candidate.variant === variant);

  return { layer: sketch.layer, variant, states: target?.states ?? [], error: target?.error };
};

/**
 * Each state of a flow at one preset: a page at the preset's size, any other part at its width, and
 * the flow's lines between them. A part the product lacks draws as the first variant of its open sketch.
 */
export const flowFramesOf = (source: FlowFramesSource): { frames: CanvasFrame[]; lines: CanvasLine[] } => {
  const { port, product, flow, preset, epoch, revision, surface, color, sketches = [] } = source;
  const size = product.presets[preset];
  const frames = flow.frames.map(({ part: key, state, position }): CanvasFrame => {
    const part = product.parts.find((candidate) => partKeyOf(candidate) === key);
    const sketched = part ? null : sketchedOf(sketches, { product: product.name, key });
    const address = {
      port,
      product: product.name,
      part: key,
      state,
      epoch,
      revision,
      surface,
      color,
      ...(sketched ? { sketch: key, variant: sketched.variant } : {}),
    };
    const known = part ?? sketched;
    const error = !known
      ? `no part ${key}`
      : !known.states.includes(state)
        ? `${key} has no state "${state}"`
        : part
          ? part.problems.find((problem) => problem.rule === 'LOAD')?.message
          : sketched?.error;
    const page = known?.layer === 'pages';

    return {
      id: frameIdOf({ part: key, state }),
      src: partFrameUrl(address),
      label: `${key} · ${state}`,
      ...(size ? { width: size.width } : {}),
      ...(page && size?.height ? { height: size.height } : {}),
      screenshot: partShotUrl(page ? { ...address, preset } : { ...address, width: size?.width }),
      ...(error ? { error } : {}),
      ...(position ? { at: position } : {}),
      place: { part: key, state, size: preset },
    };
  });

  return {
    frames,
    lines: flow.lines.map(({ from, to, label }) => ({
      from: frameIdOf(from),
      to: frameIdOf(to),
      ...(label ? { label } : {}),
    })),
  };
};
