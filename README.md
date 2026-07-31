# Discord Quest Agent

Finishes Discord quests on its own and puts a live HUD inside the client.

No Vencord, no plugin, no rebuilding anything, and nothing is patched on disk. It attaches
to the desktop client the same way DevTools does and runs a script inside it.

<p align="center">
  <img src="docs/panel.png" width="420" alt="The Auto Quests panel, showing quests grouped by state with progress bars">
</p>

<p align="center"><sub>Placeholder quest names; the panel shows your real ones.</sub></p>

## ⚠️ Read this first

**Automating quests is almost certainly against Discord's Terms of Service. Use at your
own risk.** Accounts can be actioned for this sort of thing. If your account matters to
you, use an alt.

Two other things worth knowing before you bother installing:

- It **cannot claim rewards for you.** Claiming needs a captcha that's checked server-side.
  The agent gets quests to 100% and then tells you to go press Claim.
- While it runs, Discord has a debugging port open on localhost. Any program on your PC
  can talk to that port and drive your Discord session. See [Security](#security) below.

No warranty, see [LICENSE](LICENSE). You're running this on your own account, by choice.

> Unofficial project, not affiliated with or endorsed by Discord Inc. It ships no Discord
> code, assets or branding, and it doesn't patch anything on disk. Details in
> [NOTICE.md](NOTICE.md).

## ✨ What it does

- Enrolls in eligible quests and completes them: play-a-game, streaming, video,
  mobile-video and activity quests.
- Goes fully idle when there's nothing to do. The poll timer stops, so it makes zero API
  calls until Discord announces new quests. It won't rate-limit you into oblivion.
- Pings you (OS notification + taskbar flash) when a reward is ready to claim.
- Re-injects itself after client reloads, and puts the debugging port back if a Discord
  auto-update strips it.
- Updates itself from this repo. Discord changes its internals every so often and that
  breaks the agent, so a fix here reaches you without you doing anything.

## The HUD

A button shows up in the title bar, just left of the Inbox icon:

<p align="center">
  <img src="docs/button.png" width="180" alt="The quest button in Discord's title bar with an amber badge">
</p>

The badge tells you what's going on without opening anything:

| Badge | Meaning |
| --- | --- |
| 🟢 Green, with a count | That many rewards are sitting there waiting to be claimed |
| 🟡 Amber, with a spinning ring | That many quests are still being worked on |
| ⚫ Nothing | Idle, nothing to do |

Click it for the panel in the screenshot above: four counters across the top, then one row
per quest with the game's own artwork, the orb reward, a progress bar and the time left.
Rows are grouped into *Ready to claim*, *Running now*, *Queued* and *Skipped* (with a
reason). Drag the header to move it, hit the refresh icon to force a scan. Clicking any
quest row jumps straight to Discover -> Quests, where claiming happens.

"Orbs won" is the total from quests you've already claimed. Discord doesn't hand the client
a live orb balance, so it isn't your wallet.

## 📦 Install

1. Grab the [latest release](../../releases/latest) (v1.0.4 or newer), or *Code -> Download ZIP*.
2. Extract it somewhere. Don't run it from inside the ZIP.
3. Double-click `Install.bat`.

It installs to `%LOCALAPPDATA%\DiscordQuestAgent`, adds Start Menu shortcuts and runs at
login. No admin rights, nothing written outside your user profile.

Then launch it from the Start Menu (**Discord Quest Agent**), or just log out and back in.
Discord restarts once so it can come up with the debugging port.

You need Windows 10/11, the Discord desktop app (Stable, PTB or Canary, auto-detected) and
Windows PowerShell 5.1, which is already on your machine.

To remove it, run `Uninstall.bat` from the install folder. It stops the agent, deletes the
shortcuts and the folder. Discord is untouched, so there's nothing to undo there.

## How it works

The Discord desktop client is an Electron app. Started with `--remote-debugging-port`, it
exposes a localhost-only DevTools endpoint. `QuestAgent.ps1` connects to it, finds the
window running Discord's code, and evaluates [`quest-agent.js`](src/quest-agent.js) inside
it. From there the script uses the same internal stores and `/quests/...` endpoints the
client already uses.

## ⚙️ Configuration

`config.json` sits in the install folder. Updates never overwrite it.

| Key | Default | What it does |
| --- | --- | --- |
| `repo` | `BixiSG/discord-quest-agent` | Where self-updates come from |
| `autoUpdate` | `true` | Check for a new version on start |
| `port` | random, 9200-9899 | Debugging port, randomised per machine at install |
| `branch` | `"Auto"` | `Auto`, `Stable`, `Ptb`, `Canary` |
| `restartDiscord` | `true` | Allow restarting Discord to add the debugging port |
| `autoEnroll` | `true` | Accept available quests automatically |
| `scanIntervalMs` | `120000` | How often to look for new quests (paused while idle) |
| `maxTaskAttempts` | `3` | Give up on a quest after this many failed runs |
| `hud` | `true` | Show the button and panel |
| `notify` | `true` | OS notification when a reward is claimable |

## 🔒 Security

The port only listens on 127.0.0.1, so nothing on your network can reach it. The problem is
local: while Discord is running with it open, anything on your PC can attach and drive that
Discord session. That's inherent to this approach, not a bug.

The port is randomised per install instead of using a well-known one, which helps a little.
If you're not actively using the agent, start Discord from its own shortcut instead. Setting
`restartDiscord: false` stops the tool from ever restarting your client.

## 🩺 When something breaks

Run the **Quest Agent Diagnostics** shortcut (or `Start-QuestAgent.bat -Diagnose`) and paste
the output into an issue. It lists versions, config and agent state, no tokens or messages.

**No button in the title bar.** Discord wasn't started by the agent, so there's no debugging
port. Start it from the Start Menu shortcut.

**Discord crashes the instant it starts.** An interrupted Discord update leaves a
newer-but-unfinished `app-<version>` folder on disk: the exe is there, the rest of the
client isn't. Up to v1.0.2 the agent picked whichever folder had the highest version
number, so it kept launching a client that couldn't boot. Since v1.0.3 it starts Discord
through Discord's own `Update.exe` and ignores incomplete builds - diagnostics lists every
build and flags the bad ones. Discord repairs the folder itself on its next update.

**"Quest agent needs updating" notification.** Discord changed its internals. Check for a
newer release; if there isn't one, open an issue with the diagnostics output.

**Nothing happens for a minute after login.** That's expected. It waits for you to finish
logging in and for Discord to register its modules before injecting.

**Play or stream quests stuck at zero.** Those need the desktop app. Streaming quests also
need at least one other person in the voice channel.

**Antivirus complains.** PowerShell that opens a debugging port and injects JavaScript looks
odd to a scanner. The source is all here; read it and decide for yourself.

Handled task types: `WATCH_VIDEO`, `WATCH_VIDEO_ON_MOBILE`, `PLAY_ON_DESKTOP`,
`STREAM_ON_DESKTOP`, `PLAY_ACTIVITY`. Mobile-video quests complete fine from the desktop
client. `ACHIEVEMENT_IN_ACTIVITY` quests can't be automated and show up as *Skipped*.

## Contributing

The fragile parts are the webpack module finders and the quest config shapes at the top of
`quest-agent.js`. Those are what Discord breaks. PRs welcome.

One rule: **keep the scripts pure ASCII.** PowerShell 5.1 reads BOM-less files using the
system ANSI codepage, so a literal non-ASCII character gets mangled before it ever reaches
Discord. An em dash in the panel turned into three bytes of Cyrillic garbage and cost me an
afternoon. Use `\uXXXX` escapes in JavaScript, and inline SVG instead of symbol glyphs.

## 📄 License

[MIT](LICENSE). Trademark and takedown information is in [NOTICE.md](NOTICE.md).
