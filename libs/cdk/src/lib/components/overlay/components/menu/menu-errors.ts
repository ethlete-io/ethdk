export function throwMissingPointerFocusTracker() {
  throw Error('expected an instance of PointerFocusTracker to be provided');
}

export function throwMissingMenuReference() {
  throw Error('expected a reference to the parent menu');
}
