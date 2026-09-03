/*
 * quest-agent.js  -  self-sustaining Discord quest agent
 *
 * NOTE: keep this file pure ASCII. The launcher reads it with PowerShell, and a
 * non-UTF8 read would mangle any literal non-ASCII character. Use \u escapes.
 *
 * Injected into the desktop client's renderer over CDP by QuestAgent.ps1.
 * Once installed it lives for the whole Discord session:
 *   - auto-enrolls in available quests (auto-detecting the enroll "location"),
 *   - completes game / stream / video / activity quests,
 *   - re-scans on an interval + on Discord's quest-refresh events, so quests you
 *     enroll in later get handled automatically,
 *   - goes idle (timer stopped, zero API calls) once no quests are left to do,
 *     waking only when Discord reports new quests - so it can't rate-limit you,
 *   - gives up on quests that repeatedly fail instead of retrying forever,
 *   - notifies (OS notification + taskbar flash) when a quest is ready to claim,
 *   - fails loudly (notification) if a Discord update changes its internals,
 *   - puts a HUD in the title bar: pause/stop/skip/run-now per quest, a global
 *     pause, and settings (quest types, auto-accept, notifications, rescan
 *     interval) that persist across Discord restarts.
 *
 * Idempotent: re-injecting is a no-op while an agent is already running.
 *
 * WARNING: Automating quests violates Discord's ToS. Your account, your risk.
 */
(async () => {
    "use strict";
    const AGENT_VERSION = 10;

    if (window.__questAgent && !window.__questAgentForce) {
        console.log(`[QuestAgent] Agent v${window.__questAgent.version} already running - skipping.`);
        return;
    }
    // Forced re-injection (development): retire the previous agent first.
    if (window.__questAgent && typeof window.__questAgent.stop === "function") {
        try { window.__questAgent.stop(); } catch (e) { /* ignore */ }
    }

    // Development hooks: { quests: [...], api: {get, post}, stores: {...} }.
    // Lets the agent run against mock data inside a live client. Absent in
    // normal use.
    const DEV = (typeof window.__questAgentDev === "object" && window.__questAgentDev) || null;

    // ---- Config ---------------------------------------------------------
    // Defaults below are overridden by config.json, which the launcher injects
    // as window.__questAgentConfig before this script runs. In-client settings
    // (see SETTINGS below) override both and persist across restarts.
    const CONFIG = Object.assign({
        autoEnroll: true,
        // Candidate enroll "location" values; the first that works is cached and reused.
        enrollLocations: [11, 7, 12, 4, 3, 1, 8, 10, 2, 6],
        scanIntervalMs: 120000, // rescan for new quests every 2 min
        maxTaskAttempts: 3,     // give up on a quest after this many failed runs
        hud: true,              // show the toolbar button + panel
        notify: true            // OS notification when a reward is claimable
    }, (typeof window.__questAgentConfig === "object" && window.__questAgentConfig) || {});
    // ---------------------------------------------------------------------

    const SUPPORTED = ["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY"];
    const NEEDS_SPOOF = t => t === "PLAY_ON_DESKTOP" || t === "STREAM_ON_DESKTOP";
    const isApp = typeof DiscordNative !== "undefined";
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ---- Notifications (defined early so the failure path can use them) --
    let SETTINGS = null; // assigned once storage is up; CONFIG stands in until then
    function notifyRaw(title, body) {
        if ((SETTINGS ? SETTINGS.notify : CONFIG.notify) === false) return;
        try {
            if (typeof Notification !== "undefined") {
                if (Notification.permission === "granted") new Notification(title, { body });
                else Notification.requestPermission().then(p => { if (p === "granted") new Notification(title, { body }); });
            }
        } catch (e) { /* ignore */ }
        try { DiscordNative?.window?.flashFrame?.(true); } catch (e) { /* ignore */ }
    }
    function notifyClaimable(questName, appName) {
        notifyRaw("Quest ready to claim \uD83C\uDF89", `${questName} (${appName}) is at 100%. Open Discover \u2192 Quests and click Claim (captcha required).`);
        console.log(`%c[QuestAgent] Ready to claim: ${questName}`, "color:#43b581;font-weight:bold");
    }

    // ---- Hook Discord internals (defensively, with retries) -------------
    // Injection routinely wins the race against Discord's own startup:
    // webpackChunkdiscord_app is defined long before the stores are registered,
    // so a single attempt right after a launch/reload finds nothing at all.
    // Retry for a while before concluding that Discord's internals changed.
    // Claim the global now so the watchdog doesn't inject a second agent while
    // we wait.
    window.__questAgent = { version: AGENT_VERSION, status: "starting", installedAt: Date.now() };

    let ApplicationStreamingStore, RunningGameStore, QuestsStore, ChannelStore, GuildChannelStore, FluxDispatcher, api;
    let NavTransitionTo; // optional: quest rows navigate to the Quests page; agent works without it
    let missing = ["not attempted"];
    for (let attempt = 1; attempt <= 40; attempt++) {
        try {
            const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
            webpackChunkdiscord_app.pop();

            const find = pred => {
                for (const m of Object.values(wpRequire.c)) {
                    try { if (pred(m)) return m; } catch (e) { /* some modules throw on access */ }
                }
                return undefined;
            };

            ApplicationStreamingStore = find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
            RunningGameStore = find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
            QuestsStore = find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
            ChannelStore = find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
            GuildChannelStore = find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
            FluxDispatcher = find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
            api = find(x => x?.exports?.Bo?.get)?.exports?.Bo;

            // Optional module: Discord's transitionTo is a standalone export with
            // a mangled name (pX as of 1.0.9249), but its body logs the literal
            // string "transitionTo - Transitioning to", which survives
            // minification - so match the function by that instead of by name.
            // Never added to `missing`: if Discord breaks it, quest rows just
            // stop navigating and everything else keeps working.
            if (NavTransitionTo == null) {
                try {
                    outer:
                    for (const m of Object.values(wpRequire.c)) {
                        const exp = m?.exports;
                        if (exp == null || typeof exp !== "object") continue;
                        for (const k of Object.keys(exp)) {
                            let v;
                            try { v = exp[k]; } catch (e) { continue; } // some getters throw
                            if (typeof v === "function" && String(v).includes("transitionTo - Transitioning to")) {
                                NavTransitionTo = v;
                                break outer;
                            }
                        }
                    }
                } catch (e) { /* optional - see above */ }
            }

            missing = Object.entries({ ApplicationStreamingStore, RunningGameStore, QuestsStore, ChannelStore, GuildChannelStore, FluxDispatcher, api })
                .filter(([, v]) => v == null).map(([k]) => k);
        } catch (e) {
            missing = [String(e)];
        }
        if (!missing.length) break;
        if (attempt === 1) console.log("[QuestAgent] Discord's modules aren't registered yet - waiting...");
        await sleep(1500);
    }
    if (missing.length) {
        window.__questAgent = { version: AGENT_VERSION, error: "missing modules: " + missing.join(", "), installedAt: Date.now() };
        console.error("[QuestAgent] Failed to hook Discord internals:", missing);
        notifyRaw("Quest agent needs updating", "Discord's internals changed (likely an update). The module finders in quest-agent.js need re-matching.");
        return;
    }
    if (DEV?.stores) {
        if (DEV.stores.ApplicationStreamingStore) ApplicationStreamingStore = DEV.stores.ApplicationStreamingStore;
        if (DEV.stores.RunningGameStore) RunningGameStore = DEV.stores.RunningGameStore;
        if (DEV.stores.FluxDispatcher) FluxDispatcher = DEV.stores.FluxDispatcher;
    }
    if (DEV?.api) api = DEV.api;
    const allQuests = () => DEV?.quests ? DEV.quests : [...QuestsStore.quests.values()];
    const questById = id => allQuests().find(q => q.id === id);

    // ---- Persistent settings --------------------------------------------
    // Discord deletes window.localStorage from its renderer. A same-origin
    // about:blank iframe still has one, so borrow that (what client mods do).
    // Falls back to memory-only for the session if even that fails.
    const SETTINGS_KEY = "questAgent.settings.v1";
    let storageFrame = null;
    function getStorage() {
        try { const ls = window.localStorage; if (ls && typeof ls.getItem === "function") return ls; } catch (e) { /* removed */ }
        try {
            storageFrame = document.createElement("iframe");
            storageFrame.style.display = "none";
            storageFrame.setAttribute("aria-hidden", "true");
            storageFrame.id = "qb-storage";
            (document.head || document.documentElement).appendChild(storageFrame);
            const ls = storageFrame.contentWindow.localStorage;
            ls.getItem(SETTINGS_KEY); // probe
            return ls;
        } catch (e) { try { storageFrame?.remove(); } catch (e2) { /* ignore */ } storageFrame = null; }
        return null;
    }
    const storage = getStorage();

    SETTINGS = {
        autoEnroll: CONFIG.autoEnroll !== false,
        notify: CONFIG.notify !== false,
        scanIntervalMs: Number(CONFIG.scanIntervalMs) || 120000,
        paused: false,
        types: Object.fromEntries(SUPPORTED.map(t => [t, true])),
        skipped: []
    };
    function loadSettings() {
        if (!storage) return;
        try {
            const raw = storage.getItem(SETTINGS_KEY);
            if (!raw) return;
            const s = JSON.parse(raw);
            if (typeof s !== "object" || !s) return;
            if (typeof s.autoEnroll === "boolean") SETTINGS.autoEnroll = s.autoEnroll;
            if (typeof s.notify === "boolean") SETTINGS.notify = s.notify;
            if (typeof s.paused === "boolean") SETTINGS.paused = s.paused;
            if (Number.isFinite(s.scanIntervalMs) && s.scanIntervalMs >= 30000) SETTINGS.scanIntervalMs = s.scanIntervalMs;
            if (s.types && typeof s.types === "object") for (const t of SUPPORTED) if (typeof s.types[t] === "boolean") SETTINGS.types[t] = s.types[t];
            if (Array.isArray(s.skipped)) SETTINGS.skipped = s.skipped.filter(x => typeof x === "string").slice(0, 500);
        } catch (e) { console.warn("[QuestAgent] Could not read saved settings:", e); }
    }
    function saveSettings() {
        SETTINGS.skipped = [...state.skipped];
        if (!storage) return;
        try { storage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* quota / sandbox */ }
    }
    loadSettings();

    // ---- State ----------------------------------------------------------
    const state = {
        handled: new Set(),      // quest ids already started/finished this session
        enrollFailed: new Set(), // quest ids that rejected every enroll location - not retried
        failCounts: new Map(),   // quest id -> failed task runs (capped by CONFIG.maxTaskAttempts)
        skipped: new Set(SETTINGS.skipped), // quest ids the user skipped/stopped (persisted)
        tasks: new Map(),        // quest id -> { quest, taskName, ctl, startedAt }
        enrollLocation: null,    // cached working enroll location
        spoofActive: false,      // only one game/stream spoof at a time
        scanning: false,
        activeTasks: 0,          // tasks currently running (idle check waits for 0)
        timer: null,             // rescan interval; null while idle
        stopped: false           // set by stop(); scans become no-ops
    };

    const live = q => new Date(q.config?.expiresAt ?? 0).getTime() > Date.now();
    const taskConfigOf = q => q.config?.taskConfig ?? q.config?.taskConfigV2;
    /** Every task type the quest offers that this agent can do, in preference order. */
    const supportedTasksOf = q => SUPPORTED.filter(t => taskConfigOf(q)?.tasks?.[t] != null);
    /** The task we'd actually run: first supported type the user hasn't switched off. */
    const enabledTaskOf = q => supportedTasksOf(q).find(t => SETTINGS.types[t]) ?? null;
    /** Can run on this machine at all (ignores user preferences). */
    const isEligible = q => live(q) && supportedTasksOf(q).length > 0;

    // ---- Task controller --------------------------------------------------
    // Every running task owns one. Runners await ctl.gate() between steps:
    // it waits while paused and throws Cancelled once cancelled, so pause,
    // resume and stop all work without the runner knowing how it was driven.
    class Cancelled extends Error {
        constructor(reason) { super("cancelled: " + reason); this.name = "Cancelled"; this.reason = reason; }
    }
    // A task is paused while any "hold" is on it: "user" (its own pause button)
    // or "all" (the global pause). Lifting one hold leaves the other in place.
    function makeCtl() {
        const ctl = { paused: false, cancelled: false, reason: null, holds: new Set(), waiters: [], onPause: null, onResume: null, onCancel: null };
        const wake = () => { const w = ctl.waiters; ctl.waiters = []; for (const f of w) f(); };
        const sync = () => {
            const p = ctl.holds.size > 0;
            if (ctl.cancelled || ctl.paused === p) return;
            ctl.paused = p;
            try { (p ? ctl.onPause : ctl.onResume)?.(); } catch (e) { console.warn("[QuestAgent] pause hook failed:", e); }
            wake();
        };
        ctl.hold = why => { ctl.holds.add(why); sync(); };
        ctl.release = why => { ctl.holds.delete(why); sync(); };
        ctl.heldBy = why => ctl.holds.has(why);
        ctl.cancel = reason => {
            if (ctl.cancelled) return;
            ctl.cancelled = true; ctl.reason = reason;
            try { ctl.onCancel?.(); } catch (e) { console.warn("[QuestAgent] cancel hook failed:", e); }
            wake();
        };
        ctl.gate = async () => {
            while (true) {
                if (ctl.cancelled) throw new Cancelled(ctl.reason);
                if (!ctl.paused) return;
                await new Promise(r => ctl.waiters.push(r));
            }
        };
        // Sleep that ends early on cancel and doesn't count time spent paused.
        ctl.sleep = async ms => {
            let left = ms;
            while (true) {
                await ctl.gate();
                if (left <= 0) return;
                const started = Date.now();
                await new Promise(r => {
                    const t = setTimeout(() => { ctl.waiters = ctl.waiters.filter(f => f !== bump); r(); }, left);
                    const bump = () => { clearTimeout(t); r(); };
                    ctl.waiters.push(bump);
                });
                left -= Date.now() - started;
            }
        };
        return ctl;
    }

    // ---- Enrollment (auto-detect location) ------------------------------
    async function enroll(quest) {
        const name = quest.config.messages?.questName ?? `Quest ${quest.id}`;
        const order = state.enrollLocation != null
            ? [state.enrollLocation, ...CONFIG.enrollLocations.filter(l => l !== state.enrollLocation)]
            : CONFIG.enrollLocations.slice();
        for (const loc of order) {
            try {
                await api.post({ url: `/quests/${quest.id}/enroll`, body: { location: loc } });
                state.enrollLocation = loc;
                console.log(`[QuestAgent] Enrolled in "${name}" (location ${loc}).`);
                return true;
            } catch (e) {
                await sleep(400); // try next candidate
            }
        }
        console.warn(`[QuestAgent] Could not enroll in "${name}" with any known location - skipping it this session.`);
        return false;
    }

    // ---- Task runners (each resolves when the quest hits 100%) ----------
    function runVideo(quest, ctl, secondsNeeded, secondsDoneInit) {
        let secondsDone = secondsDoneInit;
        const speed = 7;
        return (async () => {
            let completed = false;
            while (true) {
                const remaining = Math.min(speed, secondsNeeded - secondsDone);
                await ctl.sleep(remaining * 1000);
                await ctl.gate();
                const timestamp = secondsDone + speed;
                const res = await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) } });
                completed = res.body.completed_at != null;
                secondsDone = Math.min(secondsNeeded, timestamp);
                if (timestamp >= secondsNeeded) break;
            }
            if (!completed) {
                await ctl.gate();
                await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
            }
        })();
    }

    function runActivity(quest, ctl, secondsNeeded) {
        const channelId =
            ChannelStore.getSortedPrivateChannels()[0]?.id ??
            Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0)?.VOCAL[0].channel.id;
        const streamKey = `call:${channelId}:1`;
        return (async () => {
            let lastProgress = -1, stalledPolls = 0;
            while (true) {
                await ctl.gate();
                const res = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
                const progress = res.body.progress.PLAY_ACTIVITY.value;
                console.log(`[QuestAgent] ${quest.config.messages.questName}: ${progress}/${secondsNeeded}`);
                if (progress >= secondsNeeded) {
                    await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
                    break;
                }
                stalledPolls = progress > lastProgress ? 0 : stalledPolls + 1;
                lastProgress = progress;
                // Discord isn't crediting progress - stop heartbeating instead of spamming forever.
                if (stalledPolls >= 10) throw new Error(`no progress after ${stalledPolls} heartbeats - aborting`);
                await ctl.sleep(20 * 1000);
            }
        })();
    }

    // Heartbeat events carry the quest they belong to; ignore other quests'.
    const heartbeatFor = (data, quest) => {
        const qid = data?.questId ?? data?.userStatus?.questId;
        return qid == null || String(qid) === String(quest.id);
    };
    const progressOf = (data, quest, taskName) =>
        quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress?.[taskName]?.value ?? 0);

    function runPlayDesktop(quest, ctl, applicationId, secondsNeeded, secondsDone) {
        const pid = Math.floor(Math.random() * 30000) + 1000;
        return new Promise((resolve, reject) => {
            api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
                if (ctl.cancelled) throw new Cancelled(ctl.reason);
                const appData = res.body[0];
                const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "");
                const fakeGame = {
                    cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                    exeName, exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                    hidden: false, isLauncher: false, id: applicationId, name: appData.name,
                    pid, pidPath: [pid], processName: appData.name, start: Date.now()
                };
                const fakeGames = [fakeGame];
                const realGetRunningGames = RunningGameStore.getRunningGames;
                const realGetGameForPID = RunningGameStore.getGameForPID;
                let applied = false;
                const apply = () => {
                    if (applied) return;
                    applied = true;
                    const realGames = realGetRunningGames.call(RunningGameStore);
                    RunningGameStore.getRunningGames = () => fakeGames;
                    RunningGameStore.getGameForPID = p => fakeGames.find(x => x.pid === p);
                    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames });
                };
                const restore = () => {
                    if (!applied) return;
                    applied = false;
                    RunningGameStore.getRunningGames = realGetRunningGames;
                    RunningGameStore.getGameForPID = realGetGameForPID;
                    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                };
                const fn = data => {
                    if (!heartbeatFor(data, quest)) return;
                    const progress = progressOf(data, quest, "PLAY_ON_DESKTOP");
                    console.log(`[QuestAgent] ${quest.config.messages.questName}: ${progress}/${secondsNeeded}`);
                    if (progress >= secondsNeeded) {
                        restore();
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        resolve();
                    }
                };
                ctl.onPause = restore;
                ctl.onResume = apply;
                ctl.onCancel = () => { restore(); FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn); reject(new Cancelled(ctl.reason)); };
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                if (!ctl.paused) apply();
                console.log(`[QuestAgent] Spoofed game to ${appData.name}. ~${Math.ceil((secondsNeeded - secondsDone) / 60)} min left.`);
            }).catch(reject);
        });
    }

    function runStreamDesktop(quest, ctl, applicationId, secondsNeeded, secondsDone) {
        const pid = Math.floor(Math.random() * 30000) + 1000;
        return new Promise((resolve, reject) => {
            const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
            let applied = false;
            const apply = () => { if (applied) return; applied = true; ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null }); };
            const restore = () => { if (!applied) return; applied = false; ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc; };
            const fn = data => {
                if (!heartbeatFor(data, quest)) return;
                const progress = progressOf(data, quest, "STREAM_ON_DESKTOP");
                console.log(`[QuestAgent] ${quest.config.messages.questName}: ${progress}/${secondsNeeded}`);
                if (progress >= secondsNeeded) {
                    restore();
                    FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                    resolve();
                }
            };
            ctl.onPause = restore;
            ctl.onResume = apply;
            ctl.onCancel = () => { restore(); FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn); reject(new Cancelled(ctl.reason)); };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
            if (!ctl.paused) apply();
            console.log(`[QuestAgent] Spoofed stream to app ${applicationId}. Stream any window in a VC (need 1+ other person) for ~${Math.ceil((secondsNeeded - secondsDone) / 60)} min.`);
        });
    }

    // ---- Dispatch a single quest ----------------------------------------
    /** Why a quest can't be started right now (null = it can). */
    function blockerOf(quest) {
        const taskName = enabledTaskOf(quest);
        if (!taskName) return supportedTasksOf(quest).length ? "type off" : "not automatable";
        if (NEEDS_SPOOF(taskName)) {
            if (!isApp) return "needs desktop app";
            const tc = taskConfigOf(quest);
            const applicationId = quest.config.application?.id ?? tc?.tasks?.[taskName]?.applications?.[0]?.id;
            if (applicationId == null) return "no app id";
        }
        return null;
    }

    /** Returns true if a task was started. */
    function startQuest(quest) {
        const questName = quest.config.messages?.questName ?? `Quest ${quest.id}`;
        const taskName = enabledTaskOf(quest);
        const blocker = blockerOf(quest);
        if (blocker) {
            if (blocker !== "type off") { console.log(`[QuestAgent] "${questName}": ${blocker} - skipping.`); state.handled.add(quest.id); }
            return false;
        }
        const taskConfig = taskConfigOf(quest);
        const applicationId = quest.config.application?.id ?? taskConfig?.tasks?.[taskName]?.applications?.[0]?.id;
        const applicationName = quest.config.application?.name ?? questName;
        const secondsNeeded = taskConfig.tasks[taskName].target;
        const secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
        const needsSpoof = NEEDS_SPOOF(taskName);

        if (needsSpoof) {
            if (state.spoofActive) return false; // busy; a later scan (or "run now") retries this one
            state.spoofActive = true;
        }
        state.handled.add(quest.id);

        const ctl = makeCtl();
        if (SETTINGS.paused) ctl.holds.add("all"); // born paused during a global pause
        let task;
        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") task = runVideo(quest, ctl, secondsNeeded, secondsDone);
        else if (taskName === "PLAY_ACTIVITY") task = runActivity(quest, ctl, secondsNeeded);
        else if (taskName === "PLAY_ON_DESKTOP") task = runPlayDesktop(quest, ctl, applicationId, secondsNeeded, secondsDone);
        else if (taskName === "STREAM_ON_DESKTOP") task = runStreamDesktop(quest, ctl, applicationId, secondsNeeded, secondsDone);
        else { if (needsSpoof) state.spoofActive = false; state.handled.delete(quest.id); return false; }

        state.activeTasks++;
        state.tasks.set(quest.id, { quest, taskName, ctl, startedAt: Date.now() });
        console.log(`[QuestAgent] Started "${questName}" (${taskName}).`);
        task.then(() => {
            notifyClaimable(questName, applicationName);
        }).catch(e => {
            if (e instanceof Cancelled) {
                console.log(`[QuestAgent] "${questName}" ${e.reason === "stop" ? "stopped by you" : "cancelled (" + e.reason + ")"}.`);
                // A stop keeps the quest in the skip list; any other cancel
                // (switching, type toggled off, agent stop) hands it back to the queue.
                if (e.reason !== "stop") state.handled.delete(quest.id);
                return;
            }
            console.warn(`[QuestAgent] "${questName}" failed:`, e);
            const fails = (state.failCounts.get(quest.id) ?? 0) + 1;
            state.failCounts.set(quest.id, fails);
            if (fails < CONFIG.maxTaskAttempts) state.handled.delete(quest.id); // allow a retry on a later scan
            else console.warn(`[QuestAgent] "${questName}" failed ${fails}x - giving up on it this session.`);
        }).finally(() => {
            if (needsSpoof) state.spoofActive = false;
            state.activeTasks--;
            state.tasks.delete(quest.id);
            maybeIdle();
            refreshUI();
        });
        return true;
    }

    // ---- Idle management -------------------------------------------------
    function armTimer() {
        if (state.timer == null) state.timer = setInterval(scan, SETTINGS.scanIntervalMs);
    }
    function disarmTimer() {
        if (state.timer != null) { clearInterval(state.timer); state.timer = null; }
    }
    // A quest still needs us if it's eligible, unfinished, not skipped, has an
    // enabled task type, and is either already enrolled or still enrollable.
    const needsWork = q =>
        isEligible(q) && !q.userStatus?.completedAt && !state.handled.has(q.id) && !state.skipped.has(q.id) &&
        enabledTaskOf(q) != null &&
        (q.userStatus?.enrolledAt != null || (SETTINGS.autoEnroll && !state.enrollFailed.has(q.id)));

    function maybeIdle() {
        if (state.stopped || state.activeTasks > 0 || state.timer == null) return;
        if (allQuests().some(needsWork)) return;
        disarmTimer();
        console.log("[QuestAgent] No quests left to do - going idle. Wakes automatically when new quests appear (or run __questAgent.scan()).");
    }

    // ---- Scan loop ------------------------------------------------------
    async function scan() {
        if (state.stopped || state.scanning || SETTINGS.paused) return;
        state.scanning = true;
        armTimer(); // wake from idle if a quest-refresh event or manual call got us here
        try {
            if (SETTINGS.autoEnroll) {
                const available = allQuests().filter(q =>
                    !q.userStatus?.enrolledAt && !q.userStatus?.completedAt && isEligible(q) && enabledTaskOf(q) != null &&
                    !state.handled.has(q.id) && !state.skipped.has(q.id) && !state.enrollFailed.has(q.id));
                if (available.length) {
                    console.log(`[QuestAgent] Accepting ${available.length} available quest(s)...`);
                    for (const q of available) {
                        if (!(await enroll(q))) state.enrollFailed.add(q.id);
                    }
                    await sleep(2500); // let the store reflect the new enrollment
                }
            }
            const pending = allQuests().filter(q =>
                q.userStatus?.enrolledAt && !q.userStatus?.completedAt && isEligible(q) &&
                !state.handled.has(q.id) && !state.skipped.has(q.id));
            for (const q of pending) {
                try { startQuest(q); } catch (e) {
                    state.handled.add(q.id); // one broken quest must not block the rest
                    console.warn(`[QuestAgent] Could not start "${q.config?.messages?.questName ?? q.id}":`, e);
                }
            }
        } catch (e) {
            console.warn("[QuestAgent] scan error:", e);
        } finally {
            state.scanning = false;
        }
        maybeIdle();
        refreshUI();
    }

    // ---- User operations (also exposed on window.__questAgent) ----------
    const ops = {
        pauseQuest(id) { const t = state.tasks.get(id); if (!t) return false; t.ctl.hold("user"); refreshUI(); return true; },
        resumeQuest(id) {
            const t = state.tasks.get(id); if (!t) return false;
            t.ctl.release("user");
            if (SETTINGS.paused) ops.setPaused(false); // resuming one quest lifts a global pause too
            refreshUI(); return true;
        },
        /** Cancel a running task and never start this quest again (until unskipped). */
        stopQuest(id) {
            state.skipped.add(id);
            const t = state.tasks.get(id);
            if (t) t.ctl.cancel("stop");
            saveSettings(); refreshUI();
            return true;
        },
        skipQuest(id) { return ops.stopQuest(id); },
        unskipQuest(id) {
            state.skipped.delete(id);
            state.handled.delete(id);
            saveSettings();
            scan();
            return true;
        },
        /** Clear a quest's failure count so the next scan retries it. */
        retryQuest(id) {
            state.failCounts.delete(id);
            state.handled.delete(id);
            state.enrollFailed.delete(id);
            scan();
            return true;
        },
        /** Start a quest now. Takes the spoof slot from whatever holds it (that one goes back to the queue). */
        async runNow(id) {
            const quest = questById(id);
            if (!quest || !isEligible(quest) || quest.userStatus?.completedAt) return false;
            if (state.tasks.has(id)) return ops.resumeQuest(id);
            state.skipped.delete(id);
            state.failCounts.delete(id);
            state.enrollFailed.delete(id);
            state.handled.delete(id);
            if (SETTINGS.paused) ops.setPaused(false);
            const taskName = enabledTaskOf(quest);
            if (!taskName) return false;
            if (!quest.userStatus?.enrolledAt) {
                if (!(await enroll(quest))) { state.enrollFailed.add(id); refreshUI(); return false; }
                await sleep(1500);
            }
            if (NEEDS_SPOOF(taskName) && state.spoofActive) {
                for (const [qid, t] of state.tasks) {
                    if (NEEDS_SPOOF(t.taskName) && qid !== id) t.ctl.cancel("switch");
                }
                for (let i = 0; i < 40 && state.spoofActive; i++) await sleep(50); // let the cancelled task unwind
            }
            const started = startQuest(questById(id) ?? quest);
            saveSettings(); refreshUI();
            return started;
        },
        /** Global pause: every running task pauses, scans do nothing. */
        setPaused(p) {
            p = !!p;
            if (SETTINGS.paused === p) return p;
            SETTINGS.paused = p;
            for (const t of state.tasks.values()) { if (p) t.ctl.hold("all"); else t.ctl.release("all"); }
            saveSettings();
            if (!p) scan(); else refreshUI();
            return p;
        },
        setType(taskName, on) {
            if (!SUPPORTED.includes(taskName)) return false;
            on = !!on;
            if (SETTINGS.types[taskName] === on) return on;
            SETTINGS.types[taskName] = on;
            if (!on) {
                // Running tasks of that type stop; the quests go back to the queue and show as "type off".
                for (const t of state.tasks.values()) if (t.taskName === taskName) t.ctl.cancel("type off");
            }
            saveSettings();
            if (on) scan(); else { maybeIdle(); refreshUI(); }
            return on;
        },
        setSetting(key, value) {
            switch (key) {
                case "autoEnroll": SETTINGS.autoEnroll = !!value; saveSettings(); if (value) scan(); else refreshUI(); return true;
                case "notify": SETTINGS.notify = !!value; saveSettings(); refreshUI(); return true;
                case "scanIntervalMs": {
                    const ms = Number(value);
                    if (!Number.isFinite(ms) || ms < 30000) return false;
                    SETTINGS.scanIntervalMs = ms;
                    if (state.timer != null) { disarmTimer(); armTimer(); }
                    saveSettings(); refreshUI(); return true;
                }
                case "paused": ops.setPaused(value); return true;
                default: return false;
            }
        },
        retryAllFailed() {
            for (const id of [...state.failCounts.keys(), ...state.enrollFailed]) { state.failCounts.delete(id); state.enrollFailed.delete(id); state.handled.delete(id); }
            scan();
        },
        clearSkipped() {
            for (const id of state.skipped) state.handled.delete(id);
            state.skipped.clear();
            saveSettings();
            scan();
        }
    };

    // ---- HUD: toolbar button + floating quest panel ----------------------
    // Discord's class names are hashed and change on updates, so the button
    // clones them off the live Inbox button instead of hardcoding them.
    const UI = { btn: null, panel: null, style: null, observer: null, tick: null, open: false, pos: null, sig: null, view: "quests", keyHandler: null, badgeTimer: null };

    // Inline icons keep the panel pure-ASCII (no glyphs to mangle) and crisp.
    const ICON = {
        video: "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm6 3.5v7l5-3.5-5-3.5Z",
        mobile: "M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H7Zm3 1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1ZM12 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
        desktop: "M3 4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7v2H7a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2h-3v-2h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3Z",
        stream: "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6.3 5.3a1 1 0 0 1 0 1.4 7.5 7.5 0 0 0 0 10.6 1 1 0 1 1-1.4 1.4 9.5 9.5 0 0 1 0-13.4 1 1 0 0 1 1.4 0Zm12.8 0a9.5 9.5 0 0 1 0 13.4 1 1 0 0 1-1.4-1.4 7.5 7.5 0 0 0 0-10.6 1 1 0 0 1 1.4-1.4Z",
        activity: "M12 2.5l2.3 6 6 2.3-6 2.3-2.3 6-2.3-6-6-2.3 6-2.3 2.3-6Z",
        orb: "M12 2l9.5 10L12 22 2.5 12 12 2Z",
        refresh: "M12 5a7 7 0 0 1 6.3 3.9 1 1 0 0 0 1.8-.9A9 9 0 0 0 4.2 8V6a1 1 0 0 0-2 0v4.5a1 1 0 0 0 1 1h4.5a1 1 0 1 0 0-2H5.4A7 7 0 0 1 12 5Zm8.8 7.5h-4.5a1 1 0 1 0 0 2h2.3A7 7 0 0 1 5.7 15.1a1 1 0 1 0-1.8.9A9 9 0 0 0 19.8 16v2a1 1 0 0 0 2 0v-4.5a1 1 0 0 0-1-1Z",
        close: "M5.3 5.3a1 1 0 0 1 1.4 0L12 10.6l5.3-5.3a1 1 0 1 1 1.4 1.4L13.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4L12 13.4l-5.3 5.3a1 1 0 0 1-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 0 1 0-1.4Z",
        play: "M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z",
        pause: "M7 5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-3 0v-11A1.5 1.5 0 0 1 7 5Zm10 0a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-3 0v-11A1.5 1.5 0 0 1 17 5Z",
        stop: "M6 6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 17.5v-11Z",
        skip: "M5 6.3v11.4a1 1 0 0 0 1.55.83L15 12.9v4.6a1.5 1.5 0 0 0 3 0V6.5a1.5 1.5 0 0 0-3 0v4.6L6.55 5.47A1 1 0 0 0 5 6.3Z",
        gear: "M10.3 2.5a1 1 0 0 0-1 .86l-.3 2.1a7.5 7.5 0 0 0-1.7 1l-2-.8a1 1 0 0 0-1.2.4L2.4 9.1a1 1 0 0 0 .2 1.3l1.7 1.3a7.6 7.6 0 0 0 0 2l-1.7 1.3a1 1 0 0 0-.2 1.3l1.7 3a1 1 0 0 0 1.2.4l2-.8a7.5 7.5 0 0 0 1.7 1l.3 2.1a1 1 0 0 0 1 .86h3.4a1 1 0 0 0 1-.86l.3-2.1a7.5 7.5 0 0 0 1.7-1l2 .8a1 1 0 0 0 1.2-.4l1.7-3a1 1 0 0 0-.2-1.3l-1.7-1.3a7.6 7.6 0 0 0 0-2l1.7-1.3a1 1 0 0 0 .2-1.3l-1.7-3a1 1 0 0 0-1.2-.4l-2 .8a7.5 7.5 0 0 0-1.7-1l-.3-2.1a1 1 0 0 0-1-.86h-3.4ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
        open: "M14 3a1 1 0 0 0 0 2h3.6l-8.3 8.3a1 1 0 0 0 1.4 1.4L19 6.4V10a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1h-6ZM5 7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4a1 1 0 1 0-2 0v4H5V9h4a1 1 0 0 0 0-2H5Z",
        check: "M9.6 16.2 5.4 12l1.4-1.4 2.8 2.8 7.6-7.6 1.4 1.4-9 9Z",
        plus: "M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z",
        back: "M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z",
        bell: "M12 2a1.5 1.5 0 0 1 1.5 1.5v.6A6 6 0 0 1 18 10v4l1.7 2.3a1 1 0 0 1-.8 1.7H5.1a1 1 0 0 1-.8-1.7L6 14v-4a6 6 0 0 1 4.5-5.9v-.6A1.5 1.5 0 0 1 12 2Zm-2.5 17h5a2.5 2.5 0 0 1-5 0Z",
        bolt: "M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z",
        timer: "M9 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Zm3 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 4a1 1 0 1 1 2 0v3.6l2.2 1.3a1 1 0 0 1-1 1.7l-2.7-1.6a1 1 0 0 1-.5-.9V10Z"
    };
    const svg = (path, cls, size, evenodd) =>
        `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor"${evenodd ? ' fill-rule="evenodd"' : ""} d="${path}"/></svg>`;

    const TASK_META = {
        WATCH_VIDEO: { label: "video", icon: ICON.video, title: "Watch a video", desc: "Trailer and video quests. Fully automatic." },
        WATCH_VIDEO_ON_MOBILE: { label: "mobile", icon: ICON.mobile, title: "Watch on mobile", desc: "Mobile video quests. Completes from the desktop just fine." },
        PLAY_ON_DESKTOP: { label: "play", icon: ICON.desktop, title: "Play a game", desc: "Pretends the game is running. Nothing gets installed or launched." },
        STREAM_ON_DESKTOP: { label: "stream", icon: ICON.stream, title: "Stream a game", desc: "You must Go Live in a voice channel with 1+ other person; the agent fakes which game." },
        PLAY_ACTIVITY: { label: "activity", icon: ICON.activity, title: "Play an activity", desc: "Heartbeats the activity without opening it." }
    };
    const REASON_TEXT = {
        "user": "skipped by you",
        "type off": "quest type is off",
        "failed": "failed too often",
        "enroll": "enroll rejected",
        "not automatable": "not automatable",
        "needs desktop app": "needs the desktop app",
        "no app id": "no game to spoof"
    };

    const orbsOf = q => {
        const rewards = q.config?.rewardsConfig?.rewards ?? [];
        return rewards.reduce((sum, r) => sum + (r.orbQuantity ?? 0), 0);
    };

    /** Bucket every quest into what the panel shows. */
    function snapshot() {
        const row = q => {
            const task = enabledTaskOf(q) ?? supportedTasksOf(q)[0] ?? Object.keys(taskConfigOf(q)?.tasks ?? {})[0];
            const target = taskConfigOf(q)?.tasks?.[task]?.target ?? 0;
            const value = Math.floor(q.userStatus?.progress?.[task]?.value ?? 0);
            // Discord ships per-quest game art; gameTile* are repo-relative CDN paths.
            const a = q.config?.assets ?? {};
            const rel = a.gameTileDark ?? a.gameTileLight ??
                (a.gameTile ? `quests/${q.id}/${a.gameTile}` : null);
            const t = state.tasks.get(q.id);
            return {
                id: q.id,
                name: q.config?.messages?.questName ?? q.id,
                task, target, value,
                pct: target ? Math.min(100, Math.round((value / target) * 100)) : 0,
                orbs: orbsOf(q),
                supported: SUPPORTED.includes(task),
                enrolled: !!q.userStatus?.enrolledAt,
                expires: q.config?.expiresAt,
                tile: rel ? `https://cdn.discordapp.com/${rel}` : null,
                color: q.config?.colors?.primary ?? null,
                paused: !!(t && t.ctl.paused),
                userPaused: !!(t && t.ctl.heldBy("user")),
                why: null
            };
        };

        const claimable = [], running = [], queued = [], available = [], blocked = [];
        let orbsClaimed = 0, orbsPending = 0;

        for (const q of allQuests()) {
            if (q.userStatus?.claimedAt) { orbsClaimed += orbsOf(q); continue; }
            if (q.userStatus?.completedAt) { claimable.push(row(q)); orbsPending += orbsOf(q); continue; }
            if (!live(q)) continue;
            const r = row(q);
            if (state.tasks.has(q.id)) { running.push(r); continue; }
            if (!r.supported) { if (q.userStatus?.enrolledAt) blocked.push({ ...r, why: "not automatable" }); continue; }
            if (state.skipped.has(q.id)) { blocked.push({ ...r, why: "user" }); continue; }
            const blocker = blockerOf(q);
            if (blocker) { if (blocker === "type off" || q.userStatus?.enrolledAt) blocked.push({ ...r, why: blocker }); continue; }
            if (state.enrollFailed.has(q.id)) { blocked.push({ ...r, why: "enroll" }); continue; }
            if ((state.failCounts.get(q.id) ?? 0) >= CONFIG.maxTaskAttempts) { blocked.push({ ...r, why: "failed" }); continue; }
            if (q.userStatus?.enrolledAt || SETTINGS.autoEnroll) queued.push(r);
            else available.push(r);
        }
        return { claimable, running, queued, available, blocked, orbsClaimed, orbsPending };
    }

    function ensureStyle() {
        if (UI.style?.isConnected) return;
        // Discord's current tokens first, hex fallbacks for older clients.
        const css = `
#qb-panel{--qb-bg:var(--background-surface-higher,#2b2d31);--qb-bg2:var(--background-base-lower,#1e1f22);
 --qb-bg3:var(--background-surface-highest,#313338);--qb-hover:var(--background-mod-subtle,rgba(255,255,255,.06));
 --qb-hover2:var(--background-mod-normal,rgba(255,255,255,.1));--qb-hover3:var(--background-mod-strong,rgba(255,255,255,.14));
 --qb-text:var(--text-default,#dbdee1);--qb-muted:var(--text-muted,#949ba4);--qb-border:var(--border-subtle,rgba(255,255,255,.08));
 --qb-brand:var(--brand-500,#5865f2);--qb-green:var(--status-positive,#23a55a);--qb-amber:var(--status-warning,#f0b232);
 --qb-red:var(--status-danger,#f23f43);--qb-r:var(--radius-md,12px);--qb-rs:var(--radius-sm,8px);
 position:fixed;z-index:10000;width:400px;max-height:76vh;display:flex;flex-direction:column;
 background:var(--qb-bg);color:var(--qb-text);border:1px solid var(--qb-border);border-radius:var(--qb-r);
 box-shadow:var(--shadow-high,0 12px 24px rgba(0,0,0,.45)),0 0 0 1px rgba(0,0,0,.25);
 font-family:var(--font-primary,"gg sans",sans-serif);font-size:13px;line-height:1.3;overflow:hidden;
 animation:qb-in .16s cubic-bezier(.2,.8,.3,1)}
#qb-panel *{box-sizing:border-box}
#qb-panel button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
@keyframes qb-in{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}
#qb-panel .qb-head{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 14px;cursor:grab;
 border-bottom:1px solid var(--qb-border);user-select:none}
#qb-panel .qb-head.qb-drag{cursor:grabbing}
#qb-panel .qb-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--qb-muted)}
#qb-panel .qb-dot.qb-live{animation:qb-pulse 2.2s ease-out infinite}
@keyframes qb-pulse{0%{box-shadow:0 0 0 0 rgba(240,178,50,.55)}70%{box-shadow:0 0 0 7px rgba(240,178,50,0)}
 100%{box-shadow:0 0 0 0 rgba(240,178,50,0)}}
#qb-panel .qb-title{font-weight:600;font-size:14px}
#qb-panel .qb-status{flex:1;min-width:0;font-size:12px;color:var(--qb-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#qb-panel .qb-status.qb-paused{color:var(--qb-amber)}
#qb-panel .qb-act{cursor:pointer;color:var(--qb-muted);display:flex;align-items:center;justify-content:center;width:28px;height:28px;
 border-radius:var(--qb-rs);flex:none;transition:background .12s,color .12s}
#qb-panel .qb-act:hover{color:var(--qb-text);background:var(--qb-hover2)}
#qb-panel .qb-act:active{transform:scale(.92)}
#qb-panel .qb-act.qb-on{color:var(--qb-text);background:var(--qb-hover3)}
#qb-panel .qb-act.qb-warn{color:var(--qb-amber)}
#qb-panel .qb-act.qb-spin svg{animation:qb-rot .6s ease}
@keyframes qb-rot{from{transform:rotate(0)}to{transform:rotate(360deg)}}
#qb-panel .qb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px 12px;
 border-bottom:1px solid var(--qb-border)}
#qb-panel .qb-stat{background:var(--qb-bg2);border-radius:var(--qb-rs);padding:8px 3px;text-align:center;
 border:1px solid transparent}
#qb-panel .qb-stat b{display:block;font-size:16px;line-height:1.2;font-variant-numeric:tabular-nums}
#qb-panel .qb-stat span{font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--qb-muted)}
#qb-panel .qb-stat.qb-zero b{color:var(--qb-muted);opacity:.45}
#qb-panel .qb-stat.qb-gold{background:rgba(240,178,50,.09);border-color:rgba(240,178,50,.22)}
#qb-panel .qb-stat.qb-gold b{color:var(--qb-amber)}
#qb-panel .qb-stat.qb-ready{background:rgba(35,165,90,.11);border-color:rgba(35,165,90,.3)}
#qb-panel .qb-stat.qb-ready b{color:var(--qb-green)}
#qb-panel .qb-body{overflow-y:auto;padding:2px 0 6px;scrollbar-width:thin}
#qb-panel .qb-body::-webkit-scrollbar{width:8px}
#qb-panel .qb-body::-webkit-scrollbar-track{background:transparent}
#qb-panel .qb-body::-webkit-scrollbar-thumb{background:var(--scrollbar-thin-thumb,var(--qb-bg2));border-radius:4px;
 border:2px solid transparent;background-clip:padding-box}
#qb-panel .qb-sec{display:flex;align-items:center;padding:10px 14px 5px;font-size:10.5px;font-weight:700;
 letter-spacing:.5px;text-transform:uppercase;color:var(--qb-muted)}
#qb-panel .qb-count{background:var(--qb-bg2);border-radius:8px;padding:1px 6px;margin-left:6px;
 font-size:10px;letter-spacing:0;color:var(--qb-text)}
#qb-panel .qb-row{position:relative;display:flex;gap:10px;padding:7px 12px 7px 14px;transition:background .1s;cursor:pointer}
#qb-panel .qb-row:hover{background:var(--qb-hover)}
#qb-panel .qb-row.qb-dim{opacity:.7}
#qb-panel .qb-row.qb-dim:hover{opacity:1}
#qb-panel .qb-tile{width:32px;height:32px;border-radius:var(--qb-rs);flex:none;object-fit:cover;margin-top:1px;
 background:var(--qb-bg2)}
#qb-panel .qb-tile-fb{display:flex;align-items:center;justify-content:center;color:var(--qb-muted)}
#qb-panel .qb-main{flex:1;min-width:0}
#qb-panel .qb-r1{display:flex;align-items:center;gap:7px;height:20px}
#qb-panel .qb-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;font-size:13.5px}
#qb-panel .qb-orbs{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:var(--qb-amber);flex:none}
#qb-panel .qb-tools{display:none;align-items:center;gap:2px;flex:none;margin-right:-4px}
#qb-panel .qb-row:hover .qb-tools,#qb-panel .qb-row:focus-within .qb-tools{display:inline-flex}
#qb-panel .qb-row:hover .qb-orbs.qb-hide-hover{display:none}
#qb-panel .qb-tool{width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;
 color:var(--qb-muted);transition:background .1s,color .1s}
#qb-panel .qb-tool:hover{background:var(--qb-hover3);color:var(--qb-text)}
#qb-panel .qb-tool.qb-danger:hover{color:var(--qb-red)}
#qb-panel .qb-tool.qb-go:hover{color:var(--qb-green)}
#qb-panel .qb-bar{position:relative;height:4px;border-radius:999px;background:var(--qb-bg2);margin-top:6px;overflow:hidden}
#qb-panel .qb-fill{height:100%;border-radius:999px;background:var(--qb-brand);position:relative;
 transition:width .5s cubic-bezier(.4,0,.2,1)}
#qb-panel .qb-fill.qb-done{background:var(--qb-green)}
#qb-panel .qb-fill.qb-active::after{content:"";position:absolute;inset:0;
 background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);
 animation:qb-shim 1.8s ease-in-out infinite}
#qb-panel .qb-fill.qb-hold{opacity:.55;background-image:repeating-linear-gradient(135deg,transparent 0 4px,rgba(0,0,0,.35) 4px 8px)}
@keyframes qb-shim{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
#qb-panel .qb-sub{display:flex;justify-content:space-between;gap:8px;font-size:11px;
 color:var(--qb-muted);margin-top:4px;font-variant-numeric:tabular-nums}
#qb-panel .qb-sub .qb-rt.qb-hold{color:var(--qb-amber)}
#qb-panel .qb-empty{padding:28px 16px;text-align:center;color:var(--qb-muted);font-size:12px;line-height:1.6}
#qb-panel .qb-empty svg{opacity:.35;margin-bottom:8px}
#qb-panel .qb-pending{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--qb-amber);padding:0 14px}
#qb-panel .qb-pending:not(:empty){padding:9px 14px;border-top:1px solid var(--qb-border);background:rgba(240,178,50,.05)}
/* settings view */
#qb-panel .qb-set{overflow-y:auto;padding:4px 0 8px}
#qb-panel .qb-set .qb-sec{padding-top:12px}
#qb-panel .qb-opt{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background .1s}
#qb-panel .qb-opt:hover{background:var(--qb-hover)}
#qb-panel .qb-opt .qb-oi{width:32px;height:32px;border-radius:var(--qb-rs);background:var(--qb-bg2);display:flex;align-items:center;
 justify-content:center;color:var(--qb-muted);flex:none}
#qb-panel .qb-opt.qb-on .qb-oi{color:var(--qb-text)}
#qb-panel .qb-ot{flex:1;min-width:0}
#qb-panel .qb-ot b{display:block;font-weight:500;font-size:13.5px}
#qb-panel .qb-ot span{display:block;font-size:11px;color:var(--qb-muted);margin-top:1px}
#qb-panel .qb-sw{width:40px;height:24px;border-radius:14px;background:var(--primary-400,#80848e);position:relative;flex:none;
 transition:background .15s}
#qb-panel .qb-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
 transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.3)}
#qb-panel .qb-sw svg{position:absolute;z-index:1;top:6px;left:6px;width:12px;height:12px;color:var(--primary-400,#80848e);transition:left .15s}
#qb-panel .qb-opt.qb-on .qb-sw{background:var(--qb-green)}
#qb-panel .qb-opt.qb-on .qb-sw::after{left:19px}
#qb-panel .qb-opt.qb-on .qb-sw svg{left:22px;color:var(--qb-green)}
#qb-panel .qb-seg{display:flex;gap:4px;padding:4px 14px 8px}
#qb-panel .qb-seg button{flex:1;height:30px;border-radius:var(--qb-rs);background:var(--qb-bg2);color:var(--qb-muted);font-size:12px;
 font-weight:500;border:1px solid transparent;transition:background .1s,color .1s}
#qb-panel .qb-seg button:hover{color:var(--qb-text);background:var(--qb-hover2)}
#qb-panel .qb-seg button.qb-on{background:var(--qb-brand);color:#fff}
#qb-panel .qb-btns{display:flex;gap:8px;padding:6px 14px 8px}
#qb-panel .qb-btn{flex:1;height:32px;border-radius:var(--qb-rs);background:var(--qb-hover2);border:1px solid var(--qb-border);
 font-size:12.5px;font-weight:500;color:var(--qb-text);display:inline-flex;align-items:center;justify-content:center;gap:6px;
 transition:background .1s}
#qb-panel .qb-btn:hover{background:var(--qb-hover3)}
#qb-panel .qb-foot{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--qb-border);
 font-size:11px;color:var(--qb-muted)}
#qb-panel .qb-foot span{flex:1}
#qb-panel .qb-foot a{color:var(--qb-brand);cursor:pointer;text-decoration:none}
#qb-panel .qb-foot a:hover{text-decoration:underline}
/* title-bar badge */
#qb-badge{position:absolute;top:-2px;right:-4px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;
 color:#fff;font-size:10px;font-weight:700;line-height:15px;text-align:center;display:flex;align-items:center;justify-content:center;
 border:2px solid var(--background-base-lower,#1e1f22);box-sizing:content-box;pointer-events:none}
#qb-badge.qb-claim{background:var(--status-positive,#23a55a)}
#qb-badge.qb-work{background:var(--status-warning,#f0b232)}
#qb-badge.qb-hold{background:var(--primary-400,#80848e)}
#qb-btn .qb-ring{position:absolute;inset:1px;border-radius:50%;box-sizing:border-box;
 border:1.5px solid rgba(240,178,50,.25);border-top-color:#f0b232;
 animation:qb-spin .9s linear infinite;pointer-events:none}
@keyframes qb-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
        UI.style = document.createElement("style");
        UI.style.id = "qb-style";
        UI.style.textContent = css;
        document.head.appendChild(UI.style);
    }

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const tool = (act, title, icon, cls) =>
        `<button class="qb-tool ${cls ?? ""}" data-act="${act}" title="${title}" aria-label="${title}">${svg(icon, "", 14)}</button>`;

    /** Hover actions for one row, by group. */
    function toolsFor(r, group) {
        switch (group) {
            case "running":
                return (r.paused ? tool("resume", r.userPaused ? "Resume" : "Resume (lifts the global pause)", ICON.play, "qb-go") : tool("pause", "Pause", ICON.pause)) +
                    tool("stop", "Stop and skip", ICON.stop, "qb-danger");
            case "queued":
                return tool("run", "Run now", ICON.play, "qb-go") + tool("skip", "Skip", ICON.skip, "qb-danger");
            case "available":
                return tool("run", "Accept and run", ICON.plus, "qb-go") + tool("skip", "Skip", ICON.skip, "qb-danger");
            case "blocked":
                if (r.why === "user") return tool("unskip", "Put back in the queue", ICON.play, "qb-go");
                if (r.why === "failed" || r.why === "enroll") return tool("retry", "Try again", ICON.refresh, "qb-go");
                return "";
            default:
                return "";
        }
    }

    /** Static markup for one quest row; dynamic bits are filled by updateRow. */
    function rowHtml(r, group) {
        const meta = TASK_META[r.task] ?? { label: String(r.task ?? "?").toLowerCase(), icon: ICON.activity };
        const tile = r.tile
            ? `<img class="qb-tile" src="${esc(r.tile)}" alt="" loading="lazy"
                 onerror="this.outerHTML='<div class=&quot;qb-tile qb-tile-fb&quot;></div>'">`
            : `<div class="qb-tile qb-tile-fb">${svg(meta.icon, "", 16)}</div>`;
        const tools = toolsFor(r, group);
        return `<div class="qb-row ${group === "blocked" ? "qb-dim" : ""}" data-qid="${esc(r.id)}" title="Open the Quests page">
            ${tile}
            <div class="qb-main">
              <div class="qb-r1">
                <span class="qb-name" title="${esc(r.name)}">${esc(r.name)}</span>
                ${r.orbs ? `<span class="qb-orbs ${tools ? "qb-hide-hover" : ""}">${svg(ICON.orb, "", 9)}${r.orbs}</span>` : ""}
                ${tools ? `<span class="qb-tools">${tools}</span>` : ""}
              </div>
              <div class="qb-bar"><div class="qb-fill"></div></div>
              <div class="qb-sub"><span class="qb-lt"></span><span class="qb-rt"></span></div>
            </div>
          </div>`;
    }

    /** Update only the values that change, so the DOM isn't rebuilt every tick. */
    function updateRow(el, r, group) {
        const meta = TASK_META[r.task] ?? { label: String(r.task ?? "?").toLowerCase() };
        const fill = el.querySelector(".qb-fill");
        const liveRow = group === "running" && !r.paused;
        fill.style.width = r.pct + "%";
        fill.style.backgroundColor = (r.color && r.pct < 100) ? r.color : ""; // color only: keeps the paused stripes
        fill.classList.toggle("qb-done", r.pct >= 100);
        fill.classList.toggle("qb-active", liveRow && r.pct < 100);
        fill.classList.toggle("qb-hold", group === "running" && r.paused);
        const mins = r.target > r.value ? Math.ceil((r.target - r.value) / 60) : 0;
        el.querySelector(".qb-lt").textContent = `${meta.label}  ${r.value}/${r.target}s`;
        const rt = el.querySelector(".qb-rt");
        rt.classList.toggle("qb-hold", group === "running" && r.paused);
        rt.textContent =
            r.why ? (REASON_TEXT[r.why] ?? r.why)
            : group === "running" && r.paused ? "paused"
            : r.pct >= 100 ? "complete"
            : group === "available" ? "not accepted"
            : mins ? `~${mins} min left` : "";
    }

    function statusText(s) {
        if (state.stopped) return "stopped";
        if (SETTINGS.paused) return "paused";
        if (s.running.length) {
            const paused = s.running.filter(r => r.paused).length;
            return `working on ${s.running.length}${paused ? ` (${paused} paused)` : ""}`;
        }
        if (s.claimable.length) return `${s.claimable.length} ready to claim`;
        if (s.queued.length) return "waiting for a free slot";
        return "idle";
    }

    function renderQuests(s) {
        const body = UI.panel.querySelector(".qb-body");
        const groups = [
            ["Ready to claim", s.claimable, "claimable"],
            ["Running", s.running, "running"],
            ["Queued", s.queued, "queued"],
            ["Available", s.available, "available"],
            ["Skipped", s.blocked, "blocked"]
        ].filter(g => g[1].length);

        // Rebuild only when the set of rows (or their tool state) changes; otherwise patch in place.
        const sig = groups.map(([t, rows]) => t + ":" + rows.map(r => r.id + (r.paused ? "p" : "") + (r.why ?? "")).join(",")).join("|");
        if (sig !== UI.sig) {
            body.innerHTML = groups.length
                ? groups.map(([title, rows, key]) =>
                    `<div class="qb-sec">${title}<span class="qb-count">${rows.length}</span></div>` +
                    rows.map(r => rowHtml(r, key)).join("")).join("")
                : `<div class="qb-empty">${svg(ICON.orb, "", 26)}<br>Nothing to do right now.<br>
                     Waiting for Discord to post new quests.</div>`;
            UI.sig = sig;
        }
        for (const [, rows, key] of groups) {
            for (const r of rows) {
                const el = body.querySelector(`[data-qid="${r.id}"]`);
                if (el) updateRow(el, r, key);
            }
        }
    }

    function renderSettings() {
        const box = UI.panel.querySelector(".qb-set");
        const opt = (key, on, icon, title, desc) =>
            `<div class="qb-opt ${on ? "qb-on" : ""}" data-opt="${key}" role="switch" aria-checked="${on}" tabindex="0">
               <span class="qb-oi">${svg(icon, "", 16)}</span>
               <span class="qb-ot"><b>${title}</b><span>${desc}</span></span>
               <span class="qb-sw">${svg(on ? ICON.check : ICON.close, "", 12)}</span>
             </div>`;
        const mins = Math.round(SETTINGS.scanIntervalMs / 60000);
        box.innerHTML = `
          <div class="qb-sec">Automation</div>
          ${opt("autoEnroll", SETTINGS.autoEnroll, ICON.bolt, "Auto-accept quests", "Enroll in every new quest the agent can do. Off: accept them yourself from the Available group.")}
          ${opt("notify", SETTINGS.notify, ICON.bell, "Notifications", "OS notification and taskbar flash when a reward is ready to claim.")}
          <div class="qb-sec">Quest types</div>
          ${SUPPORTED.map(t => opt("type:" + t, SETTINGS.types[t], TASK_META[t].icon, TASK_META[t].title, TASK_META[t].desc)).join("")}
          <div class="qb-sec">${svg(ICON.timer, "", 12)}&nbsp;Look for new quests every</div>
          <div class="qb-seg">${[1, 2, 5, 10].map(m => `<button data-int="${m}" class="${m === mins ? "qb-on" : ""}">${m} min</button>`).join("")}</div>
          <div class="qb-sec">Maintenance</div>
          <div class="qb-btns">
            <button class="qb-btn" data-cmd="retry">${svg(ICON.refresh, "", 13)}Retry failed quests</button>
            <button class="qb-btn" data-cmd="clearskip">${svg(ICON.play, "", 13)}Clear skip list (${state.skipped.size})</button>
          </div>`;
    }

    function renderPanel() {
        if (!UI.panel) return;
        const s = snapshot();
        const quests = UI.view === "quests";
        UI.panel.querySelector(".qb-stats").style.display = quests ? "" : "none";
        UI.panel.querySelector(".qb-body").style.display = quests ? "" : "none";
        UI.panel.querySelector(".qb-pending").style.display = quests ? "" : "none";
        UI.panel.querySelector(".qb-set").style.display = quests ? "none" : "";
        UI.panel.querySelector(".qb-foot").style.display = quests ? "none" : "";
        UI.panel.querySelector("#qb-gear").classList.toggle("qb-on", !quests);
        UI.panel.querySelector(".qb-title").textContent = quests ? "Quests" : "Settings";

        if (quests) renderQuests(s);
        else if (UI.sig !== "settings") { renderSettings(); UI.sig = "settings"; }

        const setStat = (id, val, cls) => {
            const b = UI.panel.querySelector("#qb-s-" + id);
            if (b.textContent !== String(val)) b.textContent = val;
            const tile = b.parentElement;
            tile.classList.toggle("qb-zero", !val);
            if (cls) tile.classList.toggle(cls, !!val);
        };
        setStat("run", s.running.length);
        setStat("queue", s.queued.length + s.available.length);
        setStat("claim", s.claimable.length, "qb-ready");
        setStat("orbs", s.orbsClaimed);

        const active = state.activeTasks > 0 && !SETTINGS.paused;
        const dot = UI.panel.querySelector(".qb-dot");
        dot.style.background = state.stopped ? "var(--qb-red)" : SETTINGS.paused ? "var(--qb-amber)" : active ? "var(--qb-amber)" : s.claimable.length ? "var(--qb-green)" : "";
        dot.classList.toggle("qb-live", active);
        const st = UI.panel.querySelector(".qb-status");
        st.textContent = statusText(s);
        st.classList.toggle("qb-paused", SETTINGS.paused);

        const pa = UI.panel.querySelector("#qb-pauseall");
        pa.innerHTML = svg(SETTINGS.paused ? ICON.play : ICON.pause, "", 15);
        pa.title = SETTINGS.paused ? "Resume everything" : "Pause everything";
        pa.classList.toggle("qb-warn", SETTINGS.paused);

        const pend = UI.panel.querySelector("#qb-pending");
        const wantPend = s.orbsPending
            ? `${svg(ICON.orb, "", 9)} ${s.orbsPending} orbs waiting - claim them in Discover \u2192 Quests`
            : "";
        if (pend.innerHTML !== wantPend) pend.innerHTML = wantPend;
    }

    /** Re-render the panel (if open) and badge after a state change. */
    function refreshUI() {
        try { if (UI.open) renderPanel(); updateBadge(); } catch (e) { /* HUD must never break the agent */ }
    }

    /** Navigate the client to the Quests page (where Claim lives).
     *  /quest-home is the current route; /discovery/quests was its older home,
     *  kept as a fallback in case Discord moves it back under Discover. The
     *  client redirects unknown routes home, so a dead route is harmless -
     *  checked via pathname after a beat. */
    function openQuestsPage() {
        if (!NavTransitionTo) {
            console.warn("[QuestAgent] transitionTo not hooked - can't open the Quests page.");
            return false;
        }
        try {
            NavTransitionTo("/quest-home");
            setTimeout(() => {
                if (!location.pathname.startsWith("/quest-home")) NavTransitionTo("/discovery/quests");
            }, 400);
            return true;
        }
        catch (e) { console.warn("[QuestAgent] Failed to open the Quests page:", e); return false; }
    }

    function onRowAction(act, id) {
        switch (act) {
            case "pause": ops.pauseQuest(id); break;
            case "resume": ops.resumeQuest(id); break;
            case "stop": case "skip": ops.stopQuest(id); break;
            case "unskip": ops.unskipQuest(id); break;
            case "retry": ops.retryQuest(id); break;
            case "run": ops.runNow(id).then(refreshUI); break;
        }
        refreshUI();
    }

    function buildPanel() {
        ensureStyle();
        const p = document.createElement("div");
        p.id = "qb-panel";
        p.setAttribute("role", "dialog");
        p.setAttribute("aria-label", "Quest agent");
        p.innerHTML = `
          <div class="qb-head">
            <span class="qb-dot"></span><span class="qb-title">Quests</span>
            <span class="qb-status"></span>
            <button class="qb-act" id="qb-pauseall" title="Pause everything">${svg(ICON.pause, "", 15)}</button>
            <button class="qb-act" id="qb-scan" title="Scan for quests now">${svg(ICON.refresh, "", 15)}</button>
            <button class="qb-act" id="qb-gear" title="Settings">${svg(ICON.gear, "", 15, true)}</button>
            <button class="qb-act qb-x" title="Close">${svg(ICON.close, "", 15)}</button>
          </div>
          <div class="qb-stats">
            <div class="qb-stat"><b id="qb-s-run">0</b><span>running</span></div>
            <div class="qb-stat"><b id="qb-s-queue">0</b><span>queued</span></div>
            <div class="qb-stat"><b id="qb-s-claim">0</b><span>to claim</span></div>
            <div class="qb-stat qb-gold"><b id="qb-s-orbs">0</b><span>orbs won</span></div>
          </div>
          <div class="qb-body"></div>
          <div class="qb-set" style="display:none"></div>
          <div class="qb-pending" id="qb-pending"></div>
          <div class="qb-foot" style="display:none"><span>Discord Quest Agent v${AGENT_VERSION}</span><a id="qb-openq">Open Quests page</a></div>`;
        // Anchor to the top-right corner by default; dragging switches to left/top.
        if (UI.pos) { p.style.top = UI.pos.top + "px"; p.style.left = UI.pos.left + "px"; }
        else { p.style.top = "40px"; p.style.right = "12px"; }

        p.querySelector(".qb-x").onclick = () => togglePanel(false);
        p.querySelector("#qb-pauseall").onclick = () => { ops.setPaused(!SETTINGS.paused); refreshUI(); };
        p.querySelector("#qb-gear").onclick = () => { UI.view = UI.view === "quests" ? "settings" : "quests"; UI.sig = null; renderPanel(); };
        p.querySelector("#qb-openq").onclick = () => { if (openQuestsPage()) togglePanel(false); };
        // Rows are rebuilt via innerHTML whenever the quest set changes, so
        // clicks are delegated: a tool button runs its action, anything else
        // on a row jumps to the Quests page (where every quest and Claim live).
        p.querySelector(".qb-body").addEventListener("click", e => {
            const btn = e.target.closest("[data-act]");
            if (btn) { e.stopPropagation(); onRowAction(btn.dataset.act, btn.closest(".qb-row").dataset.qid); return; }
            if (e.target.closest(".qb-row") && openQuestsPage()) togglePanel(false);
        });
        const setBox = p.querySelector(".qb-set");
        const flip = opt => {
            const key = opt.dataset.opt;
            const on = !opt.classList.contains("qb-on");
            if (key.startsWith("type:")) ops.setType(key.slice(5), on); else ops.setSetting(key, on);
            UI.sig = null; renderPanel();
        };
        setBox.addEventListener("click", e => {
            const opt = e.target.closest("[data-opt]");
            if (opt) { flip(opt); return; }
            const seg = e.target.closest("[data-int]");
            if (seg) { ops.setSetting("scanIntervalMs", Number(seg.dataset.int) * 60000); UI.sig = null; renderPanel(); return; }
            const cmd = e.target.closest("[data-cmd]");
            if (cmd) {
                if (cmd.dataset.cmd === "retry") ops.retryAllFailed();
                if (cmd.dataset.cmd === "clearskip") ops.clearSkipped();
                UI.sig = null; renderPanel();
            }
        });
        setBox.addEventListener("keydown", e => {
            const opt = e.target.closest("[data-opt]");
            if (opt && (e.key === " " || e.key === "Enter")) { e.preventDefault(); flip(opt); }
        });
        const scanBtn = p.querySelector("#qb-scan");
        scanBtn.onclick = () => {
            scanBtn.classList.add("qb-spin");
            setTimeout(() => scanBtn.classList.remove("qb-spin"), 600);
            scan(); renderPanel();
        };

        // drag by header
        const head = p.querySelector(".qb-head");
        head.addEventListener("mousedown", e => {
            if (e.target.closest(".qb-act")) return;
            const r = p.getBoundingClientRect();
            const dx = e.clientX - r.left, dy = e.clientY - r.top;
            head.classList.add("qb-drag");
            p.style.right = "auto"; // switch from right-anchored to left-anchored
            const move = ev => {
                const left = Math.max(0, Math.min(window.innerWidth - r.width, ev.clientX - dx));
                const top = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
                p.style.left = left + "px"; p.style.top = top + "px";
                UI.pos = { top, left };
            };
            const up = () => {
                head.classList.remove("qb-drag");
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
            };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
            e.preventDefault();
        });
        return p;
    }

    function togglePanel(force) {
        const want = force ?? !UI.open;
        if (want) {
            if (!UI.panel?.isConnected) { UI.sig = null; UI.panel = buildPanel(); document.body.appendChild(UI.panel); }
            UI.open = true;
            renderPanel();
            // Self-heal: if a stored position leaves it off-screen (resolution or
            // window change), snap back to the default top-right anchor.
            const r = UI.panel.getBoundingClientRect();
            if (r.right > window.innerWidth || r.bottom > window.innerHeight || r.left < 0 || r.top < 0) {
                UI.pos = null;
                UI.panel.style.left = "auto"; UI.panel.style.right = "12px"; UI.panel.style.top = "40px";
            }
            if (UI.tick == null) UI.tick = setInterval(renderPanel, 1000);
            if (!UI.keyHandler) {
                UI.keyHandler = e => { if (e.key === "Escape" && UI.open) togglePanel(false); };
                document.addEventListener("keydown", UI.keyHandler);
            }
        } else {
            UI.open = false;
            if (UI.tick != null) { clearInterval(UI.tick); UI.tick = null; }
            if (UI.keyHandler) { document.removeEventListener("keydown", UI.keyHandler); UI.keyHandler = null; }
            UI.panel?.remove();
        }
        updateBadge();
    }

    function updateBadge() {
        if (!UI.btn?.isConnected) return;
        const s = snapshot();
        const badge = UI.btn.querySelector("#qb-badge");
        const ring = UI.btn.querySelector(".qb-ring");
        const working = s.running.length + s.queued.length;
        badge.classList.remove("qb-claim", "qb-work", "qb-hold");
        // Claimable wins: green + how many rewards are waiting. Then grey pause
        // glyph while everything is paused. Otherwise amber + spinning ring
        // while quests are still running. Nothing to show = hidden.
        if (s.claimable.length) {
            badge.style.display = ""; ring.style.display = "none";
            badge.textContent = s.claimable.length > 99 ? "99+" : s.claimable.length;
            badge.classList.add("qb-claim");
            UI.btn.title = `${s.claimable.length} quest reward(s) ready to claim`;
        } else if (SETTINGS.paused && working) {
            badge.style.display = ""; ring.style.display = "none";
            badge.innerHTML = svg(ICON.pause, "", 9);
            badge.classList.add("qb-hold");
            UI.btn.title = "Quest agent paused";
        } else if (working) {
            badge.style.display = ""; ring.style.display = "";
            badge.textContent = working > 99 ? "99+" : working;
            badge.classList.add("qb-work");
            UI.btn.title = `${working} quest(s) in progress`;
        } else {
            badge.style.display = "none"; ring.style.display = "none";
            UI.btn.title = "Quest agent (idle)";
        }
    }

    /** Insert the toolbar button next to Inbox, cloning Discord's own classes. */
    function installButton() {
        if (UI.btn?.isConnected) return true;
        const inbox = document.querySelector('[aria-label="Inbox"]');
        const container = inbox?.closest('[class*="trailing_"]');
        if (!container) return false;
        ensureStyle();

        const wrapper = document.createElement("div");
        // mimic the Inbox button's own wrapper + clickable classes
        const inboxWrapper = inbox.closest('[class*="iconWrapper_"]');
        if (inboxWrapper) wrapper.className = inboxWrapper.className;
        wrapper.style.position = "relative";
        wrapper.id = "qb-btn";

        const btn = document.createElement("div");
        btn.className = inbox.className;
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-label", "Quest agent");
        btn.setAttribute("tabindex", "0");
        btn.innerHTML = `<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1H9Zm1 3V4h4v1h-4Zm6.7 5.7-5 5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.79 4.3-4.3a1 1 0 0 1 1.4 1.41Z"/>
          </svg><div id="qb-badge" style="display:none"></div>`;
        btn.onclick = () => togglePanel();
        btn.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(); } };

        const ring = document.createElement("div");
        ring.className = "qb-ring";
        ring.style.display = "none";

        wrapper.appendChild(btn);
        wrapper.appendChild(ring);
        container.insertBefore(wrapper, container.firstChild);
        UI.btn = wrapper;
        updateBadge();
        return true;
    }

    function installUI() {
        if (typeof document === "undefined") return;
        installButton();
        // Discord re-renders the title bar (channel switches, etc.) and drops our
        // node; re-add it whenever that happens, and keep the badge fresh.
        UI.observer = new MutationObserver(() => { if (!UI.btn?.isConnected) installButton(); });
        UI.observer.observe(document.body, { childList: true, subtree: true });
        UI.badgeTimer = setInterval(() => { if (!UI.open) updateBadge(); }, 5000);
    }

    function removeUI() {
        try { UI.observer?.disconnect(); } catch (e) { /* ignore */ }
        if (UI.tick != null) { clearInterval(UI.tick); UI.tick = null; }
        if (UI.badgeTimer != null) { clearInterval(UI.badgeTimer); UI.badgeTimer = null; }
        if (UI.keyHandler) { document.removeEventListener("keydown", UI.keyHandler); UI.keyHandler = null; }
        UI.btn?.remove(); UI.panel?.remove(); UI.style?.remove();
        UI.btn = UI.panel = UI.style = null; UI.open = false;
    }

    // ---- Install --------------------------------------------------------
    armTimer();
    let onQuestsRefresh;
    try {
        onQuestsRefresh = () => scan();
        FluxDispatcher.subscribe("QUESTS_FETCH_CURRENT_QUESTS_SUCCESS", onQuestsRefresh);
    } catch (e) { /* event name may differ; interval still covers it */ }

    function stop() {
        state.stopped = true;
        disarmTimer();
        for (const t of state.tasks.values()) t.ctl.cancel("agent stopped");
        try { if (onQuestsRefresh) FluxDispatcher.unsubscribe("QUESTS_FETCH_CURRENT_QUESTS_SUCCESS", onQuestsRefresh); } catch (e) { /* ignore */ }
        removeUI();
        try { storageFrame?.remove(); } catch (e) { /* ignore */ }
        console.log("[QuestAgent] Stopped.");
    }

    if (CONFIG.hud !== false) {
        try { installUI(); } catch (e) { console.warn("[QuestAgent] HUD failed to install:", e); }
    }

    window.__questAgent = {
        version: AGENT_VERSION, installedAt: Date.now(), state, scan, stop, config: CONFIG, settings: SETTINGS,
        ...ops,
        nav: !!NavTransitionTo, // false = quest rows won't navigate (finder broke)
        persistent: !!storage,  // false = settings live only for this session
        ui: { toggle: togglePanel, snapshot, reinstall: installButton, remove: removeUI, openQuests: openQuestsPage, refresh: refreshUI }
    };
    console.log(`%c[QuestAgent] Agent v${AGENT_VERSION} installed. Watching for quests...`, "color:#5865f2;font-weight:bold");
    if (SETTINGS.paused) console.log("[QuestAgent] Paused (from saved settings). Resume from the HUD.");
    scan();
})();
