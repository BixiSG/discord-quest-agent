// Echoes and sun shards (round 5). Map bosses sometimes leave an echo (an
// unfound one); a pinnacle's first kill leaves its own echo and its shard.
// Every third echo is worth an atlas point, granted through the rewards
// ledger so it is never paid twice.

import { ECHOES, ECHOES_PER_POINT, MAP_ECHOES } from "./data";
import type { Rng } from "./rng";
import type { GameState } from "./state";

/**
 * The three who each took a piece of the sun. The Hollow Crown took none - it
 * ate the light - so its fight is the optional one beyond the Rekindling.
 */
export const SUN_PINNACLES = ["drownedsun", "glasschoir", "ashenking"];
/** Sun shards held: one per sun pinnacle ever killed. */
export const sunShards = (s: GameState) => SUN_PINNACLES.filter(id => (s.pinnacleKills[id] ?? 0) > 0);
export const allShards = (s: GameState) => sunShards(s).length === SUN_PINNACLES.length;

/** Adds an echo if new; pays the atlas points it completes. Returns true if it was new. */
export function grantEcho(s: GameState, id: string): boolean {
    if (!ECHOES[id]) return false;
    s.echoes ??= [];
    if (s.echoes.includes(id)) return false;
    s.echoes.push(id);
    const earned = Math.floor(s.echoes.length / ECHOES_PER_POINT);
    s.world.rewards ??= [];
    for (let k = 1; k <= earned; k++) {
        const key = `echo:${k}`;
        if (!s.world.rewards.includes(key)) { s.world.rewards.push(key); s.atlas.points++; }
    }
    return true;
}

/** A map boss's echo: 3% a kill, an unfound one. Returns its id or null. */
export function rollMapEcho(s: GameState, rng: Rng): string | null {
    const unfound = MAP_ECHOES.filter(id => !(s.echoes ?? []).includes(id));
    if (!unfound.length || !rng.chance(0.03)) return null;
    const id = rng.pick(unfound);
    grantEcho(s, id);
    return id;
}

/** A pinnacle's echo, on its kill (idempotent: later kills find it already known). */
export function pinnacleEcho(s: GameState, pinnacle: string): string | null {
    const e = Object.values(ECHOES).find(x => x.pinnacle === pinnacle);
    return e && grantEcho(s, e.id) ? e.id : null;
}
