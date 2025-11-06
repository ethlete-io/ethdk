export interface QueryErrorList {
  title: string;
  isList: boolean;
  canBeRetried: boolean;
  retryDelay: number;
  items: QueryErrorItem[];
}

export interface QueryErrorItem {
  message: string;
}
