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
 *   - fails loudly (notification) if a Discord update changes its internals.
 *
 * Idempotent: re-injecting is a no-op while an agent is already running.
 *
 * WARNING: Automating quests violates Discord's ToS. Your account, your risk.
 */
(async () => {
    "use strict";
    const AGENT_VERSION = 9;

    if (window.__questAgent && !window.__questAgentForce) {
        console.log(`[QuestAgent] Agent v${window.__questAgent.version} already running - skipping.`);
        return;
    }

    // ---- Config ---------------------------------------------------------
    // Defaults below are overridden by config.json, which the launcher injects
    // as window.__questAgentConfig before this script runs.
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

    const SUPPORTED = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];
    const isApp = typeof DiscordNative !== "undefined";
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ---- Notifications (defined early so the failure path can use them) --
    function notifyRaw(title, body) {
        if (typeof CONFIG !== "undefined" && CONFIG.notify === false) return;
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

    // ---- State ----------------------------------------------------------
    const state = {
        handled: new Set(),      // quest ids already started/finished
        enrollFailed: new Set(), // quest ids that rejected every enroll location - not retried
        failCounts: new Map(),   // quest id -> failed task runs (capped by CONFIG.maxTaskAttempts)
        enrollLocation: null,    // cached working enroll location
        spoofActive: false,      // only one game/stream spoof at a time
        scanning: false,
        activeTasks: 0,          // tasks currently running (idle check waits for 0)
        timer: null,             // rescan interval; null while idle
        stopped: false           // set by stop(); scans become no-ops
    };

    const isEligible = q =>
        new Date(q.config?.expiresAt ?? 0).getTime() > Date.now() &&
        SUPPORTED.some(t => (q.config?.taskConfig ?? q.config?.taskConfigV2)?.tasks?.[t] != null);

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
    function runVideo(quest, taskName, secondsNeeded, secondsDoneInit) {
        let secondsDone = secondsDoneInit;
        const speed = 7;
        return (async () => {
            let completed = false;
            while (true) {
                const remaining = Math.min(speed, secondsNeeded - secondsDone);
                await sleep(remaining * 1000);
                const timestamp = secondsDone + speed;
                const res = await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) } });
                completed = res.body.completed_at != null;
                secondsDone = Math.min(secondsNeeded, timestamp);
                if (timestamp >= secondsNeeded) break;
            }
            if (!completed) await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
        })();
    }

    function runActivity(quest, secondsNeeded) {
        const channelId =
            ChannelStore.getSortedPrivateChannels()[0]?.id ??
            Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0)?.VOCAL[0].channel.id;
        const streamKey = `call:${channelId}:1`;
        return (async () => {
            let lastProgress = -1, stalledPolls = 0;
            while (true) {
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
                await sleep(20 * 1000);
            }
        })();
    }

    function runPlayDesktop(quest, applicationId, secondsNeeded, secondsDone) {
        const pid = Math.floor(Math.random() * 30000) + 1000;
        return new Promise((resolve, reject) => {
            api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
                const appData = res.body[0];
                const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "");
                const fakeGame = {
                    cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                    exeName, exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                    hidden: false, isLauncher: false, id: applicationId, name: appData.name,
                    pid, pidPath: [pid], processName: appData.name, start: Date.now()
                };
                const realGames = RunningGameStore.getRunningGames();
                const fakeGames = [fakeGame];
                const realGetRunningGames = RunningGameStore.getRunningGames;
                const realGetGameForPID = RunningGameStore.getGameForPID;
                RunningGameStore.getRunningGames = () => fakeGames;
                RunningGameStore.getGameForPID = p => fakeGames.find(x => x.pid === p);
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames });

                const fn = data => {
                    const progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
                    console.log(`[QuestAgent] ${quest.config.messages.questName}: ${progress}/${secondsNeeded}`);
                    if (progress >= secondsNeeded) {
                        RunningGameStore.getRunningGames = realGetRunningGames;
                        RunningGameStore.getGameForPID = realGetGameForPID;
                        FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        resolve();
                    }
                };
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                console.log(`[QuestAgent] Spoofed game to ${appData.name}. ~${Math.ceil((secondsNeeded - secondsDone) / 60)} min left.`);
            }).catch(reject);
        });
    }

    function runStreamDesktop(quest, applicationId, secondsNeeded, secondsDone) {
        const pid = Math.floor(Math.random() * 30000) + 1000;
        return new Promise(resolve => {
            const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
            ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null });
            const fn = data => {
                const progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
                console.log(`[QuestAgent] ${quest.config.messages.questName}: ${progress}/${secondsNeeded}`);
                if (progress >= secondsNeeded) {
                    ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                    FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                    resolve();
                }
            };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
            console.log(`[QuestAgent] Spoofed stream to app ${applicationId}. Stream any window in a VC (need 1+ other person) for ~${Math.ceil((secondsNeeded - secondsDone) / 60)} min.`);
        });
    }

    // ---- Dispatch a single quest ----------------------------------------
    function startQuest(quest) {
        const questName = quest.config.messages?.questName ?? `Quest ${quest.id}`;
        const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
        const taskName = SUPPORTED.find(x => taskConfig?.tasks?.[x] != null);
        if (!taskName) return;
        // Newer quest configs dropped the top-level `application`; the id now
        // lives per-task in taskConfigV2.tasks[<task>].applications[]. Only the
        // game/stream spoofs actually need it (they fetch the name via the API).
        const applicationId = quest.config.application?.id ??
            taskConfig?.tasks?.[taskName]?.applications?.[0]?.id;
        const applicationName = quest.config.application?.name ?? questName;
        const secondsNeeded = taskConfig.tasks[taskName].target;
        const secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
        const needsSpoof = taskName === "PLAY_ON_DESKTOP" || taskName === "STREAM_ON_DESKTOP";

        if (needsSpoof) {
            if (!isApp) {
                console.log(`[QuestAgent] "${questName}" needs the desktop app - skipping.`);
                state.handled.add(quest.id);
                return;
            }
            if (applicationId == null) {
                console.log(`[QuestAgent] "${questName}" has no application id to spoof - skipping.`);
                state.handled.add(quest.id);
                return;
            }
            if (state.spoofActive) return; // busy; a later scan retries this one
            state.spoofActive = true;
        }
        state.handled.add(quest.id);

        let task;
        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") task = runVideo(quest, taskName, secondsNeeded, secondsDone);
        else if (taskName === "PLAY_ACTIVITY") task = runActivity(quest, secondsNeeded);
        else if (taskName === "PLAY_ON_DESKTOP") task = runPlayDesktop(quest, applicationId, secondsNeeded, secondsDone);
        else if (taskName === "STREAM_ON_DESKTOP") task = runStreamDesktop(quest, applicationId, secondsNeeded, secondsDone);
        else { if (needsSpoof) state.spoofActive = false; state.handled.delete(quest.id); return; }

        state.activeTasks++;
        console.log(`[QuestAgent] Started "${questName}" (${taskName}).`);
        task.then(() => {
            notifyClaimable(questName, applicationName);
        }).catch(e => {
            console.warn(`[QuestAgent] "${questName}" failed:`, e);
            const fails = (state.failCounts.get(quest.id) ?? 0) + 1;
            state.failCounts.set(quest.id, fails);
            if (fails < CONFIG.maxTaskAttempts) state.handled.delete(quest.id); // allow a retry on a later scan
            else console.warn(`[QuestAgent] "${questName}" failed ${fails}x - giving up on it this session.`);
        }).finally(() => {
            if (needsSpoof) state.spoofActive = false;
            state.activeTasks--;
            maybeIdle();
        });
    }

    // ---- Idle management -------------------------------------------------
    function armTimer() {
        if (state.timer == null) state.timer = setInterval(scan, CONFIG.scanIntervalMs);
    }
    function disarmTimer() {
        if (state.timer != null) { clearInterval(state.timer); state.timer = null; }
    }
    // A quest still needs us if it's eligible, unfinished, and either already
    // enrolled or still enrollable (auto-enroll on and not written off).
    const needsWork = q =>
        isEligible(q) && !q.userStatus?.completedAt && !state.handled.has(q.id) &&
        (q.userStatus?.enrolledAt != null || (CONFIG.autoEnroll && !state.enrollFailed.has(q.id)));

    function maybeIdle() {
        if (state.stopped || state.activeTasks > 0 || state.timer == null) return;
        if ([...QuestsStore.quests.values()].some(needsWork)) return;
        disarmTimer();
        console.log("[QuestAgent] No quests left to do - going idle. Wakes automatically when new quests appear (or run __questAgent.scan()).");
    }

    // ---- Scan loop ------------------------------------------------------
    async function scan() {
        if (state.stopped || state.scanning) return;
        state.scanning = true;
        armTimer(); // wake from idle if a quest-refresh event or manual call got us here
        try {
            if (CONFIG.autoEnroll) {
                const available = [...QuestsStore.quests.values()].filter(q =>
                    !q.userStatus?.enrolledAt && !q.userStatus?.completedAt && isEligible(q) &&
                    !state.handled.has(q.id) && !state.enrollFailed.has(q.id));
                if (available.length) {
                    console.log(`[QuestAgent] Accepting ${available.length} available quest(s)...`);
                    for (const q of available) {
                        if (!(await enroll(q))) state.enrollFailed.add(q.id);
                    }
                    await sleep(2500); // let the store reflect the new enrollment
                }
            }
            const pending = [...QuestsStore.quests.values()].filter(q =>
                q.userStatus?.enrolledAt && !q.userStatus?.completedAt && isEligible(q) && !state.handled.has(q.id));
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
    }

    // ---- HUD: toolbar button + floating quest panel ----------------------
    // Discord's class names are hashed and change on updates, so the button
    // clones them off the live Inbox button instead of hardcoding them.
    const UI = { btn: null, panel: null, style: null, observer: null, tick: null, open: false, pos: null, sig: null };

    // Inline icons keep the panel pure-ASCII (no glyphs to mangle) and crisp.
    const ICON = {
        video: "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm6 3.5v7l5-3.5-5-3.5Z",
        mobile: "M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H7Zm3 1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1ZM12 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
        desktop: "M3 4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7v2H7a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2h-3v-2h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3Z",
        stream: "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6.3 5.3a1 1 0 0 1 0 1.4 7.5 7.5 0 0 0 0 10.6 1 1 0 1 1-1.4 1.4 9.5 9.5 0 0 1 0-13.4 1 1 0 0 1 1.4 0Zm12.8 0a9.5 9.5 0 0 1 0 13.4 1 1 0 0 1-1.4-1.4 7.5 7.5 0 0 0 0-10.6 1 1 0 0 1 1.4-1.4Z",
        activity: "M12 2.5l2.3 6 6 2.3-6 2.3-2.3 6-2.3-6-6-2.3 6-2.3 2.3-6Z",
        orb: "M12 2l9.5 10L12 22 2.5 12 12 2Z",
        refresh: "M12 5a7 7 0 0 1 6.3 3.9 1 1 0 0 0 1.8-.9A9 9 0 0 0 4.2 8V6a1 1 0 0 0-2 0v4.5a1 1 0 0 0 1 1h4.5a1 1 0 1 0 0-2H5.4A7 7 0 0 1 12 5Zm8.8 7.5h-4.5a1 1 0 1 0 0 2h2.3A7 7 0 0 1 5.7 15.1a1 1 0 1 0-1.8.9A9 9 0 0 0 19.8 16v2a1 1 0 0 0 2 0v-4.5a1 1 0 0 0-1-1Z",
        close: "M5.3 5.3a1 1 0 0 1 1.4 0L12 10.6l5.3-5.3a1 1 0 1 1 1.4 1.4L13.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4L12 13.4l-5.3 5.3a1 1 0 0 1-1.4-1.4l5.3-5.3-5.3-5.3a1 1 0 0 1 0-1.4Z"
    };
    const svg = (path, cls, size) =>
        `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;

    const TASK_META = {
        WATCH_VIDEO: { label: "video", icon: ICON.video },
        WATCH_VIDEO_ON_MOBILE: { label: "mobile", icon: ICON.mobile },
        PLAY_ON_DESKTOP: { label: "play", icon: ICON.desktop },
        STREAM_ON_DESKTOP: { label: "stream", icon: ICON.stream },
        PLAY_ACTIVITY: { label: "activity", icon: ICON.activity }
    };

    const orbsOf = q => {
        const rewards = q.config?.rewardsConfig?.rewards ?? [];
        return rewards.reduce((sum, r) => sum + (r.orbQuantity ?? 0), 0);
    };

    /** Bucket every quest into what the panel shows. */
    function snapshot() {
        const quests = [...QuestsStore.quests.values()];
        const live = q => new Date(q.config?.expiresAt ?? 0).getTime() > Date.now();
        const taskOf = q => {
            const tc = q.config?.taskConfig ?? q.config?.taskConfigV2;
            return SUPPORTED.find(t => tc?.tasks?.[t] != null) ?? Object.keys(tc?.tasks ?? {})[0];
        };
        const row = q => {
            const task = taskOf(q);
            const tc = q.config?.taskConfig ?? q.config?.taskConfigV2;
            const target = tc?.tasks?.[task]?.target ?? 0;
            const value = Math.floor(q.userStatus?.progress?.[task]?.value ?? 0);
            // Discord ships per-quest game art; gameTile* are repo-relative CDN paths.
            const a = q.config?.assets ?? {};
            const rel = a.gameTileDark ?? a.gameTileLight ??
                (a.gameTile ? `quests/${q.id}/${a.gameTile}` : null);
            return {
                id: q.id,
                name: q.config?.messages?.questName ?? q.id,
                task, target, value,
                pct: target ? Math.min(100, Math.round((value / target) * 100)) : 0,
                orbs: orbsOf(q),
                supported: SUPPORTED.includes(task),
                expires: q.config?.expiresAt,
                tile: rel ? `https://cdn.discordapp.com/${rel}` : null,
                color: q.config?.colors?.primary ?? null
            };
        };

        const claimable = [], running = [], queued = [], blocked = [];
        let orbsClaimed = 0, orbsPending = 0;

        for (const q of quests) {
            if (q.userStatus?.claimedAt) { orbsClaimed += orbsOf(q); continue; }
            if (q.userStatus?.completedAt) { claimable.push(row(q)); orbsPending += orbsOf(q); continue; }
            if (!live(q)) continue;
            const r = row(q);
            if (!r.supported) { if (q.userStatus?.enrolledAt) blocked.push({ ...r, why: "not automatable" }); continue; }
            if (state.enrollFailed.has(q.id)) { blocked.push({ ...r, why: "enroll rejected" }); continue; }
            if ((state.failCounts.get(q.id) ?? 0) >= CONFIG.maxTaskAttempts) { blocked.push({ ...r, why: "failed too often" }); continue; }
            if (state.handled.has(q.id)) running.push(r);
            else if (q.userStatus?.enrolledAt || CONFIG.autoEnroll) queued.push(r);
        }
        return { claimable, running, queued, blocked, orbsClaimed, orbsPending };
    }

    function ensureStyle() {
        if (UI.style?.isConnected) return;
        const css = `
#qb-panel{position:fixed;z-index:10000;width:376px;max-height:72vh;display:flex;flex-direction:column;
 background:var(--background-secondary,#2b2d31);color:var(--text-normal,#dbdee1);
 border:1px solid var(--background-tertiary,#1e1f22);border-radius:10px;
 box-shadow:0 12px 32px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.2);
 font-family:var(--font-primary,"gg sans",sans-serif);font-size:13px;overflow:hidden;
 animation:qb-in .16s cubic-bezier(.2,.8,.3,1)}
@keyframes qb-in{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}
#qb-panel .qb-head{display:flex;align-items:center;gap:8px;padding:11px 12px;cursor:grab;
 background:var(--background-secondary-alt,#232428);border-bottom:1px solid var(--background-tertiary,#1e1f22);user-select:none}
#qb-panel .qb-head.qb-drag{cursor:grabbing}
#qb-panel .qb-title{font-weight:600;font-size:14px;letter-spacing:.1px}
#qb-panel .qb-ver{flex:1;font-size:10px;color:var(--text-muted,#949ba4);opacity:.7}
#qb-panel .qb-dot{width:8px;height:8px;border-radius:50%;flex:none}
#qb-panel .qb-dot.qb-live{animation:qb-pulse 2.2s ease-out infinite}
@keyframes qb-pulse{0%{box-shadow:0 0 0 0 rgba(240,178,50,.55)}70%{box-shadow:0 0 0 7px rgba(240,178,50,0)}
 100%{box-shadow:0 0 0 0 rgba(240,178,50,0)}}
#qb-panel .qb-act{cursor:pointer;color:var(--text-muted,#949ba4);display:flex;padding:4px;border-radius:5px;flex:none;
 transition:background .12s,color .12s}
#qb-panel .qb-act:hover{color:var(--text-normal,#dbdee1);background:var(--background-modifier-hover,#3f4147)}
#qb-panel .qb-act:active{transform:scale(.92)}
#qb-panel .qb-act.qb-spin svg{animation:qb-rot .6s ease}
@keyframes qb-rot{from{transform:rotate(0)}to{transform:rotate(360deg)}}
#qb-panel .qb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px 12px;
 border-bottom:1px solid var(--background-tertiary,#1e1f22)}
#qb-panel .qb-stat{background:var(--background-primary,#313338);border-radius:7px;padding:7px 3px;text-align:center;
 border:1px solid transparent}
#qb-panel .qb-stat b{display:block;font-size:15px;line-height:1.25;font-variant-numeric:tabular-nums}
#qb-panel .qb-stat span{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted,#949ba4)}
#qb-panel .qb-stat.qb-zero b{color:var(--text-muted,#949ba4);opacity:.4}
#qb-panel .qb-stat.qb-gold{background:rgba(240,178,50,.09);border-color:rgba(240,178,50,.22)}
#qb-panel .qb-stat.qb-gold b{color:#f0b232}
#qb-panel .qb-stat.qb-ready{background:rgba(35,165,90,.11);border-color:rgba(35,165,90,.3)}
#qb-panel .qb-stat.qb-ready b{color:#23a55a}
#qb-panel .qb-body{overflow-y:auto;padding:2px 0 6px}
#qb-panel .qb-body::-webkit-scrollbar{width:8px}
#qb-panel .qb-body::-webkit-scrollbar-track{background:transparent}
#qb-panel .qb-body::-webkit-scrollbar-thumb{background:var(--background-tertiary,#1e1f22);border-radius:4px;
 border:2px solid transparent;background-clip:padding-box}
#qb-panel .qb-sec{display:flex;align-items:center;padding:10px 12px 5px;font-size:10px;font-weight:700;
 letter-spacing:.6px;text-transform:uppercase;color:var(--text-muted,#949ba4)}
#qb-panel .qb-count{background:var(--background-tertiary,#1e1f22);border-radius:8px;padding:1px 6px;margin-left:6px;
 font-size:10px;letter-spacing:0;color:var(--text-normal,#dbdee1)}
#qb-panel .qb-row{display:flex;gap:9px;padding:7px 12px;transition:background .1s;cursor:pointer}
#qb-panel .qb-row:hover{background:var(--background-modifier-hover,rgba(255,255,255,.035))}
#qb-panel .qb-tile{width:28px;height:28px;border-radius:7px;flex:none;object-fit:cover;margin-top:1px;
 background:var(--background-tertiary,#1e1f22)}
#qb-panel .qb-tile-fb{display:flex;align-items:center;justify-content:center;color:var(--text-muted,#949ba4)}
#qb-panel .qb-main{flex:1;min-width:0}
#qb-panel .qb-r1{display:flex;align-items:center;gap:7px}
#qb-panel .qb-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
#qb-panel .qb-orbs{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:#f0b232;flex:none}
#qb-panel .qb-bar{position:relative;height:4px;border-radius:999px;background:var(--background-tertiary,#1e1f22);
 margin-top:6px;overflow:hidden}
#qb-panel .qb-fill{height:100%;border-radius:999px;background:var(--brand-500,#5865f2);position:relative;
 transition:width .5s cubic-bezier(.4,0,.2,1)}
#qb-panel .qb-fill.qb-done{background:#23a55a}
#qb-panel .qb-fill.qb-active::after{content:"";position:absolute;inset:0;
 background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);
 animation:qb-shim 1.8s ease-in-out infinite}
@keyframes qb-shim{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
#qb-panel .qb-sub{display:flex;justify-content:space-between;gap:8px;font-size:11px;
 color:var(--text-muted,#949ba4);margin-top:4px;font-variant-numeric:tabular-nums}
#qb-panel .qb-empty{padding:26px 16px;text-align:center;color:var(--text-muted,#949ba4);font-size:12px;line-height:1.6}
#qb-panel .qb-empty svg{opacity:.35;margin-bottom:8px}
#qb-panel .qb-pending{display:flex;align-items:center;gap:5px;font-size:11px;color:#f0b232;padding:0 12px}
#qb-panel .qb-pending:not(:empty){padding:9px 12px;border-top:1px solid var(--background-tertiary,#1e1f22);
 background:rgba(240,178,50,.05)}
#qb-badge{position:absolute;top:-2px;right:-4px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;
 color:#fff;font-size:10px;font-weight:700;line-height:15px;text-align:center;
 border:2px solid var(--background-tertiary,#1e1f22);box-sizing:content-box;pointer-events:none}
/* green + count = rewards waiting to be claimed */
#qb-badge.qb-claim{background:#23a55a}
/* amber = quests still being worked */
#qb-badge.qb-work{background:#f0b232}
/* Classic border spinner: faint track + one bright arc. Lives on the square
   button wrapper (not the pill badge) so the circle stays a true circle. */
#qb-btn .qb-ring{position:absolute;inset:1px;border-radius:50%;box-sizing:border-box;
 border:1.5px solid rgba(240,178,50,.25);border-top-color:#f0b232;
 animation:qb-spin .9s linear infinite;pointer-events:none}
@keyframes qb-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
        UI.style = document.createElement("style");
        UI.style.id = "qb-style";
        UI.style.textContent = css;
        document.head.appendChild(UI.style);
    }

    /** Static markup for one quest row; dynamic bits are filled by updateRow. */
    function rowHtml(r) {
        const meta = TASK_META[r.task] ?? { label: String(r.task ?? "?").toLowerCase(), icon: ICON.activity };
        const tile = r.tile
            ? `<img class="qb-tile" src="${esc(r.tile)}" alt="" loading="lazy"
                 onerror="this.outerHTML='<div class=&quot;qb-tile qb-tile-fb&quot;></div>'">`
            : `<div class="qb-tile qb-tile-fb">${svg(meta.icon, "", 15)}</div>`;
        return `<div class="qb-row" data-qid="${esc(r.id)}" title="Open the Quests page">
            ${tile}
            <div class="qb-main">
              <div class="qb-r1">
                <span class="qb-name" title="${esc(r.name)}">${esc(r.name)}</span>
                ${r.orbs ? `<span class="qb-orbs">${svg(ICON.orb, "", 9)}${r.orbs}</span>` : ""}
              </div>
              <div class="qb-bar"><div class="qb-fill"></div></div>
              <div class="qb-sub"><span class="qb-lt"></span><span class="qb-rt"></span></div>
            </div>
          </div>`;
    }

    /** Update only the values that change, so the DOM isn't rebuilt every tick. */
    function updateRow(el, r, live) {
        const meta = TASK_META[r.task] ?? { label: String(r.task ?? "?").toLowerCase() };
        const fill = el.querySelector(".qb-fill");
        fill.style.width = r.pct + "%";
        if (r.color && r.pct < 100) fill.style.background = r.color;
        fill.classList.toggle("qb-done", r.pct >= 100);
        fill.classList.toggle("qb-active", live && r.pct < 100);
        const mins = r.target > r.value ? Math.ceil((r.target - r.value) / 60) : 0;
        el.querySelector(".qb-lt").textContent = `${meta.label}  ${r.value}/${r.target}s`;
        el.querySelector(".qb-rt").textContent =
            r.why ? r.why : r.pct >= 100 ? "complete" : mins ? `~${mins} min left` : "";
    }

    function renderPanel() {
        if (!UI.panel) return;
        const s = snapshot();
        const body = UI.panel.querySelector(".qb-body");
        const groups = [
            ["Ready to claim", s.claimable, false],
            ["Running now", s.running, true],
            ["Queued", s.queued, false],
            ["Skipped", s.blocked, false]
        ].filter(g => g[1].length);

        // Rebuild only when the set of rows changes; otherwise patch in place.
        const sig = groups.map(([t, rows]) => t + ":" + rows.map(r => r.id).join(",")).join("|");
        if (sig !== UI.sig) {
            body.innerHTML = groups.length
                ? groups.map(([title, rows]) =>
                    `<div class="qb-sec">${title}<span class="qb-count">${rows.length}</span></div>` +
                    rows.map(rowHtml).join("")).join("")
                : `<div class="qb-empty">${svg(ICON.orb, "", 26)}<br>Nothing to do right now.<br>
                     Waiting for Discord to post new quests.</div>`;
            UI.sig = sig;
        }
        for (const [, rows, live] of groups) {
            for (const r of rows) {
                const el = body.querySelector(`[data-qid="${r.id}"]`);
                if (el) updateRow(el, r, live);
            }
        }

        const setStat = (id, val, cls) => {
            const b = UI.panel.querySelector("#qb-s-" + id);
            if (b.textContent !== String(val)) b.textContent = val;
            const tile = b.parentElement;
            tile.classList.toggle("qb-zero", !val);
            if (cls) tile.classList.toggle(cls, !!val);
        };
        setStat("run", s.running.length);
        setStat("queue", s.queued.length);
        setStat("claim", s.claimable.length, "qb-ready");
        setStat("orbs", s.orbsClaimed);

        const dot = UI.panel.querySelector(".qb-dot");
        const active = state.activeTasks > 0;
        dot.style.background = state.stopped ? "#f23f43" : active ? "#f0b232" : s.claimable.length ? "#23a55a" : "#949ba4";
        dot.classList.toggle("qb-live", active);
        dot.title = state.stopped ? "stopped" : active ? `working on ${state.activeTasks}` : "idle";

        const pend = UI.panel.querySelector("#qb-pending");
        const wantPend = s.orbsPending
            ? `${svg(ICON.orb, "", 9)} ${s.orbsPending} orbs waiting - claim them in Discover \u2192 Quests`
            : "";
        if (pend.innerHTML !== wantPend) pend.innerHTML = wantPend;
    }

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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

    function buildPanel() {
        ensureStyle();
        const p = document.createElement("div");
        p.id = "qb-panel";
        p.innerHTML = `
          <div class="qb-head">
            <span class="qb-dot"></span><span class="qb-title">Auto Quests</span>
            <span class="qb-ver">v${AGENT_VERSION}</span>
            <span class="qb-act" id="qb-scan" title="Scan for quests now">${svg(ICON.refresh, "", 14)}</span>
            <span class="qb-act qb-x" title="Close">${svg(ICON.close, "", 14)}</span>
          </div>
          <div class="qb-stats">
            <div class="qb-stat"><b id="qb-s-run">0</b><span>running</span></div>
            <div class="qb-stat"><b id="qb-s-queue">0</b><span>queued</span></div>
            <div class="qb-stat"><b id="qb-s-claim">0</b><span>to claim</span></div>
            <div class="qb-stat qb-gold"><b id="qb-s-orbs">0</b><span>orbs won</span></div>
          </div>
          <div class="qb-body"></div>
          <div class="qb-pending" id="qb-pending"></div>`;
        // Anchor to the top-right corner by default; dragging switches to left/top.
        if (UI.pos) { p.style.top = UI.pos.top + "px"; p.style.left = UI.pos.left + "px"; }
        else { p.style.top = "40px"; p.style.right = "12px"; }

        p.querySelector(".qb-x").onclick = () => togglePanel(false);
        // Rows are rebuilt via innerHTML whenever the quest set changes, so the
        // click handler is delegated instead of attached per row. Any row jumps
        // to the Quests page - that's where every quest (and Claim) lives.
        p.querySelector(".qb-body").addEventListener("click", e => {
            if (e.target.closest(".qb-row") && openQuestsPage()) togglePanel(false);
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
            if (e.target.closest(".qb-x")) return;
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
        } else {
            UI.open = false;
            if (UI.tick != null) { clearInterval(UI.tick); UI.tick = null; }
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
        badge.classList.remove("qb-claim", "qb-work");
        // Claimable wins: green + how many rewards are waiting. Otherwise amber +
        // spinning ring while quests are still running. Nothing to show = hidden.
        const n = s.claimable.length || working;
        if (n === 0) { badge.style.display = "none"; ring.style.display = "none"; return; }
        badge.style.display = "";
        badge.textContent = n > 99 ? "99+" : n;
        badge.classList.add(s.claimable.length ? "qb-claim" : "qb-work");
        ring.style.display = s.claimable.length ? "none" : "";
        UI.btn.title = s.claimable.length
            ? `${s.claimable.length} quest reward(s) ready to claim`
            : `${working} quest(s) in progress`;
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
        btn.setAttribute("aria-label", "Auto Quests");
        btn.setAttribute("tabindex", "0");
        btn.innerHTML = `<svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1H9Zm1 3V4h4v1h-4Zm6.7 5.7-5 5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.79 4.3-4.3a1 1 0 0 1 1.4 1.41Z"/>
          </svg><div id="qb-badge" style="display:none"></div>`;
        btn.onclick = () => togglePanel();

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
        setInterval(() => { if (!UI.open) updateBadge(); }, 5000);
    }

    function removeUI() {
        try { UI.observer?.disconnect(); } catch (e) { /* ignore */ }
        if (UI.tick != null) { clearInterval(UI.tick); UI.tick = null; }
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
        try { if (onQuestsRefresh) FluxDispatcher.unsubscribe("QUESTS_FETCH_CURRENT_QUESTS_SUCCESS", onQuestsRefresh); } catch (e) { /* ignore */ }
        removeUI();
        console.log("[QuestAgent] Stopped.");
    }

    if (CONFIG.hud !== false) {
        try { installUI(); } catch (e) { console.warn("[QuestAgent] HUD failed to install:", e); }
    }

    window.__questAgent = {
        version: AGENT_VERSION, installedAt: Date.now(), state, scan, stop, config: CONFIG,
        nav: !!NavTransitionTo, // false = quest rows won't navigate (finder broke)
        ui: { toggle: togglePanel, snapshot, reinstall: installButton, remove: removeUI, openQuests: openQuestsPage }
    };
    console.log(`%c[QuestAgent] Agent v${AGENT_VERSION} installed. Watching for quests...`, "color:#5865f2;font-weight:bold");
    scan();
})();
