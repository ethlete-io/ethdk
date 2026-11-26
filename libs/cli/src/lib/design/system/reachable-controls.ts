/**
 * In-page statements that define `reachableControlsOf(scope, selector, keepHidden)`: the elements of `scope` matching
 * `selector` that a render rule may judge. Subtrees under `[inert]` or `[aria-hidden="true"]` never count; elements
 * under `hidden` or `display: none` are dropped unless `keepHidden` is set, for rules that report them as unreachable.
 */
export const REACHABLE_CONTROLS_STATEMENTS = `
  const reachableControlsOf = (scope, selector, keepHidden) =>
    [...scope.querySelectorAll(selector)].filter((control) => {
      if (control.closest('[inert], [aria-hidden="true"]')) return false;
      if (keepHidden) return true;
      for (let at = control; at && at !== scope.parentElement; at = at.parentElement)
        if (at.hasAttribute('hidden') || getComputedStyle(at).display === 'none') return false;
      return true;
    });
`;
