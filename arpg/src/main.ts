// Entry point. Placeholder until the UI lands: proves the bundle builds.
import { newGame, sheetOf } from "./core/game";
(globalThis as any).__hollowmarch = { newGame, sheetOf };
