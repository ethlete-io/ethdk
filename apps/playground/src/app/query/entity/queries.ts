import {
  createQueryCollection,
  def,
  EntityStore,
  filterSuccess,
  mapToPaginated,
  QueryClient,
  switchQueryCollectionState,
  switchQueryState,
} from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { tap } from 'rxjs';

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
  secure: false,
  types: {
    args: def<GetMediaSearchArgs>(),
    response: def<Paginated<MediaView>>(),
  },
  entity: {
    store: mediaWithDetailsStore,
    id: ({ response }) => response.items.map((i) => i.uuid),
    get: ({ id, store, response }) => store.select(id).pipe(mapToPaginated(response)),
    set: ({ response, store, id }) => store.set(id, response.items),
  },
});

export const getMediaSearchWithDetails2 = client.get({
  route: '/media/search/with-details',
  secure: false,
  types: {
    response: def<Paginated<MediaView>>(),
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
    get: ({ id, store }) => store.select(id),
    set: ({ response, store, id }) => store.set(id, { ...response, uuid: 'i have changed' }),
  },
});

export const getMediaByUuidWithDetailsNoArgs = client.get({
  route: '/media/:uuid/with-details',
  secure: true,
  types: {
    response: def<MediaView>(),
  },
  entity: {
    store: mediaWithDetailsStore,
    id: ({ response }) => response.uuid,
    get: ({ id, store }) => store.select(id),
    set: ({ response, store, id }) => store.set(id, response),
  },
});

const x = getMediaByUuidWithDetails.prepare({ pathParams: { uuid: 'ddsa' } });

x.state$.pipe(
  tap((s) => console.log(s)),
  filterSuccess(),
  tap((s) => console.log(s)),
);

const y = getMediaByUuidWithDetails.behaviorSubject();

y.pipe(
  switchQueryState(),
  tap((s) => console.log(s)),
  filterSuccess(),
  tap((s) => console.log(s)),
);

const z = postLogin.prepare({ body: { username: 'test', password: 'test' } });

z.state$.pipe(
  tap((s) => console.log(s)),
  filterSuccess(),
  tap((s) => console.log(s)),
);

const xx = createQueryCollection({ getMediaByUuidWithDetails, getMediaSearchWithDetails });

xx.pipe(
  switchQueryCollectionState(),
  tap((s) => console.log(s)),
  filterSuccess(),
  tap((s) => console.log(s)),
);

getMediaSearchWithDetails2.prepare();
