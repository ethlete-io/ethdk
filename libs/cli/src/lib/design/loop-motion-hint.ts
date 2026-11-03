const LOOP_LINE = /no looping motion in ([^;]+)/g;

export const withLoopMotionHint = (line: string) =>
  line.replace(LOOP_LINE, (text, states: string) => {
    const entries = states
      .split(',')
      .map((state) => state.trim())
      .map((state) => `${state}: { from: '${state}', to: '${state}' }`);

    return `${text} (add to motions: ${entries.join(', ')})`;
  });
