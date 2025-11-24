import { SortDirection } from '@ethlete/query';

export type ArrowViewState = SortDirection | 'hint' | 'active';

export type ArrowViewStateTransition = {
  fromState?: ArrowViewState;
  toState?: ArrowViewState;
};

export type SortHeaderColumnDef = {
  name: string;
};
