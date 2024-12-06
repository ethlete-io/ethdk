import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports, provideValidatorErrorsService } from '@ethlete/cdk';
import { map, timer } from 'rxjs';

type Loading = {
  type: typeof QUERY_STATE.LOADING;
  data: {
    progress: number;
  };
};

type Success = {
  type: typeof QUERY_STATE.SUCCESS;
  data: {
    stuff: string;
  };
};

type Error = {
  type: typeof QUERY_STATE.ERROR;
  data: {
    message: string;
  };
};

type State = Loading | Success | Error;

const QUERY_STATE = {
  LOADING: 0,
  SUCCESS: 1,
  ERROR: 2,
} as const;

class Query {
  _rawState = signal<State>({
    type: QUERY_STATE.LOADING,
    data: {
      progress: 0,
    },
  });

  _state = computed(() => {
    const state = this._rawState();

    switch (state.type) {
      case QUERY_STATE.LOADING:
        return {
          loading: state.data,
        } as const;
      case QUERY_STATE.SUCCESS:
        return {
          success: state.data,
        } as const;
      case QUERY_STATE.ERROR:
        return {
          error: state.data,
        } as const;
    }
  });

  _loading = computed(() => {
    const state = this._rawState();

    if (state.type === QUERY_STATE.LOADING) {
      return state.data;
    }

    return null;
  });

  _error = computed(() => {
    const state = this._rawState();

    if (state.type === QUERY_STATE.ERROR) {
      return state.data;
    }

    return null;
  });

  _success = computed(() => {
    const state = this._rawState();

    if (state.type === QUERY_STATE.SUCCESS) {
      return state.data;
    }

    return null;
  });

  get state() {
    return this._state();
  }

  constructor() {
    setTimeout(() => {
      this._rawState.set({
        type: QUERY_STATE.SUCCESS,
        data: {
          stuff: 'Hello World',
        },
      });
    }, 3000);
  }
}

const makeQuery = () => {
  const _rawState = signal<State>({
    type: QUERY_STATE.LOADING,
    data: {
      progress: 0,
    },
  });

  const query = {
    get error() {
      const state = _rawState();

      if (state.type === QUERY_STATE.ERROR) {
        return state.data;
      }

      return null;
    },
    get response() {
      const state = _rawState();

      if (state.type === QUERY_STATE.SUCCESS) {
        return state.data;
      }

      return null;
    },
    get loading() {
      const state = _rawState();

      if (state.type === QUERY_STATE.LOADING) {
        return state.data;
      }

      return null;
    },
  } as
    | { loading: { progress: number }; error: null; response: null }
    | { loading: null; error: { message: string }; response: null }
    | { loading: null; error: null; response: { stuff: string } };

  setTimeout(() => {
    _rawState.set({
      type: QUERY_STATE.SUCCESS,
      data: {
        stuff: 'Hello World',
      },
    });
  }, 3000);

  return query;
};

const makeQuery2 = () => {
  const _rawState = signal<State>({
    type: QUERY_STATE.LOADING,
    data: {
      progress: 0,
    },
  });

  const error = computed(() => {
    const state = _rawState();

    if (state.type === QUERY_STATE.ERROR) {
      return state.data;
    }

    return null;
  });

  const response = computed(() => {
    const state = _rawState();

    if (state.type === QUERY_STATE.SUCCESS) {
      return state.data;
    }

    return null;
  });

  const loading = computed(() => {
    const state = _rawState();

    if (state.type === QUERY_STATE.LOADING) {
      return state.data;
    }

    return null;
  });

  const query = {
    _rawState,
    error,
    response,
    loading,
  };

  setTimeout(() => {
    _rawState.set({
      type: QUERY_STATE.SUCCESS,
      data: {
        stuff: 'Hello World',
      },
    });
  }, 3000);

  return query;
};

@Component({
  selector: 'ethlete-playground-combobox',
  templateUrl: './combobox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, ComboboxImports, AsyncPipe, JsonPipe],
  hostDirectives: [],
  providers: [provideValidatorErrorsService()],
})
export class PlaygroundComboboxComponent {
  query = new Query();
  query2 = makeQuery();
  query3 = makeQuery2();

  DEFAULT_VALUE = [
    {
      type: 'foo',
      label: 'Foo',
    },
    {
      type: 'bar',
      label: 'Bar',
    },
  ];

  items$ = timer(300).pipe(
    map(() => {
      return [
        {
          type: 'foo',
          label: 'Foo',
          id: 1,
          stuff: 'stuff',
        },
        {
          type: 'bar',
          label: 'Bar',
          id: 2,
          stuff: 'stuff',
        },
        {
          type: 'baz',
          label: 'Baz',
          id: 3,
          stuff: null,
        },
      ];
    }),
  );

  ctrl = new FormGroup({
    a: new FormControl(null),
    b: new FormControl(null),
  });
}
