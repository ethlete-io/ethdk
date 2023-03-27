export type EntityKey = string | number;

export type EntityStoreActionResult = {
  type: 'add' | 'update' | 'set' | 'remove';
  key: EntityKey;
};

export interface EntityStoreConfig {
  name: string;
  idKey?: string;
  logActions?: boolean;
}
