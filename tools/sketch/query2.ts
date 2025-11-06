// @ts-nocheck

import { numberAttribute } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup } from '@angular/forms';

const client = createQueryClient();

const get = createGetQuery(client);
const getSecure = createSecureGetQuery(client);

const post = createPostQuery(client);
const postSecure = createSecurePostQuery(client);

const gqlQuery = createGqlQuery(client);
const gqlMutate = createGqlMutate(client);

type Post = {
  id: string;
  title: string;
  body: string;
};

type GetPostQueryArgs = {
  response: Post;
  pathParams: { postId: string };
  queryParams: {};
  body: {};
};

const getPost = get<GetPostQueryArgs>({
  route: (p) => `/post/${p.postId}`,
  // reportProgress: true,
  // responseType: 'json',
  // withCredentials: true,
});

const getPost = get<GetPostQueryArgs>({
  route: (p) => `/post/${p.postId}`,
});

const getUser = getSecure<GetPostQueryArgs>().with({
  route: (p) => `/user/${p.postId}`,
});

const createPost = post<GetPostQueryArgs>({
  route: (p) => `/post/${p.postId}`,
});

// Should auto execute on path param changes and so on
const getPostQuery = getPost(withPathParams({ postId: '1' }));

// Should always be manually executed. Also applies to all other queries that mutate data
// We should try this out under real conditions (eg. inside the dyn user permissions logic)
// Maybe just via pseudo code or something...
// Since there is no auto execute, there is no need to put the body eg. in a effect function.
// We could just use it's resulting value once execute is called.
// Properties inside body should all be optional within the withBody function.
// This way it's usage will suck less when using it with reactive forms.
// This should probably be the default behavior also for query params, path params and gql variables.
// But this could get problematic if we eg. have a query that depends on an other query response for on of its query params (like teamId)
// So there should be some kind of computed abstraction that returns a "special" symbol that tells the query to not execute until the computed value is resolved.
// Having such things inside nested query params would be tedious...
const postPostQuery = createPost(withBody({ title: 'title', body: 'body' })).execute();

type ValidationResultTuple = [boolean, string, FormControl];
type ValidateFormValueOptions = {
  nullableKeys: string[];
};
type ValidateFormValueMeta = {
  isInArray: boolean;
};

const checkFormControl = (
  ctrl: FormControl,
  path: string,
  validationResult: ValidationResultTuple[],
  options?: ValidateFormValueOptions,
  meta?: ValidateFormValueMeta,
) => {
  let checkNull = !options;

  if (!meta?.isInArray) {
    checkNull = !options.nullableKeys.includes(path);
  } else {
    //replace all occurences of [0-9] with [*]
    checkNull = !options.nullableKeys.includes(path.replace(/\[\d+\]/g, '[*]'));
  }

  const nullResult = checkNull ? ctrl.value === null : false;

  if (nullResult || ctrl.invalid) {
    validationResult.push([false, path, ctrl]);
  } else {
    validationResult.push([true, path, ctrl]);
  }
};

const checkFormGroup = (
  ctrl: FormGroup,
  path: string,
  validationResult: ValidationResultTuple[],
  options?: ValidateFormValueOptions,
  meta?: ValidateFormValueMeta,
) => {
  for (const [key, control] of Object.entries(ctrl.controls)) {
    const newPath = `${path}.${key}`;
    checkAbstractControl(control, newPath, validationResult, options, meta);
  }
};

const checkFormArray = (
  ctrl: FormArray,
  path: string,
  validationResult: ValidationResultTuple[],
  options?: ValidateFormValueOptions,
  meta?: ValidateFormValueMeta,
) => {
  if (!meta) {
    meta = {
      isInArray: true,
    };
  } else if (!meta.isInArray) {
    meta.isInArray = true;
  }

  for (const [i, control] of ctrl.controls.entries()) {
    const newPath = `${path}[${i}]`;
    checkAbstractControl(control, newPath, validationResult, options, meta);
  }
};

const checkAbstractControl = (
  ctrl: AbstractControl,
  path: string,
  validationResult: ValidationResultTuple[],
  options?: ValidateFormValueOptions,
  meta?: ValidateFormValueMeta,
) => {
  if (ctrl instanceof FormGroup) {
    checkFormGroup(ctrl, path, validationResult, options, meta);
  } else if (ctrl instanceof FormArray) {
    checkFormArray(ctrl, path, validationResult, options, meta);
  } else if (ctrl instanceof FormControl) {
    checkFormControl(ctrl, path, validationResult, options, meta);
  }
};

const validatedFormValue = (ctrl: AbstractControl, options?: ValidateFormValueOptions) => {
  const validationResult: ValidationResultTuple[] = [];

  checkAbstractControl(ctrl, '', validationResult, options);

  return validationResult;
};

const form = new FormGroup({
  title: new FormControl('title'),
  body: new FormControl('body'),
});

const formValue = createFormValueSignal(form);
const collectionId = injectPathParam('collectionId', { transform: numberAttribute });

const createPostQuery = createPost(
  withArgs(() => {
    const formVal = this.formValue();
    const collectionId = this.collectionId();

    if (!formVal.title || !formVal.body) return null;

    return {
      pathParams: {
        collectionId,
      },
      body: {
        title: formVal.title,
        body: formVal.body,
      },
    };
  }),
);

const postResponseId = computed(() => this.createPostQuery.response()?.id);

const execCreatePost = () => {
  this.createPostQuery.execute();
};
