# Login launcher via wscript (v1.4.2)

Date: 2026-09-13. Status: shipped in v1.4.2.

> Post-mortem (2026-09-14): the "never ran at login" observation below had a different
> cause. The install folder had been created from an automation shell whose writes to new
> directories were not visible to the user's real session, so the shortcut pointed at a
> file that did not exist there. The wscript launcher is still worth having (no console
> window, not tied to a terminal's process tree) and stays.

## Problem

On Windows 11 with Windows Terminal as the default console, a Startup-folder shortcut that
targets `powershell.exe -WindowStyle Hidden ... QuestAgent.ps1` does not run at login on at
least one machine: eight logins in a row produced no PowerShell engine-start event and no
log line, while the same command started by hand works every time. A `.vbs` run by
`wscript.exe` (window style 0, no console at all) starts fine at every login on the same
machine. The self-updater's relaunch (`Start-Process powershell -WindowStyle Hidden`) is the
same shape and is presumed to have the same weakness at login.

## Change

1. `src/launch.vbs`: self-locating stub. Runs
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<dir>\QuestAgent.ps1" <args>`
   with window style 0 and does not wait. Every argument given to the `.vbs` is passed
   through, each one quoted. Pure ASCII.
2. `scripts/Install.ps1`: the Startup shortcut and the Start Menu "Discord Quest Agent"
   shortcut target `wscript.exe` with arguments `"<install>\src\launch.vbs"` plus
   `-AttachOnly` when installed that way. The Diagnostics shortcut keeps its visible
   PowerShell window. Description strings unchanged.
3. `src/QuestAgent.ps1`:
   - Self-update relaunch goes through `wscript.exe launch.vbs -NoUpdate ...` with the same
     argument forwarding as today.
   - One-time repair at start (not in `-Diagnose`): if `<Startup>\Discord Quest Agent.lnk`
     exists and its target is `powershell.exe`, rewrite it to the wscript form, keeping
     `-AttachOnly` if the old arguments had it. Log one line. Existing installs get the fix
     through self-update without reinstalling.
4. `scripts/Uninstall.ps1`: no logic change needed; the foreign-launcher scan already reads
   inside `.vbs` stubs. Verify by reading, not by assumption.
5. `VERSION` 1.4.2, `CHANGELOG.md` entry, README: one sentence that the Startup entry is a
   `wscript` shortcut.

## Out of scope

Vencord, hooks, restart budgets. Nothing about other tools on the machine.

## Testing

- `wscript.exe src\launch.vbs -NoWatch -NoUpdate` from the repo: agent log shows a start
  line, the PowerShell process exits after injecting.
- Fresh install into a temp copy: shortcut targets `wscript.exe`, arguments contain
  `launch.vbs` and, with `-AttachOnly`, that flag.
- Repair: create a powershell-style Startup shortcut, start the agent, shortcut now targets
  `wscript.exe` and keeps `-AttachOnly`.
- Real proof is the next login: an engine-start event for `QuestAgent.ps1` and a log line.
