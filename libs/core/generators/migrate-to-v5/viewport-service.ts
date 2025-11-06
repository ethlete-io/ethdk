import { Tree } from '@nx/devkit';

export default async function migrateViewportService(tree: Tree) {
  // TODO
}

/**
 * ViewportService.isMatched(...) -> injectBreakpointIsMatched(...)
 * ViewportService.getBreakpointSize(...) -> getBreakpointSize(...)
 * ViewportService.currentViewport (getter) -> injectCurrentBreakpoint() (signal read)
 * ViewportService.currentViewport$ -> toObservable(injectCurrentBreakpoint())
 * ViewportService.scrollbarSize (getter) ->  injectScrollbarDimensions() (signal read)
 * ViewportService.scrollbarSize$ -> toObservable(injectViewportDimensions())
 * ViewportService.viewportSize (getter) -> injectViewportDimensions() (signal read)
 * ViewportService.viewportSize$ -> toObservable(injectViewportDimensions())
 * ViewportService.is2Xl (getter) -> injectIs2Xl() (signal read)
 * ViewportService.is2Xl$ -> toObservable(injectIs2Xl())
 * ViewportService.isXl (getter) -> injectIsXl() (signal read)
 * ViewportService.isXl$ -> toObservable(injectIsXl())
 * ViewportService.isLg (getter) -> injectIsLg() (signal read)
 * ViewportService.isLg$ -> toObservable(injectIsLg())
 * ViewportService.isMd (getter) -> injectIsMd() (signal read)
 * ViewportService.isMd$ -> toObservable(injectIsMd())
 * ViewportService.isSm (getter) -> injectIsSm() (signal read)
 * ViewportService.isSm$ -> toObservable(injectIsSm())
 * ViewportService.isXs (getter) -> injectIsXs() (signal read)
 * ViewportService.isXs$ -> toObservable(injectIsXs())
 * ViewportService.observe(...) -> injectObserveBreakpoint(...)
 *
 * Specials:
 * ViewportService.monitorViewport()
 *
 * here we should search all files for --et-vw, --et-vh, --et-sw, --et-sh usage
 *
 *
 * if we find --et-vw or --et-vh usage, we should add:
 * writeViewportSizeToCssVariables();
 *
 * if we find --et-sw or --et-sh usage, we should add:
 * writeScrollbarSizeToCssVariables();
 *
 * ViewportService.monitorViewport() should be removed
 *
 * ###
 *
 * provideViewportConfig(...) -> provideBreakpointObserver(...)
 *
 * if the app config does not contain a provideViewportConfig call, we should add provideBreakpointObserver()
 *
 * ###
 *
 * if a observable from the viewport service was used and wrapped in a toSignal(...) we need to remove the wrapping
 * eg.
 * isAboveSm = toSignal(this._viewportService.observe({ min: 'sm' }));
 * becomes
 * isAboveSm = injectObserveBreakpoint({ min: 'sm' })
 *
 */
