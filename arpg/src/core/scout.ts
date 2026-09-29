// Scouting a pinnacle (round 4): the same simulation, run on a copy of the
// hero a few times with different luck, so "am I ready?" gets an honest
// answer before sigils are spent. Nothing in the real state changes.

import { PINNACLES } from "./data";
import { STEP_MS, step } from "./sim/engine";
import type { GameState } from "./state";

export interface Scout { wins: number; trials: number; /** Average seconds of the won fights. */ seconds: number }

/** Longest fight a scout waits for (sim seconds) before calling it a loss. */
const LIMIT_S = 15 * 60;

export function scoutPinnacle(state: GameState, id: string, trials = 5): Scout {
    const p = PINNACLES[id];
    if (!p) return { wins: 0, trials: 0, seconds: 0 };
    let wins = 0, secs = 0;
    for (let i = 0; i < trials; i++) {
        const s = structuredClone(state) as GameState;
        s.sigils[p.sigil] = p.cost;
        s.activity.pinnacle = id;
        s.activity.mode = "map";
        s.activity.run = null;
        s.activity.autoPush = false;
        s.activity.runIndex = state.activity.runIndex + 1000 + i * 7919; // different luck each time
        let result: "win" | "loss" | null = null;
        const ev = { death: () => { result ??= "loss"; }, runDone: () => { result ??= "win"; } };
        const t0 = s.simTo;
        for (let k = 0; k < LIMIT_S * (1000 / STEP_MS) && !result; k++) { step(s, ev); s.simTo += STEP_MS; }
        if (result === "win") { wins++; secs += (s.simTo - t0) / 1000; }
    }
    return { wins, trials, seconds: wins ? Math.round(secs / wins) : 0 };
}
