import { afterNextRender } from '@angular/core';

export const createSetup = <T extends Record<string, unknown>>(config: {
  setupFn: (params: T) => void;
  this: ThisType<unknown>;
}) => {
  let didCallSetup = false;

  afterNextRender(() => {
    if (!didCallSetup) {
      console.error('The setup() function was not called. Please call it inside your constructor.', config.this);
      return;
    }
  });

  return (params: T) => {
    if (didCallSetup) {
      console.error(
        'The setup() function was already called. Please call it only once. \n\n',
        'Instance containing the setup() call \n',
        config.this,
        '\n\n Setup was called with\n',
        params,
      );
      return;
    }

    didCallSetup = true;
    config.setupFn(params);
  };
};
