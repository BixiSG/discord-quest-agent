/*
 * pet.js  -  "Orbling", a pixel pet addon for Discord Quest Agent.
 *
 * NOTE: keep this file pure ASCII, like quest-agent.js: the launcher reads it
 * with PowerShell. Russian and Ukrainian texts live in src/locales/*.json under
 * "pet.*"; the English ones are below and double as the fallback.
 *
 * Registers with the agent's addon hub ("Addons (hub)" in quest-agent.js).
 * Every orb quest the agent finishes drops food for the pet; claiming rewards
 * makes it celebrate. Needs drain by the clock and are recomputed from
 * timestamps whenever the pet is looked at, so nothing runs while nobody's
 * watching except a 5-minute check. The room is a 128x80 pixel canvas shown at
 * 3x, painted only while the view is open.
 */
(() => {
    "use strict";
    const ID = "pet";
    const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
    const W = 128, H = 80, SCALE = 3;

    const STRINGS = {
        "pet.title": "Orbling",
        "pet.desc": "A pixel pet in the panel. Every orb quest the agent finishes feeds it.",
        "pet.stage.egg": "Egg", "pet.stage.baby": "Baby", "pet.stage.child": "Kid", "pet.stage.teen": "Teen", "pet.stage.adult": "Adult",
        "pet.form.classic": "Classic", "pet.form.gourmet": "Gourmet", "pet.form.sprinter": "Sprinter", "pet.form.dapper": "Dapper", "pet.form.astral": "Astral",
        "pet.need.hunger": "Food", "pet.need.fun": "Fun", "pet.need.energy": "Energy", "pet.need.clean": "Clean",
        "pet.act.feed": "Feed", "pet.act.play": "Play", "pet.act.clean": "Clean", "pet.act.nap": "Nap", "pet.act.wake": "Wake",
        "pet.food.berry": "Berries", "pet.food.snack": "Star snack", "pet.food.feast": "Orb feast", "pet.food.cake": "Cake",
        "pet.food.hint": "Star snacks and orb feasts come from quests the agent finishes.",
        "pet.hat.none": "No hat", "pet.hat.bow": "Bow", "pet.hat.party": "Party hat", "pet.hat.beanie": "Beanie",
        "pet.hat.flower": "Flower", "pet.hat.crown": "Crown", "pet.hat.witch": "Witch hat", "pet.hat.cap": "Cap",
        "pet.hats": "Hats", "pet.hat.locked": "Locked: {how}",
        "pet.how.bow": "hatch an egg", "pet.how.party": "grow into a kid", "pet.how.beanie": "a 3-day gift streak",
        "pet.how.flower": "a 7-day gift streak", "pet.how.crown": "grow up", "pet.how.witch": "visit in October", "pet.how.cap": "catch 25 orbs in one game",
        "pet.gift": "Daily gift", "pet.gift.done": "Next gift tomorrow",
        "pet.streak.one": "{n}-day streak", "pet.streak.other": "{n}-day streak",
        "pet.egg.hint": "Tap the egg to keep it warm ({n}/5)",
        "pet.name.prompt": "Name your Orbling", "pet.name.ok": "OK", "pet.rename": "Click to rename",
        "pet.grow": "Ready to grow! Tap {name}.",
        "pet.xp": "{a} / {b} XP", "pet.xp.max": "{a} XP",
        "pet.giftbox": "Quest rewards are waiting. Click the present to claim them.",
        "pet.album": "Album", "pet.album.empty": "Orblings that leave on an adventure end up here.",
        "pet.album.count": "Forms {f}/5, colors {c}/6",
        "pet.album.entry": "{name}, {form}, {days}",
        "pet.days.one": "{n} day", "pet.days.other": "{n} days",
        "pet.adventure": "Send on an adventure",
        "pet.adventure.confirm": "{name} leaves for the album and a new egg arrives. Send {name} off?",
        "pet.adventure.soon": "Adventures open after 3 days as an adult.",
        "pet.adventure.yes": "Yes, off you go", "pet.adventure.no": "Not yet",
        "pet.remind": "Remind me when {name} needs me",
        "pet.remind.title": "{name} needs you",
        "pet.remind.hungry": "{name} is hungry. Quest snacks are waiting in the bag.",
        "pet.remind.bored": "{name} is bored. Time for a quick game?",
        "pet.remind.dirty": "{name}'s room needs cleaning.",
        "pet.msg.yum": "Yum!", "pet.msg.full": "I'm full!", "pet.msg.tired": "Too sleepy to play...",
        "pet.msg.zzz": "Zzz...", "pet.msg.clean": "Squeaky clean!", "pet.msg.spotless": "Already spotless.",
        "pet.msg.notSleepy": "Not sleepy!", "pet.msg.grumpy": "Mmh... five more minutes.",
        "pet.msg.food": "Quest food arrived: {items}!", "pet.msg.claim": "Rewards claimed! +{xp} XP",
        "pet.msg.gift": "Gift: {items}", "pet.msg.hat": "New hat: {hat}!",
        "pet.msg.grew": "{name} grew into a {stage}!", "pet.msg.adult": "{name} became a {form} Orbling!",
        "pet.msg.hatched": "Hello! I'm new here.",
        "pet.play.ball": "Ball", "pet.play.game": "Orb catch", "pet.play.best": "best {n}",
        "pet.play.hint": "Orb catch: move the pointer (or the arrow keys) and catch falling orbs for 20 seconds.",
        "pet.game.live": "{n} caught, {s}s left", "pet.game.end": "Caught {n}!", "pet.game.best": "Caught {n}! New best!",
        "pet.msg.hi1": "Hi!", "pet.msg.hi2": "You're back!", "pet.msg.hi3": "Missed you!", "pet.msg.hi4": "Play with me?"
    };

    // ---- Tuning ---------------------------------------------------------------
    const NEEDS = ["hunger", "fun", "energy", "clean"];
    // Points per hour. A full bar lasts about a day awake; nights are gentle.
    const RATES = {
        awake: { hunger: -4.2, fun: -3.2, energy: -2.6, clean: -1.2 },
        asleep: { hunger: -1.4, fun: -0.4, energy: 14, clean: -0.4 }
    };
    const STAGES = ["egg", "baby", "child", "teen", "adult"];
    const NEXT_XP = { baby: 150, child: 450, teen: 1100 }; // XP to grow out of each stage
    const FOODS = {
        berry: { hunger: 14, fun: 0, xp: 1 },
        snack: { hunger: 30, fun: 8, xp: 12 },
        feast: { hunger: 60, fun: 18, xp: 35 },
        cake: { hunger: 40, fun: 30, xp: 20 }
    };
    const FEAST_ORBS = 500; // quests worth this much drop a feast instead of a snack
    const HATS = ["bow", "party", "beanie", "flower", "crown", "witch", "cap"];
    const GAME_MS = 20e3, GAME_ENERGY = 18, CAP_SCORE = 25;
    const FORMS = ["classic", "gourmet", "sprinter", "dapper", "astral"];
    const NAMES = ["Mochi", "Pip", "Nova", "Bean", "Tofu", "Pixel", "Sprout", "Orbie", "Bubbles", "Momo", "Kiwi", "Nugget", "Luma", "Dot", "Puff", "Zuzu"];
    const ADVENTURE_AFTER = 3 * DAY;
    const FED_KEEP = 120 * DAY; // how long a fed quest is remembered (Discord lists them for ~2 months)

    // ---- Small helpers --------------------------------------------------------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const pad2 = n => String(n).padStart(2, "0");
    const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
    const yesterdayKey = ms => { const d = new Date(ms); d.setDate(d.getDate() - 1); return dayKey(d.getTime()); };
    const isNight = ms => { const h = new Date(ms).getHours(); return h >= 23 || h < 7; };
    let clockShift = 0; // development only: see window.__orbling.shift
    const clock = () => Date.now() + clockShift;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    // ---- Colours --------------------------------------------------------------
    /** "#rrggbb" -> a pixel for a little-endian Uint32 view of ImageData (0xAABBGGRR). */
    const C = h => { const n = parseInt(h.slice(1), 16); return (0xff000000 | (n & 255) << 16 | (n & 0xff00) | (n >> 16 & 255)) >>> 0; };
    const PALETTES = [
        { id: "nova", body: "#8f9bff", shade: "#6b74e8", light: "#c9cfff", line: "#2c2f6b", acc: "#ffd166", cheek: "#ff8fb1" },
        { id: "mint", body: "#7fe0b5", shade: "#4fbf92", light: "#c8f6e1", line: "#1f5a47", acc: "#ff9f6b", cheek: "#ff8fa3" },
        { id: "peach", body: "#ffb691", shade: "#ec8c63", light: "#ffdfcc", line: "#6b3522", acc: "#7fd1ff", cheek: "#ff7a8a" },
        { id: "lilac", body: "#c7a6ff", shade: "#9f78ea", light: "#e8dbff", line: "#45297a", acc: "#9bf0c0", cheek: "#ff8fc8" },
        { id: "sunny", body: "#ffd866", shade: "#f0b232", light: "#fff2bd", line: "#6b4a00", acc: "#ff6b8a", cheek: "#ff8a65" },
        { id: "ghost", body: "#e9edf7", shade: "#b8c1d9", light: "#ffffff", line: "#4a5577", acc: "#b48cff", cheek: "#ffb3d1" } // rare
    ].map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === "id" ? v : C(v)])));
    const RARE = 5; // index of the rare palette
    const K = Object.fromEntries(Object.entries({
        wall: "#34365a", wallDot: "#3e416e", skirt: "#25264a", floor: "#6b4f3f", floorLine: "#5a4133", floorHi: "#7e5e4b", floorShadow: "#523b2f",
        frame: "#1d1e36", star: "#fff6d5", moon: "#fff0b3", moonShade: "#e8d58f", sun: "#ffe066", cloud: "#ffffff", cloudShade: "#dcecff",
        rug: "#8f4a6b", rugEdge: "#b35f86", rugDot: "#cf84a8",
        bedWood: "#7a4f3a", bedDark: "#5c3a2b", cushion: "#e36b8a", cushionHi: "#f59ab2", pillow: "#f7d6e0",
        bowl: "#c9cedb", bowlHi: "#eef1f7", bowlLine: "#6d7385",
        pole: "#2a2b45", shade: "#d99a2b", shadeLit: "#ffe08a",
        pot: "#b5653e", potHi: "#d27e52", leaf: "#4caf6e", leafHi: "#7fd49a",
        picFrame: "#8a6644", picIn: "#232447",
        dark: "#1a1a2e", white: "#ffffff", pink: "#ff8fb1", red: "#f25f5c", redDark: "#b73b3b", yellow: "#ffd166", orange: "#ff9f43",
        purple: "#7b4bd6", purpleDark: "#4d2d93", blue: "#4d7cff", blueLight: "#9db6ff", green: "#4caf6e", brown: "#6b4a2e", brownHi: "#8d6a47",
        cream: "#fff3d6", egg: "#f4efe4", eggShade: "#d9d0bd", eggLine: "#6b6353", gold: "#ffcf40", goldDark: "#c48a00"
    }).map(([k, v]) => [k, C(v)]));
    const SKY = { night: ["#0d1233", "#1d2658"], dawn: ["#ff9f7a", "#ffd9a0"], day: ["#5fb0ff", "#c2e4ff"], dusk: ["#ff8a65", "#6f4fa3"] };
    const SKYC = Object.fromEntries(Object.entries(SKY).map(([k, v]) => [k, v.map(C)]));
    /** Average of two pixels (for the middle band of a dithered gradient). */
    const mixC = (a, b) => (0xff000000 | (((a >> 16 & 255) + (b >> 16 & 255)) >> 1) << 16 | (((a >> 8 & 255) + (b >> 8 & 255)) >> 1) << 8 | ((a & 255) + (b & 255)) >> 1) >>> 0;
    const phaseOf = ms => { const d = new Date(ms), h = d.getHours() + d.getMinutes() / 60; return h >= 22 || h < 6 ? "night" : h < 8 ? "dawn" : h < 18.5 ? "day" : "dusk"; };

    // ---- Sprites (ASCII grids; "." is transparent) ----------------------------
    const SPR = {
        heart: [".r.r.", "rrrrr", ".rrr.", "..r.."],
        zed: ["www", "..w", ".w.", "w..", "www"],
        spark: [".y.", "yyy", ".y."],
        berry: [".g.", "rrr", "rrr"],
        snack: ["..y..", ".yyy.", "yyyyy", ".yyy.", ".y.y."],
        feast: ["..bbb..", ".bwbbb.", ".bbbbb.", "..bbb..", "ccccccc"],
        cake: ["...r...", ".ccccc.", ".ppppp.", ".ccccc.", "nnnnnnn"],
        gift: [".p...p.", "..p.p..", "bbbpbbb", "bbbpbbb", "ppppppp", "bbbpbbb", "bbbpbbb"],
        poop: ["...k...", "..knk..", ".knhnk.", "knnnnhk", ".kkkkk."],
        ball: [".rr.", "rwrr", "rrrr", ".rr."],
        bow: ["rr.rr", "rrkrr", "rr.rr"],
        party: ["..y..", "..r..", ".rwr.", ".wrw.", "rwrwr"],
        beanie: ["...www...", ".bbbbbbb.", "bbbbbbbbb", "wwwwwwwww"],
        flower: ["..p..", ".pyp.", "..p..", "..g.."],
        crown: ["y..y..y", "yy.y.yy", "yyyyyyy", "yryyyry"],
        cap: ["..bbbb..", ".bbwbbb.", "bbbbbbbbbb"],
        orb: [".yyy.", "yywyy", "yyyyy", ".yyy."],
        witch: ["....pp..", "...ppp..", "...ppp..", "..ppppp.", "..ooooo.", "ppppppppp"],
        bowtie: ["rr.rr", "rrkrr", "rr.rr"],
        bolt: ["..a", ".aa", "aa.", "a.."]
    };
    const POOP_MAP = { k: C("#2a1a12"), n: C("#8a5530"), h: C("#c08850") };
    const SPR_MAP = { r: K.red, w: K.white, y: K.yellow, g: K.green, b: K.blue, c: K.cream, p: K.pink, n: K.brown, h: K.brownHi, k: K.redDark, o: K.orange };
    const HAT_MAP = { ...SPR_MAP, p: K.purple, o: K.orange, y: K.gold, b: K.blue };

    // ---- Framebuffer ----------------------------------------------------------
    function makeFB(ctx, w, h) {
        const img = ctx.createImageData(w, h), buf = new Uint32Array(img.data.buffer);
        const fb = {
            w, h, buf,
            px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = c; },
            rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) fb.px(x + i, y + j, c); },
            sprite(rows, x, y, map, flip) {
                for (let j = 0; j < rows.length; j++) {
                    const row = rows[j];
                    for (let i = 0; i < row.length; i++) {
                        const c = map[row[flip ? row.length - 1 - i : i]];
                        if (c != null) fb.px(x + i, y + j, c);
                    }
                }
            },
            /** Filled ellipse; with pal, an outlined and shaded body lit from the top left. */
            blob(cx, cy, rx, ry, pal, flat) {
                const inside = (x, y) => { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; };
                for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
                    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
                        if (!inside(x, y)) continue;
                        if (flat != null) { fb.px(x, y, flat); continue; }
                        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
                        let c = pal.body;
                        if (edge) c = pal.line;
                        else {
                            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                            if (dx * 0.55 + dy * 0.85 > 0.52) c = pal.shade;
                            else if (rx >= 4 && (dx + 0.42) ** 2 + (dy + 0.5) ** 2 < 0.028) c = pal.light; // no highlight on ears and feet
                        }
                        fb.px(x, y, c);
                    }
                }
            },
            flush() { ctx.putImageData(img, 0, 0); }
        };
        return fb;
    }

    // ---- State ----------------------------------------------------------------
    function rollPalette(album) {
        if (Math.random() < 1 / 12) return RARE;
        const have = new Set((album ?? []).map(a => a.pal));
        const fresh = [0, 1, 2, 3, 4].filter(i => !have.has(i));
        return pick(fresh.length ? fresh : [0, 1, 2, 3, 4]);
    }
    function freshState(now) {
        return {
            v: 1, since: now, born: now, name: "", pal: rollPalette([]), stage: "egg", form: null, xp: 0, ready: false,
            n: { hunger: 80, fun: 80, energy: 90, clean: 100 }, last: now, poops: 0, poopAt: 0, napUntil: 0, wokeAt: 0,
            inv: { snack: 2, feast: 1, cake: 0 }, // a welcome basket
            care: { feed: 0, play: 0, clean: 0, pat: 0, feasts: 0 },
            patDay: "", patXp: 0, warm: 0, gift: { day: "", streak: 0, best: 0 }, hats: [], hat: "",
            album: [], fed: {}, adultAt: 0, remind: true, lastRemind: 0, plays: 0, news: [], named: false, best: 0
        };
    }
    /** Fill gaps and clamp whatever came out of storage. */
    function normalize(raw, now) {
        const s = freshState(now);
        if (!raw || typeof raw !== "object" || raw.v !== 1) return s;
        const num = (v, d, a, b) => Number.isFinite(v) ? clamp(v, a, b) : d;
        Object.assign(s, {
            since: num(raw.since, now, 0, now), born: num(raw.born, now, 0, now), last: num(raw.last, now, 0, now),
            name: typeof raw.name === "string" ? raw.name.slice(0, 16) : "", named: !!raw.named,
            pal: num(raw.pal, s.pal, 0, PALETTES.length - 1) | 0, stage: STAGES.includes(raw.stage) ? raw.stage : "egg",
            form: FORMS.includes(raw.form) ? raw.form : null, xp: num(raw.xp, 0, 0, 1e9), ready: !!raw.ready,
            poops: num(raw.poops, 0, 0, 3) | 0, poopAt: num(raw.poopAt, 0, 0, 1e15), napUntil: num(raw.napUntil, 0, 0, 1e15),
            wokeAt: num(raw.wokeAt, 0, 0, 1e15), patDay: typeof raw.patDay === "string" ? raw.patDay : "", patXp: num(raw.patXp, 0, 0, 99),
            warm: num(raw.warm, 0, 0, 5) | 0, adultAt: num(raw.adultAt, 0, 0, 1e15), remind: raw.remind !== false,
            lastRemind: num(raw.lastRemind, 0, 0, 1e15), plays: num(raw.plays, 0, 0, 1e9) | 0, best: num(raw.best, 0, 0, 9999) | 0,
            hat: HATS.includes(raw.hat) ? raw.hat : ""
        });
        for (const k of NEEDS) s.n[k] = num(raw.n?.[k], s.n[k], 0, 100);
        for (const k of ["snack", "feast", "cake"]) s.inv[k] = num(raw.inv?.[k], 0, 0, 9999) | 0;
        for (const k of Object.keys(s.care)) s.care[k] = num(raw.care?.[k], 0, 0, 1e9) | 0;
        if (raw.gift && typeof raw.gift === "object") s.gift = { day: String(raw.gift.day ?? ""), streak: num(raw.gift.streak, 0, 0, 1e6) | 0, best: num(raw.gift.best, 0, 0, 1e6) | 0 };
        if (Array.isArray(raw.hats)) s.hats = raw.hats.filter(h => HATS.includes(h));
        if (Array.isArray(raw.album)) s.album = raw.album.filter(a => a && FORMS.includes(a.form)).slice(-200)
            .map(a => ({ name: String(a.name ?? "").slice(0, 16), form: a.form, pal: num(a.pal, 0, 0, PALETTES.length - 1) | 0, days: num(a.days, 1, 1, 1e5) | 0 }));
        if (raw.fed && typeof raw.fed === "object") for (const [k, v] of Object.entries(raw.fed)) {
            if (Array.isArray(v) && (v[0] === 1 || v[0] === 2)) s.fed[k] = [v[0], num(v[1], now, 0, now)];
        }
        if (Array.isArray(raw.news)) s.news = raw.news.filter(x => typeof x === "string").slice(-4);
        if (s.hat && !s.hats.includes(s.hat)) s.hat = "";
        return s;
    }

    const asleepAt = (s, t) => s.stage !== "egg" && ((s.napUntil && t < s.napUntil) || (isNight(t) && !(s.wokeAt && t < s.wokeAt + 30 * MIN)));
    const mood = s => (s.n.hunger + s.n.fun + s.n.energy + s.n.clean) / 4 - 8 * s.poops;
    function gainXp(s, x) {
        s.xp += x;
        if (NEXT_XP[s.stage] && s.xp >= NEXT_XP[s.stage]) s.ready = true;
    }
    /** Let the clock run from s.last to now: needs drain (slowly at night), poops appear, a thriving pet earns a little XP. */
    function advance(s, now) {
        if (s.stage === "egg" || now <= s.last) { s.last = Math.max(s.last, now); return; } // an egg just waits
        let t = s.last;
        while (t < now) {
            const step = Math.min(now - t, 10 * MIN), h = step / HOUR;
            const sleeping = asleepAt(s, t), r = sleeping ? RATES.asleep : RATES.awake;
            for (const k of NEEDS) s.n[k] = clamp(s.n[k] + r[k] * h, 0, 100);
            if (s.poopAt && t + step >= s.poopAt) {
                if (s.poops < 3) { s.poops++; s.n.clean = clamp(s.n.clean - 12, 0, 100); }
                s.poopAt = 0;
            }
            if (!sleeping && mood(s) >= 60) gainXp(s, 3 * h);
            if (s.napUntil && s.n.energy >= 100) s.napUntil = 0; // woke up rested
            t += step;
        }
        s.last = now;
    }
    function addHat(s, hat, news) {
        if (!HATS.includes(hat) || s.hats.includes(hat)) return false;
        s.hats.push(hat);
        if (news) news.push(["hat", hat]);
        return true;
    }
    /** Quest food and claim celebrations from what Discord lists. Returns news items. */
    function reconcile(s, api) {
        const news = [];
        let list;
        try { list = api.completions(); } catch (e) { return news; }
        // Right after Discord starts, its quest list is still empty: nothing to learn yet.
        if (!list.length) return news;
        let snack = 0, feast = 0, claimed = 0;
        const now = clock();
        for (const c of list) {
            let v = s.fed[c.id]?.[0] ?? 0;
            if (!v && c.at && c.at >= s.since) { if (c.orbs >= FEAST_ORBS) feast++; else snack++; v = 1; }
            if (v === 1 && c.claimed) { claimed++; v = 2; }
            if (v) s.fed[c.id] = [v, s.fed[c.id]?.[1] ?? now];
        }
        // Remember a quest well past the time Discord could still list it, then let it go.
        for (const [id, [, at]] of Object.entries(s.fed)) if (now - at > FED_KEEP) delete s.fed[id];
        if (snack || feast) { s.inv.snack += snack; s.inv.feast += feast; news.push(["food", { snack, feast }]); }
        if (claimed && s.stage !== "egg") { gainXp(s, 15 * claimed); s.n.fun = clamp(s.n.fun + 8 * claimed, 0, 100); news.push(["claim", 15 * claimed]); }
        return news;
    }
    function seasonal(s, now, news) {
        if (new Date(now).getMonth() === 9) addHat(s, "witch", news); // October
    }
    const giftReady = (s, now) => s.stage !== "egg" && s.gift.day !== dayKey(now);
    function openGift(s, now, news) {
        s.gift.streak = s.gift.day === yesterdayKey(now) ? s.gift.streak + 1 : 1;
        s.gift.day = dayKey(now);
        s.gift.best = Math.max(s.gift.best, s.gift.streak);
        const got = { snack: 1, feast: s.gift.streak % 3 === 0 ? 1 : 0, cake: s.gift.streak % 7 === 0 ? 1 : 0 };
        for (const k of Object.keys(got)) s.inv[k] += got[k];
        gainXp(s, 10);
        if (s.gift.streak >= 3) addHat(s, "beanie", news);
        if (s.gift.streak >= 7) addHat(s, "flower", news);
        return got;
    }
    function chooseForm(c) {
        if (c.feasts >= 6) return "astral";
        const score = [["gourmet", c.feed], ["sprinter", c.play * 1.6], ["dapper", c.clean * 2 + c.pat * 0.3]].sort((a, b) => b[1] - a[1]);
        return !score[0][1] || score[0][1] < score[1][1] * 1.15 ? "classic" : score[0][0];
    }
    function evolve(s, now, news) {
        s.stage = STAGES[STAGES.indexOf(s.stage) + 1];
        s.ready = false;
        if (s.stage === "child") { s.care = { feed: 0, play: 0, clean: 0, pat: 0, feasts: 0 }; addHat(s, "party", news); }
        if (s.stage === "adult") { s.form = chooseForm(s.care); s.adultAt = now; addHat(s, "crown", news); }
        if (NEXT_XP[s.stage] && s.xp >= NEXT_XP[s.stage]) s.ready = true;
    }
    function adventure(s, now) {
        s.album.push({ name: s.name || "?", form: s.form ?? "classic", pal: s.pal, days: Math.max(1, Math.round((now - s.born) / DAY)) });
        const keep = { album: s.album, hats: s.hats, hat: s.hat, gift: s.gift, remind: s.remind, inv: s.inv, fed: s.fed, since: s.since, lastRemind: s.lastRemind, plays: s.plays, best: s.best };
        Object.assign(s, freshState(now), keep);
        s.pal = rollPalette(s.album);
    }
    /** Something worth a dot on the title-bar button. */
    const needsCare = (s, now) => s.stage === "egg" || s.ready || giftReady(s, now) || s.poops > 0 || s.n.hunger < 30 || s.n.fun < 25 || (!s.named && s.stage !== "egg");

    // ---- Drawing: the room ----------------------------------------------------
    const BED_X = 111, BOWL_X = 22, FLOOR_Y = 56, BASE_Y = 72, POOP_X = [36, 56, 88];
    function drawRoom(fb, now, t, s, view) {
        const phase = phaseOf(now);
        // wall with a dotted paper
        fb.rect(0, 0, W, FLOOR_Y, K.wall);
        for (let y = 4; y < FLOOR_Y - 4; y += 8) for (let x = (y / 8) % 2 ? 4 : 8; x < W; x += 8) fb.px(x, y, K.wallDot);
        fb.rect(0, FLOOR_Y - 2, W, 2, K.skirt);
        // window: sky by the PC clock
        const wx = 8, wy = 8, ww = 28, wh = 24;
        fb.rect(wx - 2, wy - 2, ww + 4, wh + 4, K.frame);
        // five solid sky bands, with a checkered seam row between neighbours
        const [top, bottom] = SKYC[phase], mid = mixC(top, bottom);
        const bands = [top, mixC(top, mid), mid, mixC(mid, bottom), bottom], bh = Math.ceil(wh / bands.length);
        for (let y = 0; y < wh; y++) {
            const b = Math.min(bands.length - 1, Math.floor(y / bh)), seam = y % bh === bh - 1 && b < bands.length - 1;
            for (let x = 0; x < ww; x++) fb.px(wx + x, wy + y, seam && (x + y) & 1 ? bands[b + 1] : bands[b]);
        }
        // anything in the sky is clipped to the glass
        const disc = (cx, cy, rx, ry, c) => {
            for (let y = Math.max(wy, Math.floor(cy - ry)); y <= Math.min(wy + wh - 1, Math.ceil(cy + ry)); y++)
                for (let x = Math.max(wx, Math.floor(cx - rx)); x <= Math.min(wx + ww - 1, Math.ceil(cx + rx)); x++) {
                    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                    if (dx * dx + dy * dy <= 1) fb.px(x, y, c);
                }
        };
        if (phase === "night") {
            const stars = [[3, 3], [11, 6], [20, 2], [6, 14], [16, 11], [24, 17], [2, 20], [13, 19]];
            stars.forEach(([x, y], i) => { if ((Math.floor(t / 700) + i) % 5) fb.px(wx + x, wy + y, K.star); });
            disc(wx + 21, wy + 6, 3.5, 3.5, K.moon); fb.px(wx + 22, wy + 5, K.moonShade); fb.px(wx + 20, wy + 7, K.moonShade);
        } else if (phase === "day") {
            disc(wx + 22, wy + 5, 3, 3, K.sun);
            const cx = wx + ((t / 400) % (ww + 16)) - 8;
            for (const [dx, dy, r] of [[0, 15, 2.5], [3, 14, 3], [6, 15, 2.5]]) disc(cx + dx, wy + dy, r, 2, K.cloud);
        } else { // a low sun sitting on the horizon
            disc(wx + (phase === "dawn" ? 7 : 20), wy + wh + 1, 5, 5, phase === "dawn" ? K.sun : K.orange);
            disc(wx + (phase === "dawn" ? 7 : 20), wy + wh + 1, 3, 3, K.cream);
        }
        fb.rect(wx + ww / 2 - 1, wy, 2, wh, K.frame); fb.rect(wx, wy + wh / 2 - 1, ww, 2, K.frame);
        fb.rect(wx - 3, wy + wh + 2, ww + 6, 2, K.bedDark); // sill
        // a framed orb on the wall
        fb.rect(58, 12, 14, 12, K.picFrame); fb.rect(60, 14, 10, 8, K.picIn);
        for (const [x, y] of [[65, 15], [64, 16], [66, 16], [63, 17], [67, 17], [64, 18], [66, 18], [65, 19]]) fb.px(x, y, K.gold);
        fb.px(65, 17, K.cream);
        // floor planks
        fb.rect(0, FLOOR_Y, W, H - FLOOR_Y, K.floor);
        fb.rect(0, FLOOR_Y, W, 1, K.floorHi);
        for (const y of [62, 69, 76]) fb.rect(0, y, W, 1, K.floorLine);
        for (let i = 0; i < 12; i++) fb.px((i * 23 + (i % 3) * 7) % W, 62 + (i % 3) * 7 + 3, K.floorLine);
        // rug
        fb.blob(64, 71, 26, 5.5, null, K.rugEdge); fb.blob(64, 71, 24, 4.5, null, K.rug);
        for (let x = 44; x <= 84; x += 5) fb.px(x, 71, K.rugDot);
        // plant
        fb.rect(86, 50, 8, 7, K.pot); fb.rect(86, 50, 8, 1, K.potHi); fb.rect(85, 49, 10, 2, K.potHi);
        for (const [x, y, c] of [[88, 44, 0], [90, 42, 1], [92, 45, 0], [87, 47, 1], [91, 47, 0], [89, 40, 1], [93, 43, 1]]) fb.rect(x, y, 2, 3, c ? K.leafHi : K.leaf);
        // lamp: lights up in the evening
        const lit = phase === "night" || phase === "dusk";
        fb.rect(44, 28, 2, 28, K.pole); fb.rect(41, 55, 8, 2, K.pole);
        for (let i = 0; i < 6; i++) fb.rect(40 + (5 - i) / 2, 22 + i, 10 - (5 - i), 1, lit ? K.shadeLit : K.shade);
        // bed
        fb.rect(98, 64, 27, 8, K.bedWood); fb.rect(98, 71, 27, 1, K.bedDark); fb.rect(98, 58, 3, 14, K.bedDark); fb.rect(122, 60, 3, 12, K.bedDark);
        fb.rect(101, 61, 21, 4, K.cushion); fb.rect(101, 61, 21, 1, K.cushionHi); fb.rect(116, 58, 6, 3, K.pillow);
        // food bowl
        fb.rect(BOWL_X - 6, 69, 12, 3, K.bowl); fb.rect(BOWL_X - 7, 68, 14, 1, K.bowlHi); fb.rect(BOWL_X - 5, 72, 10, 1, K.bowlLine);
        if (view.bowl) fb.sprite(SPR[view.bowl] ?? SPR.berry, BOWL_X - 3, 64, SPR_MAP);
        // rewards waiting on the Quests page: a present that bobs
        if (view.giftBox) fb.sprite(SPR.gift, 72, 63 - (Math.floor(t / 400) % 2), SPR_MAP);
        for (let i = 0; i < s.poops; i++) fb.sprite(SPR.poop, POOP_X[i] - 3, 69, POOP_MAP);
        if (view.ball) fb.sprite(SPR.ball, Math.round(view.ball.x) - 2, Math.round(view.ball.y) - 4, SPR_MAP);
    }
    function nightShade(ctx, now) {
        const phase = phaseOf(now);
        const a = { night: 0.42, dusk: 0.18, dawn: 0.1, day: 0 }[phase];
        if (!a) return;
        ctx.fillStyle = `rgba(8,10,34,${a})`;
        ctx.fillRect(0, 0, W, H);
        if (phase === "night" || phase === "dusk") { // lamp glow
            const g = ctx.createRadialGradient(45, 30, 2, 45, 40, 34);
            g.addColorStop(0, "rgba(255,214,120,0.30)"); g.addColorStop(1, "rgba(255,214,120,0)");
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
    }

    // ---- Drawing: the Orbling -------------------------------------------------
    const BODY = { baby: [9, 8], child: [11, 10], teen: [12.5, 11.5], adult: [14, 13] };
    /**
     * p: { x, base, stage, form, pal, hat, eyes, mouth, look, squash, lift, blush, step, glow }
     * Returns the hit box { x0, y0, x1, y1 }.
     */
    function drawOrbling(fb, p) {
        const pal = PALETTES[p.pal] ?? PALETTES[0];
        if (p.stage === "egg") return drawEgg(fb, p, pal);
        let [rx, ry] = BODY[p.stage] ?? BODY.baby;
        const sq = p.squash ?? 0;
        rx *= 1 + sq; ry *= 1 - sq;
        const hasFeet = p.stage !== "baby";
        const bottom = p.base - (p.lift ?? 0) - (hasFeet ? 1 : 0);
        const cx = Math.round(p.x), cy = bottom - ry, top = Math.round(cy - ry);
        const dir = p.dir ?? 1;
        // shadow on the floor, smaller while in the air
        if (!p.noShadow) fb.blob(cx, p.base + 0.5, Math.max(3, rx * (1 - (p.lift ?? 0) / 16)), 1.6, null, K.floorShadow);
        // behind the body: ears, tail, horns
        const adult = p.stage === "adult", form = adult ? p.form : null;
        if (p.stage !== "baby") {
            const long = form === "sprinter";
            const er = long ? [2.2, 6] : p.stage === "child" ? [2, 3] : [2.4, 3.6];
            for (const s of [-1, 1]) fb.blob(cx + s * rx * (long ? 0.42 : 0.55), cy - ry * (long ? 1.05 : 0.78), er[0], er[1], pal);
        }
        if (p.stage === "teen" || (adult && form !== "dapper")) { // a stubby tail that curls up, tucked behind the body
            fb.blob(cx - dir * (rx - 0.5), bottom - 4, 3, 2.2, pal);
            fb.blob(cx - dir * (rx + 1.5), bottom - 6.5, 1.8, 1.8, pal);
        }
        if (form === "classic") for (const s of [-1, 1]) fb.sprite(["l.", "ll", "ll"].map(r => r.replace(/l/g, "q")), cx + s * 5 - (s < 0 ? 1 : 0), top - 2, { q: pal.light }, s > 0);
        // feet, body
        if (hasFeet) {
            const lift = p.step ?? 0;
            fb.blob(cx - rx * 0.45, bottom + 0.5 - (lift === 1 ? 1 : 0), 2.6, 1.7, pal);
            fb.blob(cx + rx * 0.45, bottom + 0.5 - (lift === 2 ? 1 : 0), 2.6, 1.7, pal);
        }
        fb.blob(cx, cy, rx, ry, pal);
        if (form === "gourmet") fb.blob(cx, cy + ry * 0.38, rx * 0.55, ry * 0.42, null, pal.light);
        if (form === "sprinter") fb.sprite(SPR.bolt, cx - 2, Math.round(cy + ry * 0.42), { a: pal.acc });
        if (form === "astral") for (const [dx, dy] of [[-0.5, 0.3], [0.45, 0.45], [0.1, 0.62], [-0.2, -0.55], [0.55, -0.1]]) fb.px(cx + dx * rx, cy + dy * ry, K.white);
        if (p.glow) fb.blob(cx, cy, rx, ry, null, K.white);
        // face
        if (!p.glow) drawFace(fb, p, pal, cx, cy, rx, ry);
        // on top: sprout, tuft, bow tie, halo, hat
        if (p.stage === "baby") { fb.px(cx, top - 1, K.green); fb.px(cx, top - 2, K.green); fb.px(cx + 1, top - 3, K.leafHi); fb.px(cx + 2, top - 3, K.green); fb.px(cx + 1, top - 2, K.leafHi); }
        if (form === "dapper") { fb.px(cx - 1, top - 1, pal.line); fb.px(cx, top - 2, pal.line); fb.px(cx + 1, top - 1, pal.line); fb.sprite(SPR.bowtie, cx - 2, Math.round(cy + ry * 0.55), SPR_MAP); }
        if (form === "astral") { for (let i = -5; i <= 5; i++) { fb.px(cx + i, top - 4 - (Math.abs(i) < 4 ? 1 : 0), K.gold); } fb.px(cx - 6, top - 3, K.goldDark); fb.px(cx + 6, top - 3, K.goldDark); }
        if (p.hat && SPR[p.hat]) { const hs = SPR[p.hat]; fb.sprite(hs, cx - Math.floor(hs[0].length / 2), top - hs.length + 2, HAT_MAP); }
        return { x0: cx - rx - 2, y0: top - 6, x1: cx + rx + 2, y1: p.base + 1 };
    }
    function drawFace(fb, p, pal, cx, cy, rx, ry) {
        const ex = Math.round(rx * 0.42), eyeY = Math.round(cy - ry * 0.18), look = p.look ?? 0;
        const lx = cx - ex - 1 + look, rxe = cx + ex - 1 + look, small = p.stage === "baby";
        const dark = K.dark;
        const eye = x => {
            switch (p.eyes) {
                case "blink": fb.rect(x, eyeY + (small ? 1 : 2), 2, 1, dark); break;
                case "sleep": fb.rect(x - 1 + (x > cx ? 1 : 0), eyeY + 1, 3, 1, dark); break;
                case "happy": fb.px(x, eyeY + 1, dark); fb.px(x + 1, eyeY, dark); fb.px(x + 2, eyeY + 1, dark); break;
                case "sad":
                    fb.rect(x, eyeY + 1, 2, small ? 1 : 2, dark);
                    if (x < cx) { fb.px(x, eyeY - 1, dark); fb.px(x + 1, eyeY - 2, dark); } else { fb.px(x, eyeY - 2, dark); fb.px(x + 1, eyeY - 1, dark); }
                    break;
                default:
                    fb.rect(x, eyeY, 2, small ? 2 : 3, dark);
                    fb.px(x, eyeY, K.white);
            }
        };
        eye(lx); eye(rxe);
        const my = eyeY + (small ? 3 : 4) + (p.eyes === "sad" ? 1 : 0), mx = cx + look;
        switch (p.mouth) {
            case "open": fb.rect(mx - 1, my, 2, 2, dark); fb.px(mx, my + 1, K.pink); break;
            case "flat": fb.rect(mx - 1, my + 1, 2, 1, dark); break;
            case "o": fb.px(mx - 1, my, dark); fb.px(mx, my, dark); fb.px(mx - 1, my + 1, dark); fb.px(mx, my + 1, dark); break;
            case "none": break;
            default: fb.px(mx - 2, my, dark); fb.px(mx - 1, my + 1, dark); fb.px(mx, my + 1, dark); fb.px(mx + 1, my, dark);
        }
        if (p.blush || p.form === "gourmet") {
            const w = p.form === "gourmet" ? 3 : 2;
            fb.rect(lx - 1 - (w - 2), eyeY + (small ? 2 : 4), w, 1, pal.cheek);
            fb.rect(rxe + 1, eyeY + (small ? 2 : 4), w, 1, pal.cheek);
        }
    }
    function drawEgg(fb, p, pal) {
        const cx = Math.round(p.x) + (p.wobble ?? 0), rx = 6.5, ry = 8.5, cy = p.base - ry;
        fb.blob(cx, p.base + 0.5, 5, 1.5, null, K.floorShadow);
        const egg = { body: K.egg, shade: K.eggShade, light: K.white, line: K.eggLine };
        const inside = (x, y) => { const dy = (y + 0.5 - cy) / ry, r = rx * (dy < 0 ? 1 + dy * 0.22 : 1), dx = (x + 0.5 - cx) / r; return dx * dx + dy * dy <= 1; };
        for (let y = Math.floor(cy - ry - 1); y <= p.base + 1; y++) for (let x = cx - 9; x <= cx + 9; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            fb.px(x, y, edge ? egg.line : dx * 0.5 + dy * 0.8 > 0.45 ? egg.shade : egg.body);
        }
        for (const [dx, dy] of [[-3, -4], [2, -1], [-1, 3], [3, 4], [-4, 1]]) { fb.px(cx + dx, cy + dy, pal.body); fb.px(cx + dx + 1, cy + dy, pal.body); }
        const cracks = [[[-2, -2], [-1, -1], [0, -2], [1, -1]], [[1, 1], [2, 0], [3, 1]], [[-4, 2], [-3, 3], [-2, 2]], [[0, 5], [1, 4], [2, 5]], [[-1, -5], [0, -6], [1, -5]]];
        for (let i = 0; i < Math.min(p.warm ?? 0, cracks.length); i++) for (const [dx, dy] of cracks[i]) fb.px(cx + dx, cy + dy, egg.line);
        return { x0: cx - 8, y0: cy - ry - 2, x1: cx + 8, y1: p.base + 1 };
    }

    // ---- The addon ------------------------------------------------------------
    let S = null, API = null, checkTimer = null, offQuests = null, VIEW = null;
    const T = (k, p) => API.t(k, p);
    /** Save, and update the attention dot (the hub redraws it). */
    const commit = () => { save(); if (S && API) API.attention(needsCare(S, clock())); };
    const nameOf = () => S?.name || T("title");
    const save = () => { if (S && API) API.save(S); };
    function load(api, now) {
        S = normalize(api.load(), now);
        advance(S, now);
        return S;
    }
    function itemsText(items) {
        return Object.entries(items).filter(([, n]) => n > 0).map(([k, n]) => `${T("food." + k)} \u00d7${n}`).join(", ");
    }
    /** Turn news items into speech-bubble lines (shown when the view opens). */
    function newsText(n) {
        switch (n[0]) {
            case "food": return T("msg.food", { items: itemsText(n[1]) });
            case "claim": return T("msg.claim", { xp: n[1] });
            case "hat": return T("msg.hat", { hat: T("hat." + n[1]) });
            default: return "";
        }
    }
    /** The 5-minute background check: clock, quest food, attention dot, the occasional reminder. */
    function check() {
        if (!S || !API) return;
        const now = clock();
        advance(S, now);
        const news = reconcile(S, API);
        seasonal(S, now, news);
        const lines = news.map(newsText).filter(Boolean);
        if (VIEW) VIEW.news(lines); else S.news = [...S.news, ...lines].slice(-4);
        API.attention(needsCare(S, now));
        if (S.remind && S.stage !== "egg" && !API.visible() && !isNight(now) && now - S.lastRemind > 8 * HOUR) {
            const why = S.n.hunger < 20 ? "hungry" : S.n.fun < 15 ? "bored" : S.poops >= 2 ? "dirty" : null;
            if (why) { S.lastRemind = now; API.notify(T("remind.title", { name: nameOf() }), T("remind." + why, { name: nameOf() })); }
        }
        save();
        if (VIEW) VIEW.refresh();
    }
    function init(api) {
        API = api;
        load(api, clock());
        offQuests = api.on("quests", () => check());
        checkTimer = setInterval(check, 5 * MIN);
        check();
    }
    function destroy() {
        clearInterval(checkTimer); checkTimer = null;
        offQuests?.(); offQuests = null;
        API?.attention(false);
        save();
        S = null; API = null;
    }

    // ---- The view -------------------------------------------------------------
    const ICONS = {
        paw: "M7.2 9.6c-1.2 0-2.1-1.2-2.1-2.6s.9-2.6 2.1-2.6 2.1 1.2 2.1 2.6-.9 2.6-2.1 2.6Zm9.6 0c-1.2 0-2.1-1.2-2.1-2.6s.9-2.6 2.1-2.6 2.1 1.2 2.1 2.6-.9 2.6-2.1 2.6ZM4.1 14.2c-1 0-1.8-1-1.8-2.3s.8-2.3 1.8-2.3 1.8 1 1.8 2.3-.8 2.3-1.8 2.3Zm15.8 0c-1 0-1.8-1-1.8-2.3s.8-2.3 1.8-2.3 1.8 1 1.8 2.3-.8 2.3-1.8 2.3ZM12 11.8c3.1 0 6.1 3.6 6.1 6.3 0 1.8-1.4 2.8-3 2.8-1.2 0-2-.6-3.1-.6s-1.9.6-3.1.6c-1.6 0-3-1-3-2.8 0-2.7 3-6.3 6.1-6.3Z",
        hunger: "M15.5 3.5c-2 0-3.1 1.1-3.5 2.1-.4-1-1.5-2.1-3.5-2.1C5.8 3.5 4 5.9 4 9c0 5.2 5.5 10 8 11.5 2.5-1.5 8-6.3 8-11.5 0-3.1-1.8-5.5-4.5-5.5Z",
        fun: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9L12 2.5Z",
        energy: "M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z",
        clean: "M12 2.5c3.5 4.3 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.7 6-11Z",
        gift: "M4 10h16v3H4v-3Zm1 3h14v8H5v-8Zm6-3h2v11h-2V10ZM12 9c-1-3-5-4-5-1.5C7 9 9.5 9 12 9Zm0 0c1-3 5-4 5-1.5C17 9 14.5 9 12 9Z"
    };
    const icon = (d, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
    const CSS = `
#qb-panel .pt{padding:7px 7px 10px;font-size:12.5px}
#qb-panel .pt-stage{position:relative;width:384px;height:240px;border-radius:8px;overflow:hidden;background:#1d1e36;
 box-shadow:0 0 0 2px #0c0d18,4px 4px 0 2px rgba(0,0,0,.35)}
#qb-panel .pt-cv{display:block;width:384px;height:240px;image-rendering:pixelated;cursor:default}
#qb-panel .pt-cv.pt-hand{cursor:pointer}
#qb-panel .pt-bubble{position:absolute;top:10px;transform:translateX(-50%);max-width:260px;padding:5px 9px;border-radius:8px;
 background:#fffdf6;color:#1a1a2e;font-weight:700;font-size:12px;line-height:1.3;text-align:center;box-shadow:0 0 0 2px #1a1a2e,3px 3px 0 2px rgba(0,0,0,.35);
 pointer-events:none;animation:pt-pop .18s cubic-bezier(.2,.8,.3,1.4)}
@keyframes pt-pop{from{transform:translateX(-50%) scale(.6);opacity:0}}
#qb-panel .pt-top{display:flex;align-items:center;gap:8px;margin:10px 2px 6px}
#qb-panel .pt-name{font-weight:800;font-size:15px;cursor:text;border-bottom:1px dashed transparent}
#qb-panel .pt-name:hover{border-bottom-color:var(--qb-muted)}
#qb-panel .pt-chip{font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:4px;
 background:var(--qb-bg2);color:var(--qb-muted);border:1px solid var(--qb-border)}
#qb-panel .pt-xpw{flex:1;display:flex;align-items:center;gap:6px;min-width:0}
#qb-panel .pt-xpb{flex:1;height:8px;border-radius:2px;background:var(--qb-bg2);box-shadow:inset 0 0 0 1px var(--qb-border);overflow:hidden}
#qb-panel .pt-xpb i{display:block;height:100%;background:repeating-linear-gradient(90deg,#8f9bff 0 6px,#7b86f5 6px 8px);transition:width .4s}
#qb-panel .pt-xpt{font-size:10.5px;color:var(--qb-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
#qb-panel .pt-needs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 2px 8px}
#qb-panel .pt-need{display:flex;align-items:center;gap:4px;color:var(--qb-muted)}
#qb-panel .pt-bar{flex:1;height:7px;border-radius:2px;background:var(--qb-bg2);box-shadow:inset 0 0 0 1px var(--qb-border);overflow:hidden}
#qb-panel .pt-bar i{display:block;height:100%;transition:width .4s;background:var(--pt-c)}
#qb-panel .pt-need.pt-low .pt-bar i{background:var(--qb-red)}
#qb-panel .pt-need.pt-low svg{color:var(--qb-red)}
#qb-panel .pt-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 2px}
#qb-panel .pt-btn{display:flex;align-items:center;justify-content:center;gap:5px;height:32px;border-radius:6px;font-weight:800;font-size:11.5px;
 letter-spacing:.3px;text-transform:uppercase;color:var(--qb-text);background:var(--qb-bg2);border:2px solid #0c0d18;box-shadow:2px 2px 0 #0c0d18;
 transition:transform .06s,box-shadow .06s}
#qb-panel .pt-btn:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #0c0d18}
#qb-panel .pt-btn:active{transform:translate(2px,2px);box-shadow:0 0 0 #0c0d18}
#qb-panel .pt-btn svg{color:var(--pt-c)}
#qb-panel .pt-btn.pt-on{background:var(--pt-c);color:#1a1a2e}
#qb-panel .pt-btn.pt-on svg{color:#1a1a2e}
#qb-panel .pt-btn[disabled]{opacity:.45;pointer-events:none}
#qb-panel .pt-tray{display:flex;flex-wrap:wrap;gap:6px;margin:8px 2px 0;padding:8px;border-radius:6px;background:var(--qb-bg2);border:1px dashed var(--qb-border)}
#qb-panel .pt-food{display:flex;align-items:center;gap:6px;height:30px;padding:0 9px;border-radius:6px;font-weight:700;font-size:12px;
 background:var(--qb-bg);border:2px solid #0c0d18;box-shadow:2px 2px 0 #0c0d18}
#qb-panel .pt-food canvas{width:21px;height:21px;image-rendering:pixelated}
#qb-panel .pt-food b{font-variant-numeric:tabular-nums;color:var(--qb-muted);font-weight:700}
#qb-panel .pt-food[disabled]{opacity:.4;pointer-events:none}
#qb-panel .pt-hint{flex-basis:100%;font-size:11px;color:var(--qb-muted)}
#qb-panel .pt-row{display:flex;align-items:center;gap:8px;margin:10px 2px 0}
#qb-panel .pt-gift{flex:1;--pt-c:#ff73b3}
#qb-panel .pt-gift.pt-ready{background:#ff73b3;color:#1a1a2e;animation:pt-wiggle 1.6s ease-in-out infinite}
#qb-panel .pt-gift.pt-ready svg{color:#1a1a2e}
@keyframes pt-wiggle{0%,80%,100%{transform:none}85%{transform:rotate(-2deg)}90%{transform:rotate(2deg)}95%{transform:rotate(-1deg)}}
#qb-panel .pt-streak{font-size:11.5px;font-weight:700;color:var(--qb-amber);white-space:nowrap}
#qb-panel .pt-grow{flex:1;--pt-c:#ffd166;background:#ffd166;color:#1a1a2e;animation:pt-wiggle 1.2s ease-in-out infinite}
#qb-panel .pt-sec{margin:12px 2px 6px;font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--qb-muted)}
#qb-panel .pt-hats{display:flex;flex-wrap:wrap;gap:6px;margin:0 2px}
#qb-panel .pt-hat{width:38px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:var(--qb-bg2);
 border:2px solid #0c0d18;box-shadow:2px 2px 0 #0c0d18}
#qb-panel .pt-hat canvas{width:30px;height:24px;image-rendering:pixelated}
#qb-panel .pt-hat.pt-on{background:#8f9bff}
#qb-panel .pt-hat.pt-locked{opacity:.3;box-shadow:none;border-style:dashed}
#qb-panel .pt-album{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 2px}
#qb-panel .pt-card{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:6px;background:var(--qb-bg2);
 border:2px solid #0c0d18;font-size:10.5px;text-align:center;line-height:1.2}
#qb-panel .pt-card canvas{width:64px;height:48px;image-rendering:pixelated}
#qb-panel .pt-card span{color:var(--qb-muted)}
#qb-panel .pt-foot{display:flex;align-items:center;gap:8px;margin:12px 2px 0;font-size:11.5px;color:var(--qb-muted)}
#qb-panel .pt-foot label{flex:1;display:flex;align-items:center;gap:6px;cursor:pointer}
#qb-panel .pt-link{color:var(--qb-brand);font-weight:700;cursor:pointer}
#qb-panel .pt-link:hover{text-decoration:underline}
#qb-panel .pt-name-in{flex:1;display:flex;gap:6px}
#qb-panel .pt-name-in input{flex:1;min-width:0;height:32px;padding:0 10px;border-radius:6px;border:2px solid #0c0d18;background:var(--qb-bg);
 color:var(--qb-text);font:inherit;font-weight:700;font-size:14px;outline:none}
#qb-panel .pt-name-in input:focus{border-color:#8f9bff}
#qb-panel .pt-egg{margin:12px 2px 0;text-align:center;font-weight:700;color:var(--qb-muted)}
@media (prefers-reduced-motion:reduce){#qb-panel .pt-gift.pt-ready,#qb-panel .pt-grow,#qb-panel .pt-bubble{animation:none}}`;
    function ensureCss() {
        if (document.getElementById("pt-style")) return;
        const st = document.createElement("style");
        st.id = "pt-style"; st.textContent = CSS;
        document.head.appendChild(st);
    }
    const NEED_COLORS = { hunger: "#ffb35c", fun: "#ff73b3", energy: "#ffd166", clean: "#6fd6ff" };
    const ACT_COLORS = { feed: "#ffb35c", play: "#ff73b3", clean: "#6fd6ff", nap: "#9db6ff" };

    /** A small canvas with one sprite (food chips, hat chips) or a pet (album cards). */
    function miniCanvas(w, h, draw) {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d"), fb = makeFB(ctx, w, h);
        draw(fb);
        fb.flush();
        return c;
    }

    function mount(el, api) {
        ensureCss();
        API = api;
        if (!S) load(api, clock());
        const now0 = clock();
        advance(S, now0);
        const news0 = reconcile(S, api);
        seasonal(S, now0, news0);
        const queue = [...S.news, ...news0.map(newsText)].filter(Boolean);
        S.news = [];
        save();

        el.innerHTML = `<div class="pt">
          <div class="pt-stage"><canvas class="pt-cv" width="${W}" height="${H}"></canvas><div class="pt-bubble" hidden></div></div>
          <div class="pt-body"></div>
        </div>`;
        const cv = el.querySelector(".pt-cv"), ctx = cv.getContext("2d"), fb = makeFB(ctx, W, H);
        cv.tabIndex = 0; // arrow keys steer in Orb catch
        const bubbleEl = el.querySelector(".pt-bubble"), body = el.querySelector(".pt-body");

        // View-only animation state (never saved).
        const vs = {
            x: 64, tx: 64, dir: 1, mode: "idle", until: 0, next: now0 + 1200, blinkAt: now0 + 2500, look: 0,
            particles: [], ball: null, bowl: null, bubbleUntil: 0, wobble: 0, box: null, hover: null, tray: false, album: false
        };
        const say = (text, ms) => {
            if (!text) return;
            bubbleEl.textContent = text; bubbleEl.hidden = false;
            bubbleEl.style.left = `${clamp(vs.x, 30, 98) / W * 100}%`;
            bubbleEl.style.animation = "none"; void bubbleEl.offsetWidth; bubbleEl.style.animation = "";
            vs.bubbleUntil = clock() + (ms ?? 2400);
        };
        const burst = (kind, n, x, y) => {
            for (let i = 0; i < n; i++) vs.particles.push({ kind, x: x + rand(-6, 6), y: y + rand(-4, 2), vx: rand(-8, 8), vy: rand(-22, -10), life: rand(0.7, 1.2), age: 0 });
        };
        const setMode = (mode, ms) => { vs.mode = mode; vs.until = ms ? clock() + ms : 0; };

        // ---- actions ----
        const act = {
            feed(kind) {
                const now = clock(); advance(S, now);
                if (asleepAt(S, now)) return say(T("msg.zzz"));
                if (kind !== "berry" && S.inv[kind] <= 0) return;
                if (S.n.hunger >= 96) { setMode("refuse", 700); return say(T("msg.full")); }
                const f = FOODS[kind];
                if (kind !== "berry") S.inv[kind]--;
                S.n.hunger = clamp(S.n.hunger + f.hunger, 0, 100); S.n.fun = clamp(S.n.fun + f.fun, 0, 100);
                gainXp(S, f.xp); S.care.feed++; if (kind === "feast") S.care.feasts++;
                if (!S.poopAt) S.poopAt = now + rand(3, 5) * HOUR;
                vs.bowl = kind; vs.tx = BOWL_X + 12; setMode("toBowl");
                commit(); render();
            },
            play() {
                const now = clock(); advance(S, now);
                if (asleepAt(S, now)) return say(T("msg.zzz"));
                if (S.n.energy < 15) { setMode("refuse", 700); return say(T("msg.tired")); }
                S.n.fun = clamp(S.n.fun + 22, 0, 100); S.n.energy = clamp(S.n.energy - 12, 0, 100);
                gainXp(S, 6); S.care.play++; S.plays++;
                vs.ball = { x: vs.x + vs.dir * 16, y: 40, vy: 0, vx: -vs.dir * 18 };
                setMode("play", 2600);
                commit(); render();
            },
            /** Orb catch: 20 s of catching falling orbs; the pet follows the pointer. */
            game() {
                const now = clock(); advance(S, now);
                if (asleepAt(S, now)) return say(T("msg.zzz"));
                if (S.n.energy < GAME_ENERGY) { setMode("refuse", 700); return say(T("msg.tired")); }
                S.n.energy = clamp(S.n.energy - GAME_ENERGY, 0, 100); S.care.play++; S.plays++;
                vs.game = { end: now + GAME_MS, score: 0, orbs: [], next: now + 600 };
                vs.mode = "game"; vs.until = 0; vs.tray = false;
                cv.focus({ preventScroll: true });
                commit(); render();
            },
            clean() {
                const now = clock(); advance(S, now);
                if (!S.poops && S.n.clean >= 85) return say(T("msg.spotless"));
                S.poops = 0; S.n.clean = 100; gainXp(S, 4); S.care.clean++;
                for (const x of POOP_X) burst("spark", 3, x, 68);
                setMode("happy", 900); say(T("msg.clean"));
                commit(); render();
            },
            nap() {
                const now = clock(); advance(S, now);
                if (asleepAt(S, now)) { // wake up
                    S.napUntil = 0;
                    if (isNight(now)) { S.wokeAt = now; S.n.fun = clamp(S.n.fun - 5, 0, 100); say(T("msg.grumpy")); }
                } else if (S.n.energy >= 90) return say(T("msg.notSleepy"));
                else S.napUntil = now + 2 * HOUR;
                commit(); render();
            },
            pat() {
                const now = clock(); advance(S, now);
                if (asleepAt(S, now)) return say(T("msg.zzz"));
                S.n.fun = clamp(S.n.fun + 3, 0, 100); S.care.pat++;
                const d = dayKey(now);
                if (S.patDay !== d) { S.patDay = d; S.patXp = 0; }
                if (S.patXp < 12) { S.patXp++; gainXp(S, 1); }
                burst("heart", 2, vs.x, BASE_Y - 20);
                setMode("pat", 700);
                save();
            },
            gift() {
                const now = clock();
                if (!giftReady(S, now)) return;
                const news = [], got = openGift(S, now, news);
                burst("spark", 8, vs.x, BASE_Y - 16); setMode("happy", 1200);
                say(T("msg.gift", { items: itemsText(got) }) + news.map(n => " " + newsText(n)).join(""), 3600);
                commit(); render();
            },
            grow() {
                if (!S.ready) return;
                const news = [];
                setMode("evolve", 1800);
                vs.after = () => {
                    evolve(S, clock(), news);
                    burst("spark", 14, vs.x, BASE_Y - 18);
                    say(S.stage === "adult" ? T("msg.adult", { name: S.name, form: T("form." + S.form) }) : T("msg.grew", { name: S.name, stage: T("stage." + S.stage).toLowerCase() }), 3600);
                    for (const n of news) queue.push(newsText(n));
                    save(); render(); API.attention(needsCare(S, clock()));
                };
            },
            warm() {
                if (S.stage !== "egg" || vs.mode === "hatch") return;
                S.warm++; vs.wobble = 1; setTimeout(() => { vs.wobble = 0; }, 250);
                burst("heart", 1, vs.x, BASE_Y - 20);
                if (S.warm >= 5) {
                    setMode("hatch", 1600);
                    vs.after = () => {
                        S.stage = "baby"; S.born = clock(); S.last = clock(); S.name = pick(NAMES);
                        addHat(S, "bow", []);
                        burst("spark", 16, vs.x, BASE_Y - 10);
                        say(T("msg.hatched"), 3000);
                        save(); render(); API.attention(needsCare(S, clock()));
                    };
                }
                save(); render();
            }
        };

        // ---- the HTML under the canvas ----
        function render() {
            const now = clock();
            if (S.stage === "egg") { // the album stays reachable while a new egg waits
                body.innerHTML = `<div class="pt-egg">${esc(T("egg.hint", { n: S.warm }))}</div>` +
                    (S.album.length ? `${vs.album ? albumHtml() : ""}<div class="pt-foot"><span></span><span class="pt-link" data-act="album">${esc(T("album"))}</span></div>` : "");
                drawCards();
                return;
            }
            const nextXp = NEXT_XP[S.stage];
            const asleep = asleepAt(S, now);
            const stageName = S.stage === "adult" && S.form ? T("form." + S.form) : T("stage." + S.stage);
            const need = k => `<div class="pt-need" data-need="${k}" title="${esc(T("need." + k))}" style="--pt-c:${NEED_COLORS[k]}">${icon(ICONS[k], 14)}<span class="pt-bar"><i></i></span></div>`;
            const btn = (k, label, extra) => `<button class="pt-btn ${extra ?? ""}" data-act="${k}"${vs.game ? " disabled" : ""} style="--pt-c:${ACT_COLORS[k]}">${icon(ICONS[k === "feed" ? "hunger" : k === "play" ? "fun" : k === "nap" ? "energy" : "clean"], 14)}${esc(label)}</button>`;
            const hatsHtml = `<div class="pt-sec">${esc(T("hats"))}</div><div class="pt-hats">` +
                [""].concat(HATS).map(h => {
                    const owned = !h || S.hats.includes(h);
                    const title = !h ? T("hat.none") : owned ? T("hat." + h) : T("hat.locked", { how: T("how." + h) });
                    return `<button class="pt-hat ${S.hat === h ? "pt-on" : ""} ${owned ? "" : "pt-locked"}" data-hat="${h}" title="${esc(title)}" aria-label="${esc(title)}"></button>`;
                }).join("") + `</div>`;
            const adv = S.stage === "adult" && now - S.adultAt >= ADVENTURE_AFTER;
            body.innerHTML = `
              <div class="pt-top">
                ${S.named && !vs.renaming ? `<span class="pt-name" data-act="rename" title="${esc(T("rename"))}">${esc(S.name)}</span>` :
                  `<span class="pt-name-in"><input maxlength="16" value="${esc(S.name)}" aria-label="${esc(T("name.prompt"))}" placeholder="${esc(T("name.prompt"))}"><button class="pt-btn" data-act="name" style="--pt-c:#8f9bff">${esc(T("name.ok"))}</button></span>`}
                ${S.named && !vs.renaming ? `<span class="pt-chip">${esc(stageName)}</span>
                <span class="pt-xpw"><span class="pt-xpb"><i style="width:${nextXp ? Math.min(100, S.xp / nextXp * 100) : 100}%"></i></span>
                <span class="pt-xpt">${esc(nextXp ? T("xp", { a: Math.floor(S.xp), b: nextXp }) : T("xp.max", { a: Math.floor(S.xp) }))}</span></span>` : ""}
              </div>
              <div class="pt-needs">${NEEDS.map(need).join("")}</div>
              <div class="pt-acts">${btn("feed", T("act.feed"), vs.tray === "food" ? "pt-on" : "")}${btn("play", T("act.play"), vs.tray === "play" ? "pt-on" : "")}${btn("clean", T("act.clean"))}${btn("nap", T(asleep ? "act.wake" : "act.nap"), asleep ? "pt-on" : "")}</div>
              ${vs.tray === "play" ? `<div class="pt-tray">
                  <button class="pt-food" data-play="ball"><span data-spr="ball"></span>${esc(T("play.ball"))}</button>
                  <button class="pt-food" data-play="game"><span data-spr="orb"></span>${esc(T("play.game"))}${S.best ? ` <b>${esc(T("play.best", { n: S.best }))}</b>` : ""}</button>
                  <span class="pt-hint">${esc(T("play.hint"))}</span></div>` : ""}
              ${vs.tray === "food" ? `<div class="pt-tray">${["berry", "snack", "feast", "cake"].map(k =>
                  `<button class="pt-food" data-food="${k}" title="${esc(T("food." + k))}" ${k !== "berry" && !S.inv[k] ? "disabled" : ""}><span data-spr="${k}"></span>${esc(T("food." + k))} <b>${k === "berry" ? "\u221e" : "\u00d7" + S.inv[k]}</b></button>`).join("")}
                  <span class="pt-hint">${esc(T("food.hint"))}</span></div>` : ""}
              <div class="pt-row">
                ${S.ready ? `<button class="pt-btn pt-grow" data-act="grow">${esc(T("grow", { name: S.name }))}</button>` :
                  `<button class="pt-btn pt-gift ${giftReady(S, now) ? "pt-ready" : ""}" data-act="gift" ${giftReady(S, now) ? "" : "disabled"}>${icon(ICONS.gift, 14)}${esc(T(giftReady(S, now) ? "gift" : "gift.done"))}</button>`}
                ${S.gift.streak ? `<span class="pt-streak">${esc(API.tn("streak", S.gift.streak))}</span>` : ""}
              </div>
              ${hatsHtml}
              ${vs.album ? albumHtml() : ""}
              <div class="pt-foot">
                <label><input type="checkbox" data-remind ${S.remind ? "checked" : ""}>${esc(T("remind", { name: nameOf() }))}</label>
                <span class="pt-link" data-act="album">${esc(T("album"))}</span>
              </div>
              ${S.stage === "adult" ? `<div class="pt-foot">${!adv ? `<span>${esc(T("adventure.soon"))}</span>` : vs.confirmAdv
                  ? `<span>${esc(T("adventure.confirm", { name: S.name }))}</span><span class="pt-link" data-act="adventure-yes">${esc(T("adventure.yes"))}</span><span class="pt-link" data-act="adventure-no">${esc(T("adventure.no"))}</span>`
                  : `<span class="pt-link" data-act="adventure">${esc(T("adventure"))}</span>`}</div>` : ""}`;
            // pixel previews for food and hats
            for (const sp of body.querySelectorAll("[data-spr]")) sp.replaceWith(miniCanvas(7, 7, f => f.sprite(SPR[sp.dataset.spr], (7 - SPR[sp.dataset.spr][0].length) >> 1, (7 - SPR[sp.dataset.spr].length) >> 1, SPR_MAP)));
            for (const hb of body.querySelectorAll("[data-hat]")) {
                const h = hb.dataset.hat;
                hb.appendChild(miniCanvas(15, 12, f => {
                    if (!h) { f.rect(5, 5, 5, 1, K.pink); f.rect(5, 6, 5, 1, K.pink); return; } // "none": a dash
                    const sp = SPR[h];
                    f.sprite(sp, (15 - sp[0].length) >> 1, (12 - sp.length) >> 1, HAT_MAP);
                }));
            }
            drawCards();
            updateMeters();
        }
        function drawCards() {
            for (const cardCv of body.querySelectorAll("[data-card]")) {
                const a = S.album[Number(cardCv.dataset.card)];
                cardCv.replaceWith(miniCanvas(32, 24, f => drawOrbling(f, { x: 16, base: 22, stage: "adult", form: a.form, pal: a.pal, eyes: "happy", mouth: "smile", dir: 1, noShadow: true })));
            }
        }
        function albumHtml() {
            const forms = new Set(S.album.map(a => a.form)), pals = new Set(S.album.map(a => a.pal));
            return `<div class="pt-sec">${esc(T("album"))} \u00b7 ${esc(T("album.count", { f: forms.size, c: pals.size }))}</div>` +
                (S.album.length ? `<div class="pt-album">${S.album.map((a, i) =>
                    `<div class="pt-card"><span data-card="${i}"></span><b>${esc(a.name)}</b><span>${esc(T("form." + a.form))}, ${esc(API.tn("days", a.days))}</span></div>`).join("")}</div>`
                    : `<div class="pt-hint">${esc(T("album.empty"))}</div>`);
        }
        function updateMeters() {
            if (S.stage === "egg") return;
            for (const k of NEEDS) {
                const box = body.querySelector(`[data-need="${k}"]`);
                if (!box) continue;
                const v = S.n[k] - (k === "clean" ? S.poops * 10 : 0);
                box.querySelector("i").style.width = clamp(v, 0, 100) + "%";
                box.classList.toggle("pt-low", v < 25);
            }
        }

        body.addEventListener("click", e => {
            if (vs.game) return; // Orb catch has the floor until it ends
            const a = e.target.closest("[data-act]"), food = e.target.closest("[data-food]"), hat = e.target.closest("[data-hat]");
            if (food && food.dataset.food) { vs.tray = false; act.feed(food.dataset.food); return; }
            const play = e.target.closest("[data-play]");
            if (play) { vs.tray = false; if (play.dataset.play === "game") act.game(); else act.play(); return; }
            if (hat) {
                const h = hat.dataset.hat;
                if (h && !S.hats.includes(h)) return;
                S.hat = h; commit(); render(); return;
            }
            if (!a) return;
            switch (a.dataset.act) {
                case "feed": vs.tray = vs.tray === "food" ? false : "food"; render(); break;
                case "play": vs.tray = vs.tray === "play" ? false : "play"; render(); break;
                case "clean": act.clean(); break;
                case "nap": act.nap(); break;
                case "gift": act.gift(); break;
                case "grow": act.grow(); break;
                case "album": vs.album = !vs.album; render(); break;
                case "rename": vs.renaming = true; render(); body.querySelector(".pt-name-in input")?.select(); break;
                case "name": {
                    const v = body.querySelector(".pt-name-in input")?.value.trim().slice(0, 16);
                    if (v) { S.name = v; S.named = true; vs.renaming = false; commit(); render(); }
                    break;
                }
                case "adventure": vs.confirmAdv = true; render(); break;
                case "adventure-no": vs.confirmAdv = false; render(); break;
                case "adventure-yes": vs.confirmAdv = false; vs.album = true; adventure(S, clock()); save(); render(); API.attention(needsCare(S, clock())); break;
            }
        });
        body.addEventListener("keydown", e => {
            if (!e.target.matches(".pt-name-in input")) return;
            if (e.key === "Enter") { e.preventDefault(); body.querySelector('[data-act="name"]')?.click(); }
            if (e.key !== "Escape") e.stopPropagation(); // typing a name must not trigger Discord shortcuts
        });
        body.addEventListener("change", e => { if (e.target.matches("[data-remind]")) { S.remind = e.target.checked; save(); } });

        // ---- canvas input ----
        const toLogical = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
        const hit = (pt, b) => b && pt.x >= b.x0 && pt.x <= b.x1 && pt.y >= b.y0 && pt.y <= b.y1;
        const targetAt = pt => {
            if (hit(pt, vs.box)) return "pet";
            if (S.stage !== "egg" && vs.giftBoxOn && pt.x >= 71 && pt.x <= 80 && pt.y >= 61 && pt.y <= 71) return "giftbox";
            for (let i = 0; i < S.poops; i++) if (Math.abs(pt.x - POOP_X[i]) <= 4 && pt.y >= 69 && pt.y <= 75) return "poop:" + i;
            return null;
        };
        cv.addEventListener("mousemove", e => { const pt = toLogical(e); vs.hover = pt; cv.classList.toggle("pt-hand", !!targetAt(pt)); });
        cv.addEventListener("mouseleave", () => { vs.hover = null; cv.classList.remove("pt-hand"); });
        cv.addEventListener("keydown", e => {
            if (!vs.game || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
            e.preventDefault(); e.stopPropagation();
            vs.keyX = clamp((vs.keyX ?? vs.x) + (e.key === "ArrowLeft" ? -8 : 8), 14, 114);
        });
        cv.addEventListener("click", e => {
            if (vs.game) return;
            const what = targetAt(toLogical(e));
            if (!what) return;
            if (what === "pet") { if (S.stage === "egg") act.warm(); else if (S.ready) act.grow(); else act.pat(); }
            else if (what === "giftbox") API.openQuests();
            else if (what.startsWith("poop:")) {
                S.poops = Math.max(0, S.poops - 1); S.n.clean = clamp(S.n.clean + 12, 0, 100); gainXp(S, 1);
                burst("spark", 4, POOP_X[Number(what.slice(5))], 68);
                commit(); render();
            }
        });

        // ---- animation loop (only while visible) ----
        let raf = 0, lastFrame = 0, lastTick = now0;
        function frame(ts) {
            raf = requestAnimationFrame(frame);
            if (document.hidden || ts - lastFrame < 66) return; // ~15 fps is plenty for pixel art
            const dt = Math.min(0.2, (ts - (lastFrame || ts)) / 1000);
            lastFrame = ts;
            const now = clock();
            if (now - lastTick > 20e3) { lastTick = now; advance(S, now); updateMeters(); }
            step(now, dt);
            paint(now);
        }
        function step(now, dt) {
            if (vs.until && now >= vs.until && vs.after) { const f = vs.after; vs.after = null; vs.until = 0; vs.mode = "idle"; f(); }
            if (vs.bubbleUntil && now > vs.bubbleUntil) { vs.bubbleUntil = 0; bubbleEl.hidden = true; if (queue.length && !vs.game) say(queue.shift(), 3200); }
            // particles
            for (const p of vs.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === "zed" ? -4 : 30) * dt; }
            vs.particles = vs.particles.filter(p => p.age < p.life);
            if (vs.game && (S.stage === "egg" || asleepAt(S, now))) finishGame(now); // bedtime (or an adventure) ends the game
            if (S.stage === "egg") { vs.x = 64; return; }
            const asleep = asleepAt(S, now);
            if (vs.mode === "evolve" || vs.mode === "hatch") return;
            if (asleep) {
                vs.mode = "sleep"; vs.x = BED_X; vs.dir = -1;
                if (Math.random() < dt * 0.7) vs.particles.push({ kind: "zed", x: BED_X + 6, y: (vs.box?.y0 ?? 40) - 2, vx: rand(2, 6), vy: -6, life: 2.2, age: 0 });
                return;
            }
            if (vs.mode === "sleep") { vs.mode = "idle"; vs.x = BED_X - 16; vs.next = now + 1500; }
            if (vs.game) { stepGame(now, dt); return; }
            if (vs.until && now >= vs.until) { vs.until = 0; vs.mode = "idle"; vs.next = now + rand(1200, 3500); vs.ball = null; }
            const speed = 16;
            switch (vs.mode) {
                case "idle":
                    if (now >= vs.next) { vs.tx = rand(30, 94); vs.mode = "walk"; }
                    break;
                case "walk": case "toBowl": {
                    const d = vs.tx - vs.x;
                    vs.dir = d < 0 ? -1 : 1;
                    if (Math.abs(d) <= speed * dt) {
                        vs.x = vs.tx;
                        if (vs.mode === "toBowl") { setMode("eat", 1600); say(T("msg.yum"), 1400); }
                        else { vs.mode = "idle"; vs.next = now + rand(1500, 5000); }
                    } else vs.x += Math.sign(d) * speed * dt;
                    break;
                }
                case "eat":
                    vs.dir = -1;
                    if (Math.random() < dt * 6) vs.particles.push({ kind: "crumb", x: vs.x - 8, y: BASE_Y - 8, vx: rand(-6, 6), vy: rand(-12, -4), life: 0.5, age: 0 });
                    if (now + 100 >= vs.until) { vs.bowl = null; burst("heart", 2, vs.x, BASE_Y - 20); }
                    break;
                case "play": {
                    const b = vs.ball;
                    if (b) {
                        b.vy += 120 * dt; b.y += b.vy * dt; b.x += b.vx * dt;
                        if (b.y >= BASE_Y) { b.y = BASE_Y; b.vy = -Math.abs(b.vy) * 0.7 - 10; }
                        if (b.x < 30 || b.x > 96) b.vx *= -1;
                        vs.tx = clamp(b.x, 30, 96);
                        const d = vs.tx - vs.x;
                        vs.dir = d < 0 ? -1 : 1;
                        vs.x += clamp(d, -26 * dt, 26 * dt);
                    }
                    break;
                }
            }
            // eyes follow the pointer when it's over the room
            vs.look = vs.hover ? clamp(Math.round((vs.hover.x - vs.x) / 20), -1, 1) : vs.mode === "walk" ? vs.dir : 0;
        }
        function stepGame(now, dt) {
            const g = vs.game;
            // the pet follows the pointer (or the arrow keys) along the floor
            const want = vs.keyX != null && !vs.hover ? vs.keyX : vs.hover ? clamp(vs.hover.x, 14, 114) : vs.x;
            const d = want - vs.x;
            vs.dir = d < 0 ? -1 : 1;
            vs.x += clamp(d, -70 * dt, 70 * dt);
            const left = g.end - now;
            if (left > 0 && now >= g.next) { // orbs fall faster as the clock runs down
                const k = 1 - left / GAME_MS;
                g.orbs.push({ x: rand(14, 114), y: -4, vy: 26 + 34 * k + rand(0, 8), gold: Math.random() < 0.12 });
                g.next = now + rand(380, 760) - 220 * k;
            }
            const [rx] = BODY[S.stage] ?? BODY.baby, catchTop = BASE_Y - 2 * (BODY[S.stage]?.[1] ?? 8) - 2;
            for (const o of g.orbs) {
                o.y += o.vy * dt;
                if (!o.done && o.y >= catchTop && o.y <= BASE_Y - 4 && Math.abs(o.x - vs.x) <= rx + 2) {
                    o.done = true; g.score += o.gold ? 3 : 1;
                    burst("spark", o.gold ? 5 : 2, o.x, o.y);
                }
            }
            g.orbs = g.orbs.filter(o => !o.done && o.y < H + 4);
            if (!vs.gameSaid || now - vs.gameSaid > 250) { vs.gameSaid = now; say(T("game.live", { n: g.score, s: Math.max(0, Math.ceil(left / 1000)) }), 600); }
            if (left <= 0 && !g.orbs.length) finishGame(now);
        }
        function finishGame(now) {
            const g = vs.game;
            vs.game = null; vs.keyX = null;
            const best = g.score > S.best;
            S.best = Math.max(S.best, g.score);
            S.n.fun = clamp(S.n.fun + Math.min(40, 10 + g.score * 2), 0, 100);
            gainXp(S, Math.min(30, 4 + g.score));
            const news = [];
            if (g.score >= CAP_SCORE) addHat(S, "cap", news);
            setMode("happy", 1400);
            say(T(best && g.score ? "game.best" : "game.end", { n: g.score }) + news.map(n => " " + newsText(n)).join(""), 3200);
            commit(); render();
        }
        function paint(now) {
            const t = now;
            if (!vs.paceAt || now - vs.paceAt > 5000) {
                vs.paceAt = now;
                try { vs.giftBoxOn = API.pace().waiting > 0; } catch (e) { vs.giftBoxOn = false; }
            }
            drawRoom(fb, now, t, S, { bowl: vs.bowl, giftBox: vs.giftBoxOn && S.stage !== "egg", ball: vs.mode === "play" ? vs.ball : null });
            const asleep = S.stage !== "egg" && asleepAt(S, now);
            const m = mood(S);
            let eyes = "open", mouth = "smile", squash = 0, lift = 0, blush = m >= 80, stepFoot = 0;
            const breathe = Math.sin(t / 650);
            if (asleep) { eyes = "sleep"; mouth = "none"; squash = breathe * 0.04; }
            else {
                if (m < 40) { eyes = "sad"; mouth = "flat"; }
                if (now > vs.blinkAt) { if (now > vs.blinkAt + 130) vs.blinkAt = now + rand(2500, 5000); else eyes = "blink"; }
                switch (vs.mode) {
                    case "walk": case "toBowl": lift = Math.abs(Math.sin(t / 110)) * 1.5; stepFoot = Math.floor(t / 180) % 2 ? 1 : 2; break;
                    case "eat": mouth = Math.floor(t / 180) % 2 ? "open" : "smile"; eyes = "happy"; squash = Math.floor(t / 180) % 2 ? 0.05 : 0; break;
                    case "play": case "happy": { const ph = (t % 700) / 700; lift = Math.sin(ph * Math.PI) * 7; squash = ph < 0.1 || ph > 0.9 ? 0.12 : -0.06; eyes = "happy"; mouth = "open"; blush = true; break; }
                    case "pat": eyes = "happy"; blush = true; squash = 0.08; break;
                    case "game": mouth = "o"; lift = Math.abs(Math.sin(t / 120)) * 1.5; stepFoot = Math.floor(t / 150) % 2 ? 1 : 2; break;
                    case "refuse": vs.xShake = Math.floor(t / 60) % 2 ? 1 : -1; eyes = "sad"; mouth = "flat"; break;
                    default: squash = breathe * 0.03;
                }
            }
            if (vs.mode !== "refuse") vs.xShake = 0;
            const evolving = vs.mode === "evolve" && Math.floor(t / 120) % 2 === 0;
            const hatching = vs.mode === "hatch";
            vs.box = drawOrbling(fb, {
                x: vs.x + (vs.xShake || 0) + (hatching ? (Math.floor(t / 50) % 2 ? 1 : -1) : 0), base: asleep ? 63 : BASE_Y,
                stage: S.stage, form: S.form, pal: S.pal, hat: S.hat, eyes, mouth, look: vs.look, squash, lift, blush, step: stepFoot, dir: vs.dir,
                glow: evolving, warm: S.warm, wobble: vs.wobble
            });
            if (S.ready && S.stage !== "egg" && Math.random() < 0.15) vs.particles.push({ kind: "spark", x: vs.x + rand(-12, 12), y: BASE_Y - rand(6, 26), vx: 0, vy: -4, life: 0.6, age: 0 });
            if (vs.game) for (const o of vs.game.orbs) fb.sprite(SPR.orb, Math.round(o.x) - 2, Math.round(o.y) - 2, { y: o.gold ? K.pink : K.gold, w: K.white });
            for (const p of vs.particles) {
                const spr = p.kind === "heart" ? SPR.heart : p.kind === "zed" ? SPR.zed : p.kind === "spark" ? SPR.spark : null;
                if (spr) fb.sprite(spr, Math.round(p.x) - 2, Math.round(p.y) - 2, { r: K.pink, w: K.white, y: K.yellow });
                else fb.px(p.x, p.y, K.brownHi);
            }
            fb.flush();
            nightShade(ctx, now);
        }

        render();
        if (queue.length) say(queue.shift(), 3200);
        else if (S.stage !== "egg" && !asleepAt(S, now0)) say(T(pick(["msg.hi1", "msg.hi2", "msg.hi3", "msg.hi4"])), 1800);
        raf = requestAnimationFrame(frame);
        const view = {
            refresh() { if (vs.tray || vs.game || body.contains(document.activeElement)) updateMeters(); else render(); },
            news(lines) { queue.push(...lines); if (!vs.bubbleUntil && !vs.game && queue.length) say(queue.shift(), 3200); }
        };
        VIEW = view;
        API.attention(needsCare(S, now0));
        return {
            unmount() {
                cancelAnimationFrame(raf);
                if (VIEW === view) VIEW = null;
                save();
            }
        };
    }

    const def = { id: ID, version: 1, icon: ICONS.paw, strings: STRINGS, init, mount, destroy };
    if (typeof window.__questAgentDev === "object") { // development harness: poke at the state from the console
        window.__orbling = {
            state: () => S, set: patch => { Object.assign(S, patch); save(); },
            /** Pretend the PC clock is h hours ahead (night scenes, sleeping); 0 resets. */
            shift: h => {
                const delta = h * HOUR - clockShift;
                clockShift = h * HOUR;
                if (delta < 0 && S) for (const k of ["last", "napUntil", "wokeAt", "poopAt", "adultAt", "lastRemind"]) if (S[k]) S[k] = Math.max(0, S[k] + delta);
            },
            advance: ms => { S.last -= ms; if (S.poopAt) S.poopAt -= ms; if (S.napUntil) S.napUntil -= ms; advance(S, clock()); save(); },
            /** Every stage, form and hat side by side on a canvas, for reviewing the art. */
            gallery(canvas, pal) {
                canvas.width = 200; canvas.height = 100;
                const ctx = canvas.getContext("2d"), fb = makeFB(ctx, 200, 100);
                fb.rect(0, 0, 200, 100, K.wall);
                const row = (y, list) => list.forEach((p, i) => drawOrbling(fb, { x: 16 + i * 30, base: y, pal: pal ?? 0, dir: 1, eyes: "open", mouth: "smile", ...p }));
                row(34, [{ stage: "egg", warm: 3 }, { stage: "baby" }, { stage: "child" }, { stage: "teen" }, { stage: "adult", form: "classic" }, { stage: "adult", form: "gourmet" }]);
                row(72, [{ stage: "adult", form: "sprinter" }, { stage: "adult", form: "dapper" }, { stage: "adult", form: "astral" }, { stage: "child", hat: "party", eyes: "happy", blush: true }, { stage: "teen", hat: "crown", eyes: "sad", mouth: "flat" }, { stage: "child", hat: "witch", eyes: "sleep", mouth: "none" }]);
                row(98, [{ stage: "baby", hat: "bow", mouth: "open" }, { stage: "child", hat: "beanie" }, { stage: "child", hat: "flower", eyes: "blink" }]);
                fb.flush();
            }
        };
    }
    (window.__questAgentAddons = window.__questAgentAddons || []).push(def);
})();
