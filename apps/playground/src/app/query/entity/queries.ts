import { def, EntityStore, QueryClient } from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { map } from 'rxjs';

export interface PostLoginArgs {
  body: {
    username: string;
    password: string;
  };
}

export interface LoginSuccessView {
  token: string;
  refresh_token: string;
}

export interface MediaView {
  uuid: string;
}

export interface GetMediaSearchArgs {
  queryParams: {
    query?: string;
    page?: number;
    limit?: number;
  };
}

export interface GetMediaByUuidArgs {
  pathParams: {
    uuid: string;
  };
}

export const client = new QueryClient({
  baseRoute: 'http://localhost:3333',
});

export const postLogin = client.post({
  route: '/auth/login',
  secure: false,
  types: {
    args: def<PostLoginArgs>(),
    response: def<LoginSuccessView>(),
  },
});

const mediaWithDetailsStore = new EntityStore<MediaView>({
  name: 'media',
  logActions: true,
});

export const getMediaSearchWithDetails = client.get({
  route: '/media/search/with-details',
  secure: true,
  autoRefreshOn: {
    windowFocus: false,
  },
  types: {
    args: def<GetMediaSearchArgs>(),
    response: def<Paginated<MediaView>>(),
  },
  entity: {
    store: mediaWithDetailsStore,
    id: ({ response }) => response.items.map((i) => i.uuid),
    get: ({ id, store, response }) => store.select(id as string[]).pipe(map((items) => ({ ...response, items }))),
    set: ({ response, store, id }) => store.set(id as string[], response.items),
  },
});

export const getMediaByUuidWithDetails = client.get({
  route: (p) => `/media/${p.uuid}/with-details`,
  secure: true,
  types: {
    args: def<GetMediaByUuidArgs>(),
    response: def<MediaView>(),
  },
  entity: {
    store: mediaWithDetailsStore,
    id: ({ args }) => args.pathParams.uuid,
    get: ({ id, store }) => store.select(id as string),
    set: ({ response, store, id }) => store.set(id as string, response),
  },
});
