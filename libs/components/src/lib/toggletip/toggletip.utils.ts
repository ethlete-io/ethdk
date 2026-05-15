let nextToggletipId = 0;

export const createToggletipId = (prefix = 'et-toggletip') => {
  nextToggletipId += 1;
  return `${prefix}-${nextToggletipId}`;
};
