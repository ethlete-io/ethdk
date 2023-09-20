import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnyQuery } from '../query';

export interface QueryContainerConfig {
  /**
   * If `true`, the previous query will be aborted when a new query is pushed into the container.
   * @default false
   */
  abortPrevious?: boolean;
}

export class QuerySubject<T extends AnyQuery | null> extends BehaviorSubject<T> {
  constructor(
    initialValue: T = null as T,
    private _config?: QueryContainerConfig,
  ) {
    super(initialValue);
  }

  override next(value: T) {
    if (this._config?.abortPrevious) {
      this.value?.abort();
    }

    super.next(value);
  }
}

export const querySignal = <T extends AnyQuery | null>(initialValue: T = null as T, config?: QueryContainerConfig) => {
  const _signal = signal<T>(initialValue);

  const origMutate = _signal.mutate.bind(_signal);
  const origUpdate = _signal.update.bind(_signal);
  const origSet = _signal.set.bind(_signal);

  _signal.mutate = (mutatorFn: (value: T) => void) => {
    if (config?.abortPrevious) {
      _signal()?.abort();
    }

    origMutate(mutatorFn);
  };

  _signal.update = (updateFn: (value: T) => T) => {
    if (config?.abortPrevious) {
      _signal()?.abort();
    }

    origUpdate(updateFn);
  };

  _signal.set = (value: T) => {
    if (config?.abortPrevious) {
      _signal()?.abort();
    }

    origSet(value);
  };

  return _signal;
};
