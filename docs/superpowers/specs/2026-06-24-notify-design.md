# Notify Namespace — Design Spec

Brainstormed 2026-06-24.

---

## Goal

Add a `notify` namespace to `@utils` that sends OS desktop notifications from runes. Covers Windows (Toast via PowerShell), macOS (osascript), and Linux (notify-send). Graceful result object by default, throws on failure when opted in.

---

## Architecture

Three files touched:

- **Create:** `src/rune/api/notify.js` — host-side implementation, platform detection, subprocess dispatch
- **Create:** `src/rune/api/types-utils/notify.d.ts` — TypeScript declaration
- **Modify:** `src/rune/api/utils.js` — wire `notify` into the namespace bundle
- **Modify:** `src/rune/isolation/utils-bootstrap.js` — expose `notify` to the isolate

No new npm dependencies. All backends use Node's `child_process.execFile` (already available host-side).

Permission token: `notify` — single all-or-nothing token, consistent with how broad capabilities like `shell` work.

---

## API

```ts
declare namespace notify {
  interface NotifyResult {
    /** true if the notification was dispatched successfully */
    sent: boolean
    /** present when sent is false — describes why */
    reason?: string
  }

  interface NotifyOpts {
    /** Urgency level. Default: 'normal' */
    urgency?: 'low' | 'normal' | 'critical'
    /** Throw an error instead of returning { sent: false }. Default: false */
    throw?: boolean
  }

  /**
   * Sends a desktop notification.
   * Requires `notify` permission.
   *
   * Returns { sent: true } on success.
   * Returns { sent: false, reason } on failure unless opts.throw is true.
   *
   * @example
   * const result = await notify.send('Build done', 'All tests passed')
   * await notify.send('Disk full', 'Clean up now', { urgency: 'critical', throw: true })
   */
  function send(title: string, message: string, opts?: NotifyOpts): Promise<NotifyResult>
}
```

---

## Platform Backends

### Windows — PowerShell Toast

Uses a PowerShell inline script to trigger a Windows Toast notification via `[Windows.UI.Notifications]` WinRT API.

```powershell
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent('ToastText02')
$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('<TITLE>')) | Out-Null
$xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('<MESSAGE>')) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('crunes').Show($toast)
```

Urgency mapping:
- `critical` → uses `ToastScenario` `alarm` (persistent until dismissed)
- `low` / `normal` → default scenario (auto-dismisses)

Executed via `execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])`.

### macOS — osascript

```bash
osascript -e 'display notification "<MESSAGE>" with title "<TITLE>"'
# critical adds sound:
osascript -e 'display notification "<MESSAGE>" with title "<TITLE>" sound name "Basso"'
```

Urgency mapping:
- `critical` → appends `sound name "Basso"`
- `low` / `normal` → no sound

Executed via `execFile('osascript', ['-e', script])`.

### Linux — notify-send

```bash
notify-send --urgency=<low|normal|critical> "<TITLE>" "<MESSAGE>"
```

Urgency maps directly: `low → low`, `normal → normal`, `critical → critical`.

Executed via `execFile('notify-send', ['--urgency=<level>', title, message])`.

---

## Failure Handling

`sent: false` is returned (or an error thrown if `opts.throw`) when:

| Situation | `reason` value |
|-----------|---------------|
| Platform is not `win32`, `darwin`, or `linux` | `'unsupported platform: <platform>'` |
| Required tool not found (`ENOENT`) | `'tool not found: <tool>'` |
| Subprocess exits non-zero | `'command failed: <stderr>'` |
| Any other error | `'<error.message>'` |

String escaping: title and message are escaped before insertion into shell scripts to prevent injection (`"` → `\"`; for PS, use `-replace`).

---

## Permission

Token: `notify`

```json
{
  "permissions": {
    "run": {
      "allow": ["notify"]
    }
  }
}
```

Checked in the host bridge before dispatching. If not allowed, throws `PermissionError: 'notify' — add 'notify' to allow list.`

---

## Files Touched

- **Create:** `src/rune/api/notify.js`
- **Create:** `src/rune/api/types-utils/notify.d.ts`
- **Modify:** `src/rune/api/utils.js` — add `notify` import and export
- **Modify:** `src/rune/isolation/utils-bootstrap.js` — expose `notify.send` to isolate

---

## Out of Scope

- Icon support — inconsistently available across platforms
- Timeout/duration control — not cross-platform
- Click/action callbacks — not feasible in a fire-and-forget sandbox model
- Notification grouping or replacement
- Windows fallback to `msg` command for older systems
