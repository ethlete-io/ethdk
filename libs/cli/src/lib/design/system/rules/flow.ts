import { goneStateOf } from '../comments/comment';
import { DesignFlow, flowStateKeyOf, FlowState, listFlows } from '../flows/flow';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

const nameOf = (state: FlowState) => `${state.part} "${state.state}"`;

const problemsOfFlow = (product: ResolvedProduct, flow: DesignFlow): string[] => {
  const seen = new Set<string>();
  const doubled = flow.frames.flatMap((frame) => {
    const key = flowStateKeyOf(frame);

    if (seen.has(key)) return [`shows ${nameOf(frame)} twice - a state is one frame per flow`];
    seen.add(key);

    return [];
  });
  const gone = flow.frames.flatMap((frame) => {
    const reason = goneStateOf({ product, part: frame.part, state: frame.state });

    return reason ? [`${reason} - fix or drop the frame`] : [];
  });
  const loose = flow.lines.flatMap((line, index) =>
    [line.from, line.to]
      .filter((end) => !seen.has(flowStateKeyOf(end)))
      .map((end) => `lines[${index}] names ${nameOf(end)}, which is no frame of the flow - add it to frames`),
  );

  return [...doubled, ...gone, ...loose];
};

/** A flow file that cannot be read, a frame whose part or state is gone, and a line between states the flow does not show. */
export const flowProblemsOf = (product: ResolvedProduct): Problem[] => {
  const { flows, unreadable } = listFlows(product.dir);

  return [
    ...unreadable.map(({ file, problem }) => ({ rule: 'FLOW', file, message: problem })),
    ...flows.flatMap((flow) =>
      problemsOfFlow(product, flow).map((message) => ({ rule: 'FLOW', file: flow.file, message })),
    ),
  ];
};
