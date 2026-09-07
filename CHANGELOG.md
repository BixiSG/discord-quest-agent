# Changelog

Newest first. The HUD shows this file under Settings > What's new, so keep every entry
a short plain sentence: one `## <version> - <YYYY-MM-DD>` heading per release, `-` bullets
below it, no nested lists. Markdown links and emphasis are stripped in the panel.

## 1.3.2 - 2026-09-07

- Sound: a short chime plays with the in-app toast. Settings > Notifications has the switch and a volume slider; changing the volume previews it.

## 1.3.1 - 2026-09-07

- Skipped quests (not automatable, skipped by you, failed) can be dismissed from the list; Settings > Maintenance brings them back.
- Settings > About has an Install folder row that opens the folder with Uninstall.bat, config.json and the agent files.

## 1.3.0 - 2026-09-07

- What's new: the panel shows this changelog under Settings, marks it NEW after an update and drops a toast so you know something changed.
- Settings link to the GitHub project and to the issue tracker.
- If the older QuestBypass prototype is still running in the client, the agent retires it on start, so there is one agent and one panel.
- The footer shows the tool version (1.3.0) instead of the internal script build number.
- Launcher: keeps the -Branch choice when it relaunches itself after a self-update.

## 1.2.0 - 2026-09-04

- The HUD speaks Russian and Ukrainian. It follows Discord's language, or pick one in Settings.
- Add your own language: copy src/locales/TEMPLATE.json to locales/<code>.json in the install folder. That folder survives updates.
- Russian README.

## 1.1.1 - 2026-09-03

- Light theme for the panel (Settings > Appearance).
- In-app toasts, using Discord's own when the agent can find them, with a test button.
- The title-bar button no longer vanishes when Discord runs in a language other than English.

## 1.1.0 - 2026-09-03

- Per-quest controls on hover: pause, resume, stop, skip, run now, retry.
- Pause everything from the panel header.
- Settings: auto-accept, notifications, quest types, rescan interval. Saved across Discord restarts.
- Discord-native panel with game art, orb rewards and progress bars.
- Uninstaller stops the agent inside Discord, restarts Discord without the debugging port and names any other launcher on the PC that would bring an agent back.

## 1.0.4 - 2026-07-31

- Clicking a quest row opens Discord's Quests page, where claiming happens.

## 1.0.3 - 2026-07-31

- Fixed Discord crashing on start after an interrupted Discord update: the launcher now starts Discord through its own Update.exe and skips incomplete builds.
- The launcher no longer force-closes Discord while Discord's updater is running.

## 1.0.2 - 2026-07-29

- First release.
