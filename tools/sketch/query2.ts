// @ts-nocheck

const client = createQueryClient();

const get = createGetQuery({
  client,
});

const getSecure = createSecureGetQuery({
  client,
});

const post = createPostQuery({
  client,
});

const postSecure = createSecurePostQuery({
  client,
});

const gqlQuery = createGqlQuery({
  client,
});

const gqlMutate = createGqlMutate({
  client,
});

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

const postPost = post<GetPostQueryArgs>({
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
const postPostQuery = postPost(withBody({ title: 'title', body: 'body' })).execute();
