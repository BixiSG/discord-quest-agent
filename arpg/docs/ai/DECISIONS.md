# Decisions

Newest last. Each entry: what, why, what it costs.

## D1 - Branch
The brief asked for `feat/arpg`; this cloud session may only push
`feat/pet-addon-jjbs70`, which already carries the addon hub. All ARPG work
lives in `arpg/` on that branch. Nothing touches `main`.

## D2 - Offline = the same simulation
Offline progress replays the real 100 ms combat step instead of an estimate.
24 h is ~864k steps; with packs of <= 7 monsters that is well under a second
in V8. Cost: catch-up time grows with the cap, so it runs in slices.

## D3 - Plain JSON state
No classes in state, so saves are `JSON.stringify` and migrations are plain
object edits. Cost: helpers are free functions instead of methods.

## D4 - sfc32 RNG
Small, fast, 128-bit state that serialises as four numbers. Runs are seeded
from (save seed, run index) so any run can be replayed in tests.

## D5 - No gem sockets
One main skill plus support slots that open with level. Keeps the build
choice (which supports) without socket colours and links.

## D6 - Name
"Hollowmarch". Original setting and vocabulary; no names borrowed from other
ARPGs (see GDD crafting table).
