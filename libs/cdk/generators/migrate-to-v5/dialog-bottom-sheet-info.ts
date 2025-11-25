// all imports from @ethlete/cdk

// Symbols
// DialogRef, BottomSheetRef -> OverlayRef
// DialogService, BottomSheetService -> OverlayService
// DialogImports, BottomSheetImports -> OverlayImports
// provideDialog, provideBottomSheet -> provideOverlay

// DialogCloseDirective -> OverlayCloseDirective
// DialogTitleDirective, BottomSheetTitleDirective -> OverlayTitleDirective

// DialogConfig, BottomSheetConfig -> OverlayConfig

// BOTTOM_SHEET_DATA, DIALOG_DATA -> OVERLAY_DATA

// BottomSheetDragHandleComponent -> (removed)

// HTML

// et-bottom-sheet-drag-handle, etBottomSheetDragHandle -> (removed)
// et-bottom-sheet-title, etBottomSheetTitle, et-dialog-title, etDialogTitle -> et-overlay-title, etOverlayTitle
// et-dialog-close, etDialogClose -> et-overlay-close, etOverlayClose

// Specials

// dialogService.open(Component, existingConfig) -> overlayService.open(Component, {...existingConfig, strategies: dialogOverlayStrategy() })
// bottomSheetService.open(Component, existingConfig) -> overlayService.open(Component, {...existingConfig, strategies: bottomSheetOverlayStrategy() })

// the following properties if found inside existingConfig need to be moved into the strategy config
// panelClass, containerClass, overlayClass, backdropClass, width, height,minWidth,minHeight,maxWidth,maxHeight, position

// example
// this.dialogService.open(Component, {
//   panelClass: 'my-panel',
//   backdropClass: 'my-backdrop',
//   width: '400px'
//   viewContainerRef: this.viewContainerRef
//   data: { ... }
// })

// becomes
// this.overlayService.open(Component, {
//   viewContainerRef: this.viewContainerRef,
//   data: { ... },
//   strategies: dialogOverlayStrategy({
//     panelClass: 'my-panel',
//     backdropClass: 'my-backdrop',
//     width: '400px'
//   })
// })

// example
// this.bottomSheetService.open(Component, {
//   panelClass: 'my-panel',
//   backdropClass: 'my-backdrop',
//   width: '400px'
//   viewContainerRef: this.viewContainerRef
//   data: { ... }
// })

// becomes
// this.overlayService.open(Component, {
//   viewContainerRef: this.viewContainerRef,
//   data: { ... },
//   strategies: bottomSheetOverlayStrategy({
//     panelClass: 'my-panel',
//     backdropClass: 'my-backdrop',
//     width: '400px'
//   })
// })

// DynamicOverlayService -> OverlayService

// example
// this._dynamicOverlayService.open<WrappedShareOverlayComponent, WrappedShareOverlayData>(
//   WrappedShareOverlayComponent,
//   {
//     isDialogFrom: 'md',
//     bottomSheetConfig: {
//       data: {
//         ...data,
//       },
//       panelClass: 'et-bottom-sheet--no-padding',
//     },
//     dialogConfig: {
//       data: {
//         ...data,
//       },
//       width: '400px',
//       panelClass: 'et-dialog--no-padding',
//     },
//   }
// );

// becomes
// this._overlayService.open<WrappedShareOverlayComponent, WrappedShareOverlayData>(
//   WrappedShareOverlayComponent,
//   {
//     data: {
//       ...data,
//     },
//     strategies: transformingBottomSheetToDialogOverlayStrategy({
//       bottomSheet: {
//         panelClass: 'et-bottom-sheet--no-padding',
//       },
//       dialog: {
//         width: '400px',
//         panelClass: 'et-dialog--no-padding',
//       },
//       breakpoint: 'md',
//     }),
//   }
// );
