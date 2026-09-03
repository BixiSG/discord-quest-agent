# HUD controls, quest settings, and a reliable uninstall

Date: 2026-09-03. Target release: v1.1.0 (agent script v10).

## Why

Three reports from the maintainer:

1. After `Uninstall.bat`, the agent "comes back" on the next Discord or PC restart.
2. Suspected: the agent throttles internet bandwidth.
3. The HUD is read-only. Users need to skip a quest, switch to another one,
   pause or stop a quest in progress, and choose which quest types run at all.

## Findings (1 and 2)

**Reinstall after uninstall.** On the maintainer's machine the cause is not this
tool. A separate project, `Vencord Auto Updater`, has a Startup-folder shortcut
that launches Discord with `--remote-debugging-port=9222` at login and keeps a
`Launch-QuestBypass.ps1 -Watch` process attached, which re-injects the older
`quest-bypass.js` every time the renderer comes up. This tool's own install has
no Startup entry and no Start Menu folder left, so its uninstall did what it
could. The uninstaller still has real weaknesses that could bite other users:

- It deletes the install folder from a detached shell after a fixed 2 s delay
  and never verifies the result. If `cmd.exe` (the `.bat` waiting on `pause`)
  still has the folder as its working directory, the folder survives.
- It leaves Discord running with the debugging port open and the injected
  agent still alive in memory until the user restarts Discord themselves.
- It does not tell the user about *other* launchers on the machine that will
  bring an agent back.

**Bandwidth.** The agent's own network use is a handful of small JSON requests:
one `enroll` per quest, a `video-progress` POST every 7 s while a video quest
runs, a `heartbeat` every 20 s for activity quests, and one self-update check
per start. Everything else (CDP) is localhost. It cannot throttle a connection.
The only heavy traffic in the picture is a real "Go Live" stream, which
`STREAM_ON_DESKTOP` quests require the user to run for ~15 min, and Discord's
own update download after a restart. Verdict: not caused by the agent; check
Task Manager > App history or Settings > Network > Data usage to see which
process actually consumed the data.

## Design

### A. Uninstall (scripts/Uninstall.ps1, Uninstall.bat, Install.ps1)

- `Uninstall.bat` changes directory to `%TEMP%` before starting PowerShell so no
  process holds the install folder as its working directory.
- The uninstaller, in order:
  1. Stops every process running `QuestAgent.ps1`, from any path.
  2. Removes the Startup shortcut and the Start Menu folder.
  3. If Discord is running with the configured debugging port, asks the injected
     agent to stop (`window.__questAgent.stop()` over CDP), closes Discord, and
     relaunches it through `Update.exe` without the flag. `-KeepDiscord` skips
     this step. Result: after uninstall nothing of the agent is left running.
  4. Deletes the install folder synchronously with retries and reports success
     or the exact path to delete by hand. `-KeepConfig` keeps `config.json`.
  5. Scans the Startup folder and `HKCU\...\Run` for entries whose target,
     arguments, or (for `.vbs`/`.ps1`/`.bat`/`.cmd` targets) file contents mention
     `QuestAgent`, `quest-agent`, `QuestBypass`, or `remote-debugging-port`. Lists
     them as a warning ("not installed by this tool, remove it yourself"), never
     deletes them.
- `Install.ps1` adds an "Uninstall Quest Agent" Start Menu shortcut.
- `QuestAgent.ps1` watchdog exits if `quest-agent.js` disappears from disk
  (uninstall in progress) instead of continuing to poll.

### B. Agent core: controllable tasks (src/quest-agent.js)

Every running task owns a controller `{ paused, cancelled, gate(), sleep(ms) }`.
Runners await `gate()` between steps; `gate()` throws `Cancelled` when cancelled
and waits while paused. Spoof runners (PLAY_ON_DESKTOP, STREAM_ON_DESKTOP) undo
their store patches on pause or cancel and re-apply on resume, so Discord stops
sending heartbeats for the spoofed game while paused.

User-facing operations, all exposed on `window.__questAgent`:

| Operation | Effect |
| --- | --- |
| `pauseQuest(id)` / `resumeQuest(id)` | Pause or resume one running task. |
| `stopQuest(id)` | Cancel the task and add the quest to the skip list. |
| `skipQuest(id)` / `unskipQuest(id)` | Never start this quest / allow it again. Unskip triggers a scan. |
| `runNow(id)` | Start a queued quest immediately. If it needs the single spoof slot and another spoof task holds it, that task is cancelled and returned to the queue (not counted as a failure). |
| `retryQuest(id)` | Clear the failure count for a quest that hit `maxTaskAttempts`. |
| `setPaused(bool)` | Global pause: pauses every running task and makes scans no-ops. |
| `setSetting(key, value)` | Update a persisted setting (below). |

Cancellation for a switch (`runNow`) removes the quest from `handled` so a later
scan can pick it up again; a user stop adds it to the skip list instead.

### C. Settings (persisted in the renderer)

```
{ autoEnroll, notify, scanIntervalMs, paused,
  types: { WATCH_VIDEO, WATCH_VIDEO_ON_MOBILE, PLAY_ON_DESKTOP, STREAM_ON_DESKTOP, PLAY_ACTIVITY },
  skipped: [questId, ...] }
```

Defaults come from `config.json` (via `window.__questAgentConfig`), then the
saved settings override. Storage: Discord removes `window.localStorage` from
its renderer, so the agent takes a `Storage` from a hidden iframe (the same
approach client mods use), key `questAgent.settings.v1`; if that fails it falls
back to memory for the session.

A disabled type is neither enrolled nor started, and the quest appears under
*Skipped* with the reason "type off". A quest whose only supported task types
are disabled counts as not needing work for the idle check.

### D. HUD

Same placement (title-bar button, draggable panel) with a new visual layer
built on Discord's current design tokens (`--background-surface-high`,
`--background-base-lower`, `--background-mod-subtle`, `--text-default`,
`--text-muted`, `--border-subtle`, `--radius-md`, `--shadow-high`,
`--brand-500`, `--status-*`), each with a hex fallback for older clients.

Panel layout:

- **Header**: status dot, title "Quests", live status text (Working on 2 /
  Paused / Idle / 1 ready to claim), then icon buttons: pause-all/resume-all,
  scan, settings, close. Draggable. Esc closes.
- **Stats strip**: running, queued, to claim, orbs won.
- **Quest list** grouped into Ready to claim, Running, Queued, Skipped. Each
  row: game tile, name, orb reward, progress bar, task label + time left, and
  a hover action cluster:
  - Running: Pause/Resume, Stop.
  - Queued: Run now, Skip.
  - Skipped by user or stopped: Resume. Failed too often: Retry.
  - Type off / not automatable: no actions (fix in Settings).
  - Clicking the row body still opens Discord's Quests page.
  Paused rows show a striped, dimmed bar and "paused".
- **Settings view** (toggled by the gear, replaces the list): Discord-style
  toggles for Auto-accept quests, Notifications, and each quest type (with a
  one-line description); a segmented control for rescan interval (1/2/5/10 min);
  buttons "Retry failed quests" and "Clear skip list"; footer with version and
  an "Open Quests page" link.
- **Button badge**: green count = rewards to claim, amber count + ring =
  quests in progress, grey pause glyph = globally paused, hidden = idle.

### E. Dev hooks

`window.__questAgentDev = { quests, api, stores }` lets a developer inject the
agent against mock quests and a mock API in a live client without touching the
account. Absent in normal use.

### F. Out of scope

Editing `config.json` from the HUD (the renderer cannot write files), claiming
rewards (captcha), and any change to the older `Vencord Auto Updater` project.

## Testing

- Uninstall: install into a temporary `LOCALAPPDATA`, run the uninstaller with
  `-KeepDiscord`, assert no folder, no shortcuts, no agent process.
- HUD: inject into the live client with mock quests covering every group and
  state, exercise pause/resume/stop/skip/run-now/settings through
  `window.__questAgent`, screenshot the panel over CDP, and reload the agent to
  confirm settings persist.
