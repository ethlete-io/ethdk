export type QueryErrorList = {
  title: string;
  isList: boolean;
  canBeRetried: boolean;
  retryDelay: number;
  items: QueryErrorItem[];
};

export type QueryErrorItem = {
  message: string;
};
