// Small synchronous key-value storage for window geometry and the pagehide
// quick save. Discord removes window.localStorage, so inside Discord this goes
// through the hub's per-addon storage instead.

export interface KV {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    del(key: string): void;
}

export function localKV(prefix = "hollowmarch."): KV {
    let ls: Storage | null = null;
    try { ls = window.localStorage; ls.getItem("x"); } catch { ls = null; }
    const mem = new Map<string, string>();
    const read = (k: string) => { try { return ls ? ls.getItem(prefix + k) : mem.get(k) ?? null; } catch { return null; } };
    return {
        get(k) { const raw = read(k); if (raw === null) return null; try { return JSON.parse(raw); } catch { return null; } },
        set(k, v) { const raw = JSON.stringify(v); try { if (ls) ls.setItem(prefix + k, raw); else mem.set(k, raw); } catch { /* quota */ } },
        del(k) { try { if (ls) ls.removeItem(prefix + k); else mem.delete(k); } catch { /* ignore */ } },
    };
}

export interface HubStore { load(): unknown; save(obj: unknown): boolean }

/** Keys live under `kv` in the hub's one saved object (next to the card summary). */
export function hubKV(api: HubStore): KV {
    const all = (): Record<string, unknown> => {
        const o = api.load();
        return o && typeof o === "object" ? { ...(o as Record<string, unknown>) } : {};
    };
    const kv = (o: Record<string, unknown>) => (o.kv && typeof o.kv === "object" ? { ...(o.kv as Record<string, unknown>) } : {});
    return {
        get(k) { return kv(all())[k] ?? null; },
        set(k, v) { const o = all(); const m = kv(o); m[k] = v; o.kv = m; api.save(o); },
        del(k) { const o = all(); const m = kv(o); delete m[k]; o.kv = m; api.save(o); },
    };
}
