// @ts-nocheck

import { signal } from '@angular/core';

// TODO: How to handle dynamic creation of queries? Eg. if there are 8 items in response a with a thing uuid, create 8 queries for each thing with that uuid

const postIds = signal(['1', '2', '3', '4', '5', '6', '7', '8']);

const getPost = (postId: string) => null;

// the param inside is internally wrapped in a effect.
// This way it's reactive.
// If the effect triggers, we need to cleanup previous queries and create new ones.
// Maybe we can also reuse existing queries where the cache key matches the new query key somehow.
const getPostQueries = createQueryStack(() => {
  const ids = postIds();

  return ids.map((id) => getPost(withArgs(() => ({ pathParams: { postId: id } }))));
});
