# file-opener

A Claude Code **mod** that puts a small card under every local file that shows up in the chat: the file name and two buttons.

- **Open** opens the file in its default app (for example your slicer for `.3mf`). On Windows, if no app is associated with that type, the Windows "How do you want to open this file?" picker comes up instead.
- **Show in Explorer** / **Show in Finder** opens the folder with the file selected.

Buttons show up under:

- Claude's replies that name a file, as a markdown link (`[part.3mf](Exports/part.3mf)`), a `code` path, or a bare `C:\...` path. Relative paths are resolved against the session's folder.
- File cards sent with the `SendUserFile` tool.

A card only appears for files that actually exist on disk. Web links are ignored.

It works in local Claude Code sessions on Windows and macOS: the terminal, and the Code tab of the Claude desktop app. It does nothing in cloud sessions, which can't see your disk.

## Install

```
/plugin install file-opener --marketplace theboyknowsclass/claude-skills
```

Or the two-step way:

```
/plugin marketplace add theboyknowsclass/claude-skills
/plugin install file-opener@claude-skills
```

Install it at user scope to have it in every local session, including the ones the desktop app starts. It takes effect in the next session you start.

## Settings

Set these in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`, using the full plugin id as the key:

```json
"pluginConfigs": {
  "file-opener@claude-skills": { "options": { "extensions": "3mf,stl,step" } }
}
```

| Setting | Default | Example |
| --- | --- | --- |
| `extensions` | empty (every file) | `3mf,stl,step,stp,f3d,gcode` |

## Default apps

**Open** uses whatever app the OS has set for that file type. To change it once and for all:

- **Windows**: right-click a file of that type > Open with > Choose another app > pick the app > *Always*.
- **macOS**: select a file > Get Info > Open with > pick the app > *Change All...*

## How it works

`hooks/register.tsx` hooks two `ui.render` sites: `AssistantMessage`, where it pulls file paths out of the reply text, and `ToolUse` for `SendUserFile`. It checks each path with `$.fs.stat` and draws the card under the original row. Opening runs `powershell Start-Process` on Windows, falling back to `rundll32 shell32.dll,OpenAs_RunDLL` (the "Open with" picker) when no app is associated, and `explorer /select` for Show in Explorer. The path is passed in an environment variable, so spaces and quotes are safe. On macOS it runs `open` / `open -R`.

Run the tests with `claude plugin test plugins/file-opener`.

Up to 0.1.0 this was `model-files`, a side panel listing the newest files in a folder. If you had that one installed, uninstall it: `/plugin uninstall model-files@claude-skills`.
