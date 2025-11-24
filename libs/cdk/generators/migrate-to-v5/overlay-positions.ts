import { Tree } from '@nx/devkit';

/**
 * package: @ethlete/cdk
 *
 * inject(OverlayService) -> injectOverlayManager()
 *
 * overlay config positions property was removed, strategies should be used instead
 * applies to overlayService.open({positions:...}), createOverlayHandler({positions:...}) and createOverlayHandlerWithQueryParamLifecycle({positions:...})
 *
 * Mappings:
 * transformingBottomSheetToDialog ->  transformingBottomSheetToDialogOverlayStrategy
 * transformingFullScreenDialogToRightSheet -> transformingFullScreenDialogToRightSheetOverlayStrategy
 * transformingFullScreenDialogToDialog -> transformingFullScreenDialogToDialogOverlayStrategy
 * dialog -> dialogOverlayStrategy
 * fullScreenDialog -> fullScreenDialogOverlayStrategy
 * bottomSheet -> bottomSheetOverlayStrategy
 * topSheet -> topSheetOverlayStrategy
 * leftSheet -> leftSheetOverlayStrategy
 * rightSheet -> rightSheetOverlayStrategy
 * anchoredDialog -> anchoredDialogOverlayStrategy
 *
 * Types
 * OverlayBreakpointConfigEntry -> OverlayStrategyBreakpoint
 */

// Examples

// // Before migration

// class Exammple {
//   private overlayService = inject(OverlayService);

//   openMobileNavWithRouting() {
//     const ref = this.overlayService.open(MobileAppNavigationComponent, {
//       positions: this.overlayService.positions.leftSheet({
//         width: '100%',
//         maxWidth: '35rem',
//         containerClass: 'mobile-admin-nav',
//       }),
//       // ...
//     });
//   }
// }

// // After migration
// class Exammple {
//   private overlayManager = injectOverlayManager();

//   openMobileNavWithRouting() {
//     const ref = this.overlayManager.open(MobileAppNavigationComponent, {
//       strategies: leftSheetOverlayStrategy({
//         width: '100%',
//         maxWidth: '35rem',
//         containerClass: 'mobile-admin-nav',
//       }),
//       // ...
//     });
//   }
// }

// // Before migration
// export const setupMatchOverlayHandlerWithQueryParamLifecycle = createOverlayHandlerWithQueryParamLifecycle<
//   MatchOverlayHostComponent,
//   MatchOverlayHandlerQueryParamValue
// >({
//   component: MatchOverlayHostComponent,
//   positions: (builder) => builder.rightSheet({ maxWidth: 800, dragToDismiss: undefined }),
//   queryParamKey: MATCH_OVERLAY_HANDLER_QUERY_PARAM_KEY,
// });

// // After migration
// export const setupMatchOverlayHandlerWithQueryParamLifecycle = createOverlayHandlerWithQueryParamLifecycle<
//   MatchOverlayHostComponent,
//   MatchOverlayHandlerQueryParamValue
// >({
//   component: MatchOverlayHostComponent,
//   strategies: rightSheetOverlayStrategy({ maxWidth: 800, dragToDismiss: undefined }),
//   queryParamKey: MATCH_OVERLAY_HANDLER_QUERY_PARAM_KEY,
// });

// // Before migration
// export const openCoachingApplicantStatusOverlayHandler = createOverlayHandler<
//   CoachingApplicantStatusOverlayComponent,
//   CoachingApplicantStatusOverlayData,
//   CoachingApplicantStatusOverlayResult
// >({
//   component: CoachingApplicantStatusOverlayComponent,
//   positions: (builder) =>
//     builder.transformingFullScreenDialogToDialog({
//       dialog: { width: '100%', maxWidth: 500, height: '100%', maxHeight: 600, containerClass: 'gg-default-overlay' },
//     }),
// });

// // After migration
// export const openCoachingApplicantStatusOverlayHandler = createOverlayHandler<
//   CoachingApplicantStatusOverlayComponent,
//   CoachingApplicantStatusOverlayData,
//   CoachingApplicantStatusOverlayResult
// >({
//   component: CoachingApplicantStatusOverlayComponent,
//   strategies: transformingFullScreenDialogToDialogOverlayStrategy({
//     dialog: { width: '100%', maxWidth: 500, height: '100%', maxHeight: 600, containerClass: 'gg-default-overlay' },
//   }),
// });

// // Special cases using DEFAULTS

// /**
//  * DEFAULTS contains the following objects
//  * dialog
//  * fullScreenDialog
//  * bottomSheet
//  * topSheet
//  * leftSheet
//  * rightSheet
//  * anchoredDialog
//  */

// // Before migration

// class Exammple {
//   showShortNewsDialog(data: ShortNewsOverlayData) {
//     this._overlayService.open(ShortNewsOverlayComponent, {
//       data,
//       positions: [
//         {
//           config: this._overlayService.positions.DEFAULTS.fullScreenDialog,
//         },
//         {
//           breakpoint: 'md',
//           config: this._overlayService.positions.mergeConfigs(this._overlayService.positions.DEFAULTS.dialog, {
//             maxHeight: 'min(calc(100% - 4rem), 80rem)',
//             maxWidth: 'min(95rem, calc(100vw - 4rem))',
//             width: '100%',
//           }),
//         },
//       ],
//     });
//   }
// }

// // After migration

// class Exammple {
//   showShortNewsDialog(data: ShortNewsOverlayData) {
//     this.overlayManager.open(ShortNewsOverlayComponent, {
//       data,
//       strategies: () => {
//         const fullscreenDialogStrategyProvider = injectFullscreenDialogStrategy();
//         const dialogStrategy = injectDialogStrategy();

//         // Only here for reference
//         // const bottomSheetStrategy = injectBottomSheetStrategy();
//         // const leftSheetStrategy = injectLeftSheetStrategy();
//         // const rightSheetStrategy = injectRightSheetStrategy();
//         // const topSheetStrategy = injectTopSheetStrategy();
//         // const anchoredDialogStrategy = injectAnchoredDialogStrategy();

//         return [
//           {
//             strategy: fullscreenDialogStrategyProvider.build(),
//           },
//           {
//             breakpoint: 'md',
//             strategy: dialogStrategy.build({
//               maxHeight: 'min(calc(100% - 4rem), 80rem)',
//               maxWidth: 'min(95rem, calc(100vw - 4rem))',
//               width: '100%',
//             }),
//           },
//         ];
//       },
//     });
//   }
// }

// // Before migration
// class Exammple {
//   protected openRenameStageOverlay(stage: StageDropElement, origin?: EventOrigin) {
//     const ref = this._overlayService.open<
//       CompetitionSubStageRenameDialogComponent,
//       CompetitionSubStageRenameDialogData,
//       CompetitionSubStagesSelectDialogResult
//     >(CompetitionSubStageRenameDialogComponent, {
//       positions: this._transformingFullscreenDialogToDialog({
//         height: 'min-content',
//         maxWidth: '50rem',
//       }),
//       origin,
//       data: {
//         stage,
//       },
//     });
//   }

//   private _transformingFullscreenDialogToDialog(
//     extraConfig: OverlayBreakpointConfig = {},
//   ): OverlayBreakpointConfigEntry[] {
//     return [
//       {
//         config: this._overlayService.positions.DEFAULTS.fullScreenDialog,
//       },
//       {
//         breakpoint: 'sm',
//         config: this._overlayService.positions.mergeConfigs(
//           this._overlayService.positions.DEFAULTS.dialog,
//           OVERLAY_CONFIG_BELOW_LG,
//           extraConfig,
//         ),
//       },
//       {
//         breakpoint: 'lg',
//         config: this._overlayService.positions.mergeConfigs(
//           this._overlayService.positions.DEFAULTS.dialog,
//           OVERLAY_CONFIG_ABOVE_LG,
//           extraConfig,
//         ),
//       },
//     ];
//   }
// }

// // After migration
// class Exammple {
//   protected openRenameStageOverlay(stage: StageDropElement, origin?: EventOrigin) {
//     const ref = this._overlayService.open<
//       CompetitionSubStageRenameDialogComponent,
//       CompetitionSubStageRenameDialogData,
//       CompetitionSubStagesSelectDialogResult
//     >(CompetitionSubStageRenameDialogComponent, {
//       strategies: this._transformingFullscreenDialogToDialog({
//         height: 'min-content',
//         maxWidth: '50rem',
//       }),
//       origin,
//       data: {
//         stage,
//       },
//     });
//   }

//   private _transformingFullscreenDialogToDialog(
//     extraConfig: OverlayBreakpointConfig = {},
//   ): () => OverlayStrategyBreakpoint[] {
//     return () => {
//       const fullscreenDialogStrategyProvider = injectFullscreenDialogStrategy();
//       const dialogStrategy = injectDialogStrategy();

//       return [
//         {
//           strategy: fullscreenDialogStrategyProvider.build(config),
//         },
//         {
//           breakpoint: 'sm',
//           config: dialogStrategy.build(mergeOverlayBreakpointConfigs(OVERLAY_CONFIG_BELOW_LG, extraConfig)),
//         },
//         {
//           breakpoint: 'lg',
//           config: dialogStrategy.build(mergeOverlayBreakpointConfigs(OVERLAY_CONFIG_ABOVE_LG, extraConfig)),
//         },
//       ];
//     };
//   }
// }

export default async function migrateOverlayPositions(tree: Tree) {
  // TODO
}
