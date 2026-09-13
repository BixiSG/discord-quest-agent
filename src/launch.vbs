' launch.vbs - starts QuestAgent.ps1 with no console window at all.
'
' Why this exists: a shortcut that runs "powershell.exe -WindowStyle Hidden"
' straight from the Startup folder does not start at login on some Windows 11
' PCs (Windows Terminal as the default console). wscript.exe is a windowless
' host, so starting PowerShell from here with window style 0 sets the hidden
' state at process creation; nothing is delegated to a terminal and nothing
' can be closed by accident. Every argument is passed through to the script.
'
' Self-locating: keep this file next to QuestAgent.ps1.

Dim sh, fso, dir, cmd, i
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

dir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & dir & "\QuestAgent.ps1"""
For i = 0 To WScript.Arguments.Count - 1
    cmd = cmd & " """ & WScript.Arguments(i) & """"
Next

' 0 = hidden window, False = do not wait for it to exit
sh.Run cmd, 0, False
