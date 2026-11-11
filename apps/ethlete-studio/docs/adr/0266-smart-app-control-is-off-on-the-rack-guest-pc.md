---
status: accepted
open: B480
decided: 2026-11-11
source: chat with the doc agent 2026-11-11 (late morning)
---

# Smart App Control is off on the rack guest PC

The Windows CEF spike on `rack` could not build: Smart App Control ran in enforce mode and blocked every unsigned build
binary (cargo build scripts, dart-sass, the swc native module). Windows cannot turn Smart App Control on again without a
reinstall, and a VM was no option, because the human already chose real hardware over a VM for this spike. The choice
was to turn it off on `rack` or to park the spike until the human's PC moves to Windows. The human answered "q1a kannst
du das machen bitte?": turn it off.

The doc agent set `VerifiedAndReputablePolicyState` to 0 and refreshed the policy with `CiTool --refresh` (no reboot);
`Get-MpComputerStatus` then reported `SmartAppControlState: Off`. The spike continues on `rack`. Whether a signed
installer is required on a Windows PC with Smart App Control on stays a measured point of the spike, not a given.
