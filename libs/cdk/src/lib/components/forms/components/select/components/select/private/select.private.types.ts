export interface SelectKeyHandlerResult<T = unknown> {
  overlayOperation?: 'open' | 'close';
  optionAction?:
    | {
        type: 'add';
        option: T;
      }
    | {
        type: 'remove';
        option: T;
      }
    | {
        type: 'toggle';
        option: T;
      }
    | 'clear'
    | 'toggleAll';
}
