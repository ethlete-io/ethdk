export const WEBKIT_ZOOM_CASE = 'ctrl-wheel zoom over 100 cells keeps the frame interval budget';

export const webkitZoomPlan = () => ({
  command: 'node',
  args: [
    'tools/scripts/heavy.mjs',
    'run',
    '--on',
    'mac',
    '--',
    'yarn',
    'studio:e2e',
    '--perf',
    '--engine',
    'webkit',
    '--case',
    WEBKIT_ZOOM_CASE,
  ],
});

/** Runs the WebKit zoom gate on the Mac; resolves to a failure message, or null when the 20 ms budget held. */
export const runWebkitZoomStep = async (run) => {
  const { command, args } = webkitZoomPlan();
  const code = await run(command, args);
  return code === 0
    ? null
    : `WebKit zoom gate failed (exit ${code}): case "${WEBKIT_ZOOM_CASE}" on the Mac, 20 ms p50 budget (B910); a Mac that is unreachable fails this step too`;
};
