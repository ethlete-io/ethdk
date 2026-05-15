let nextTooltipId = 0;

export const createTooltipId = (prefix = 'et-tooltip') => {
  nextTooltipId += 1;
  return `${prefix}-${nextTooltipId}`;
};
