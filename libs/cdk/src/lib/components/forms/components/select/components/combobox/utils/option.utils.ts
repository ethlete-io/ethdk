export const isOptionDisabled = (opt: unknown) => {
  if (typeof opt === 'object' && opt !== null && 'disabled' in opt) {
    return !!opt.disabled;
  }

  return false;
};
