import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import {
  CreateEffectOptions,
  DestroyRef,
  InjectionToken,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';

const QUERY_EFFECT_ERROR_MESSAGE =
  'Effect triggered too often. This is probably due to a circular dependency inside the query.';

/** A angular effect that will throw an error in dev mode if it is called too often. This indicates a circular dependency inside the effect. */
const safeEffect = (fn: () => void, errorMessage: string, options?: CreateEffectOptions) => {
  let lastTriggerTs = 0;
  let illegalWrites = 0;

  effect(() => {
    if (isDevMode()) {
      const now = performance.now();

      if (now - lastTriggerTs < 100) {
        illegalWrites++;

        if (illegalWrites > 5) {
          throw new Error(errorMessage);
        }
      }

      lastTriggerTs = now;
    }

    fn();
  }, options);
};

export const createQueryClientOptions = (baseRoute: string, id: string) => {
  const token = new InjectionToken<{ baseRoute: string }>(id);

  return {
    token,
    id,
    baseRoute,
  };
};

export const provideQueryClient = (options: ReturnType<typeof createQueryClientOptions>) => {
  return {
    provide: options.token,
    useFactory: () => {
      const httpClient = inject(HttpClient);

      return {
        baseRoute: options.baseRoute,
        httpClient,
      };
    },
  };
};

export const injectQueryClient = (token: InjectionToken<{ baseRoute: string }>) => {
  return inject<{ baseRoute: string; httpClient: HttpClient }>(token);
};

/**
 * Returning this inside e.g. a withComputedArgs feature will reset the query args to null.
 * This will also pause polling and auto refresh until new args are set.
 */
const QUERY_ARGS_RESET = Symbol('QUERY_ARGS_RESET');
type QueryArgsReset = typeof QUERY_ARGS_RESET;

type QueryArguments = {
  queryParams?: object;
  pathParams?: object;
  body?: object;
};

type NoVoid<T> = T extends void ? never : T;

type QueryArgumentsWithOptionalPathParamsAndBody<TQueryArgs extends QueryArguments | void> = TQueryArgs extends void
  ? void
  : {
      [K in keyof TQueryArgs]: K extends 'body'
        ? TQueryArgs[K] | null | undefined
        : K extends 'pathParams'
          ? {
              [K2 in keyof NoVoid<TQueryArgs>['pathParams']]: NoVoid<TQueryArgs>['pathParams'][K2] | null | undefined;
            }
          : TQueryArgs[K];
    };

type OmitVoid<T> = T extends void ? never : T;

type PathParamsOf<T extends QueryArguments | void> = T extends void
  ? void
  : OmitVoid<T>['pathParams'] extends undefined
    ? void
    : OmitVoid<T>['pathParams'];

type CreateQueryOptions<TArgs extends QueryArguments | void = void, TResponse = void> = {
  clientId: InjectionToken<{ baseRoute: string }>;
  method?: 'GET';
  route: PathParamsOf<TArgs> extends void ? string : (pathParams: PathParamsOf<TArgs>) => string;
  types?: {
    args?: TArgs;
    response?: TResponse;
  };
};

type CreateMutationOptions<TArgs extends QueryArguments | void = void, TResponse = void> = {
  clientId: InjectionToken<{ baseRoute: string }>;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  route: PathParamsOf<TArgs> extends void ? string : (pathParams: PathParamsOf<TArgs>) => string;
  types?: {
    args?: TArgs;
    response?: TResponse;
  };
};

type QueryFeatureFn<TArgs extends QueryArguments | void, TResponse> = (
  options: QueryFeatureFnContext<TArgs, TResponse>,
) => void;

const enum QueryFeatureType {
  WithArgs,
  WithComputedArgs,
  WithLogging,
  WithErrorHandling,
  WithSuccessHandling,
  WithPolling,
  WithAutoRefresh,
  WithOptions,
}

type QueryFeature<TArgs extends QueryArguments | void = void, TResponse = void> = {
  /** The type of feature for compatibility checks */
  type: QueryFeatureType | string;

  /** The actual feature function logic */
  fn: QueryFeatureFn<TArgs, TResponse>;
};

type QueryFeatureFnContext<TArgs extends QueryArguments | void = void, TResponse = void> = {
  args: WritableSignal<TArgs | null>;
  event: Signal<HttpEvent<TResponse> | null>;
  response: WritableSignal<TResponse | null>;
  loading: Signal<boolean>;
  error: Signal<boolean>;
  execute: (args: TArgs) => void;
};

export const createQuery = <TArgs extends QueryArguments | void = void, TResponse = void>(
  options: CreateQueryOptions<TArgs, TResponse>,
) => {
  const method = options.method ?? 'GET';

  return (...features: QueryFeature<TArgs, TResponse>[]) => {
    if (isDevMode()) {
      const featuresTypes = new Set(features.map((f) => f.type));

      // Check if any of the features are used multiple times
      for (const feature of features) {
        const count = features.filter((f) => f.type === feature.type).length;

        if (count > 1) {
          throw new Error(`Feature ${feature.type} is used multiple times in the same query.`);
        }
      }

      if (featuresTypes.has(QueryFeatureType.WithArgs) && featuresTypes.has(QueryFeatureType.WithComputedArgs)) {
        throw new Error('Both withArgs and withComputedArgs are not allowed in the same query.');
      }
    }

    const client = injectQueryClient(options.clientId);
    const destroyRef = inject(DestroyRef);

    const response = signal<TResponse | null>(null);
    const args = signal<TArgs | null>(null);
    const event = signal<HttpEvent<TResponse> | null>(null);

    const loading = computed(() => event()?.type !== HttpEventType.Response);
    const error = computed(() => event() instanceof HttpErrorResponse);

    const onExecute$ = new Subject<TArgs>();

    const execute = (execArgs?: TArgs) => {
      const argsToUse = execArgs ?? args();

      if (argsToUse === null) return;

      args.set(argsToUse);
      onExecute$.next(argsToUse);

      const call = client.httpClient.request(method, 'queryTemplate.route', {
        reportProgress: true,
        observe: 'events',
      });

      call
        .pipe(
          takeUntilDestroyed(destroyRef),
          takeUntil(onExecute$),
          tap((currentEvent) => {
            event.set(currentEvent);

            if (currentEvent.type === HttpEventType.Response) {
              response.set(currentEvent.body);
            }
          }),
        )
        .subscribe();
    };

    const featureFnContext: QueryFeatureFnContext<TArgs, TResponse> = {
      args,
      event,
      response,
      loading,
      error,
      execute,
    };

    for (const feature of features) {
      feature.fn(featureFnContext);
    }

    return {
      value: response.asReadonly(),
      loading,
      error,
      execute,
    };
  };
};

export const createMutation = <TArgs extends QueryArguments | void = void, TResponse = void>(
  options: CreateMutationOptions<TArgs, TResponse>,
) => {
  return (...features: QueryFeature<TArgs, TResponse>[]) => {
    if (isDevMode()) {
      const featuresTypes = new Set(features.map((f) => f.type));

      // Check if any of the features are used multiple times
      for (const feature of features) {
        const count = features.filter((f) => f.type === feature.type).length;

        if (count > 1) {
          throw new Error(`Feature ${feature.type} is used multiple times in the same query.`);
        }
      }

      if (featuresTypes.has(QueryFeatureType.WithArgs) && featuresTypes.has(QueryFeatureType.WithComputedArgs)) {
        throw new Error('Both withArgs and withComputedArgs are not allowed in the same query.');
      }

      const isMutation =
        options.method === 'POST' ||
        options.method === 'PUT' ||
        options.method === 'DELETE' ||
        options.method === 'PATCH';

      if (featuresTypes.has(QueryFeatureType.WithPolling) && isMutation) {
        throw new Error('The feature withPolling is not allowed in mutations.');
      }

      if (featuresTypes.has(QueryFeatureType.WithAutoRefresh) && isMutation) {
        throw new Error('The feature withAutoRefresh is not allowed in mutations.');
      }
    }

    const client = injectQueryClient(options.clientId);
    const destroyRef = inject(DestroyRef);

    const response = signal<TResponse | null>(null);
    const args = signal<TArgs | null>(null);
    const event = signal<HttpEvent<TResponse> | null>(null);

    const loading = computed(() => event()?.type !== HttpEventType.Response);
    const error = computed(() => event() instanceof HttpErrorResponse);

    const onExecute$ = new Subject<TArgs>();

    const execute = (execArgs?: TArgs) => {
      const argsToUse = execArgs ?? args();

      if (argsToUse === null) return;

      args.set(argsToUse);
      onExecute$.next(argsToUse);

      const call = client.httpClient.request(options.method, 'queryTemplate.route', {
        reportProgress: true,
        observe: 'events',
      });

      call
        .pipe(
          takeUntilDestroyed(destroyRef),
          takeUntil(onExecute$),
          tap((currentEvent) => {
            event.set(currentEvent);

            if (currentEvent.type === HttpEventType.Response) {
              response.set(currentEvent.body);
            }
          }),
        )
        .subscribe();
    };

    const featureFnContext: QueryFeatureFnContext<TArgs, TResponse> = {
      args,
      event,
      response,
      loading,
      error,
      execute,
    };

    for (const feature of features) {
      feature.fn(featureFnContext);
    }

    return {
      value: response.asReadonly(),
      loading,
      error,
      execute,
    };
  };
};

import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { Subject, takeUntil, tap } from 'rxjs';
import { controlValueSignal } from '../../libs/core/src';
import { def } from '../../libs/query/src';

const createQueryFeature = <TArgs extends QueryArguments | void = void, TResponse = void>(config: {
  type: QueryFeatureType | string;
  fn: QueryFeatureFn<TArgs, TResponse>;
}) => {
  return config as QueryFeature<TArgs, TResponse>;
};

const validatePathParams = <TResArgs extends QueryArguments | void = void>(args: QueryArguments | void) => {
  if (!args) return null;

  if (args.pathParams) {
    for (const pathParam in args.pathParams) {
      const val = args.pathParams[pathParam];

      if (val === null || val === undefined) {
        return null;
      }
    }
  }

  return args as unknown as TResArgs;
};

const withComputedArgs = <TArgs extends QueryArguments | void = void, TResponse = void>(
  args: () => NoInfer<QueryArgumentsWithOptionalPathParamsAndBody<TArgs>> | QueryArgsReset | null,
) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithComputedArgs,
    fn: (context) => {
      const currArgs = computed(() => args());

      safeEffect(() => {
        const currArgsNow = currArgs();

        if (currArgsNow === null) return;

        untracked(() => {
          if (currArgsNow === QUERY_ARGS_RESET) {
            context.args.set(null);
            return;
          }

          const validatedArgs = validatePathParams<TArgs>(currArgsNow);

          if (validatedArgs === null) return;

          context.execute(validatedArgs);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);
    },
  });
};

const withArgs = <TArgs extends QueryArguments | void = void, TResponse = void>(
  args: NoInfer<QueryArgumentsWithOptionalPathParamsAndBody<TArgs>>,
) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithArgs,
    fn: (context) => {
      const currArgs = computed(() => args);

      safeEffect(() => {
        const currArgsNow = validatePathParams<TArgs>(currArgs());

        if (currArgsNow === null) return;

        untracked(() => {
          context.execute(currArgsNow);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);
    },
  });
};

const withLogging = <TArgs extends QueryArguments | void = void, TResponse = void>(options: {
  logFn: (v: HttpEvent<TResponse> | null) => void;
}) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithLogging,
    fn: (context) => {
      effect(() => {
        const event = context.event();

        if (event === null) return;

        untracked(() => {
          options.logFn(event);
        });
      });
    },
  });
};

const withErrorHandling = <TArgs extends QueryArguments | void = void, TResponse = void>(options: {
  handler: (e: boolean) => void;
}) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithErrorHandling,
    fn: (context) => {
      effect(() => {
        const error = context.error();

        if (error === null) return;

        untracked(() => {
          options.handler(error);
        });
      });
    },
  });
};

const withSuccessHandling = <TArgs extends QueryArguments | void = void, TResponse = void>(options: {
  handler: (data: NonNullable<TResponse>) => void;
}) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithSuccessHandling,
    fn: (context) => {
      effect(() => {
        const response = context.response();

        if (response === null) return;

        untracked(() => {
          options.handler(response as NonNullable<TResponse>);
        });
      });
    },
  });
};

const withPolling = <TArgs extends QueryArguments | void = void, TResponse = void>(options: { interval: number }) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithPolling,
    fn: (context) => {
      let intervalId: number | null = null;

      safeEffect(() => {
        const args = context.args();

        untracked(() => {
          if (intervalId !== null) clearInterval(intervalId);

          if (args === null) return;

          intervalId = window.setInterval(() => {
            context.execute(args);
          }, options.interval);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);

      inject(DestroyRef).onDestroy(() => intervalId !== null && clearInterval(intervalId));
    },
  });
};

const withAutoRefresh = <TArgs extends QueryArguments | void = void, TResponse = void>(options: {
  signalChanges: Signal<unknown>[];
}) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithAutoRefresh,
    fn: (context) => {
      safeEffect(() => {
        for (const signal of options.signalChanges) {
          signal();
        }

        untracked(() => {
          const args = context.args();

          if (args === null) return;

          context.execute(args);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);
    },
  });
};

const withOptions = <TArgs extends QueryArguments | void = void, TResponse = void>(options: {}) => {
  return createQueryFeature<TArgs, TResponse>({
    type: QueryFeatureType.WithOptions,
    fn: (context) => {
      console.log('options', context);
    },
  });
};

export const clientOptions = createQueryClientOptions('https://jsonplaceholder.typicode.com', 'client');

type DummyPathParams = { id: string };
type DummyQueryParams = { includeDetails: boolean };
type DummyResponse = { id: string };
type DummyBody = { name: string };

type DummyArgs = {
  pathParams: DummyPathParams;
  queryParams: DummyQueryParams;
};

type DummyArgs2 = {
  pathParams: DummyPathParams;
  queryParams: DummyQueryParams;
  body: DummyBody;
};

export const getPost = createQuery({
  clientId: clientOptions.token,
  method: 'GET',
  route: (p) => `post/${p.id}`,
  types: {
    args: def<DummyArgs>(),
    response: def<DummyResponse>(),
  },
});

export const putPost = createMutation({
  clientId: clientOptions.token,
  method: 'PUT',
  route: (p) => `post/${p.id}`,
  types: {
    args: def<DummyArgs2>(),
    response: def<DummyResponse>(),
  },
});

@Component({
  selector: 'et-test-comp',
  template: `
    @if (postQuery.value(); as post) {
      <p>{{ post.id }}</p>
    }
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TestCompComponent {
  routerId = signal<string | null>('2');

  postUpdated = signal(false);

  form = new FormGroup({
    name: new FormControl(''),
  });

  formValue = controlValueSignal(this.form);

  formValueDto = computed(() => {
    const formValue = this.formValue();

    if (!formValue.name) return null;

    return { name: formValue.name };
  });

  postQuery = getPost(
    withOptions({ queryKey: 'post', allowNullablePathParams: true }),
    withComputedArgs(() => ({ pathParams: { id: this.routerId() }, queryParams: { includeDetails: true } })),
    withArgs({ pathParams: { id: this.routerId() }, queryParams: { includeDetails: true } }),
    withLogging({ logFn: (v) => console.log(v) }),
    withErrorHandling({ handler: (e) => console.error(e) }),
    withSuccessHandling({ handler: (v) => console.log(v) }),
    withPolling({ interval: 1000 }),
    withAutoRefresh({ signalChanges: [this.postUpdated] }),
  );

  updatePostQuery = putPost(
    withArgs({ pathParams: { id: this.routerId() }, queryParams: { includeDetails: true }, body: this.formValueDto() }),
  );

  postId = computed(() => this.postQuery.value()?.id);

  loadOtherPost() {
    this.postQuery.execute({ pathParams: { id: '3' }, queryParams: { includeDetails: true } });
  }

  updatePost() {
    this.updatePostQuery.execute();
  }
}
