---
'@ethlete/components': patch
---

Touch quality fixes: the overlay body and scrollable containers keep overscroll to
themselves (`overscroll-behavior: contain`), so reaching an end no longer scrolls the
page behind them or triggers pull-to-refresh. Buttons, chips, menu items, select
options, calendar cells and carousel dots drop the grey tap-highlight flash that
duplicated their own `:active` state. Tooltips no longer open from touch input —
mobile browsers synthesize a hover around a tap, which popped a tooltip nobody asked
for — and any open tooltip now closes on a press elsewhere.
