import { DesignFlow, FlowLine, flowStateKeyOf } from './system/flows/flow';

const ARROW = /→|->/u;

/** How `et design motion flow` names a line: its `id`, else `<part>#<state>→<part>#<state>`. */
export const flowLineAddressOf = (line: FlowLine) =>
  line.id ?? `${flowStateKeyOf(line.from)}→${flowStateKeyOf(line.to)}`;

/** The line of `flow` that `address` names and that animates, or why there is none. */
export const flowLineOf = (flow: DesignFlow, address: string): FlowLine | string => {
  const animated = flow.lines.filter((line) => line.transition === 'view').map(flowLineAddressOf);
  const known = `animated lines: ${animated.join(', ') || 'none - give a line "transition": "view"'}`;
  const [from, to, ...rest] = address.split(ARROW).map((end) => end.trim());
  const found = flow.lines.filter((line) =>
    to === undefined || rest.length > 0
      ? line.id === address
      : flowStateKeyOf(line.from) === from && flowStateKeyOf(line.to) === to,
  );
  const [line, ...more] = found;

  if (!line) return `flow "${flow.name}" has no line "${address}" (${known})`;
  if (more.length > 0)
    return `flow "${flow.name}" has ${found.length} lines ${address} - give each its own "id" and name it`;
  if (to !== undefined && line.id)
    return `line ${address} of flow "${flow.name}" has the id "${line.id}" - name it by that`;
  if (line.transition !== 'view')
    return `line ${address} of flow "${flow.name}" does not animate - give it "transition": "view" (${known})`;

  return line;
};
