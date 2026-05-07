# Debug Toggle

## Enabling Debug Logging

The layout builder debug logging is gated behind a localStorage flag for development and troubleshooting.

### How to Enable

1. Open your browser's **DevTools** (F12 or right-click → Inspect)
2. Go to the **Console** tab
3. Run this command:
   ```javascript
   localStorage.setItem('wpsg_debug', '1')
   ```

### How to Disable

```javascript
localStorage.setItem('wpsg_debug', '0')
```

## What Gets Logged

When debug mode is enabled, the layout builder will output grouped console messages showing:

- **Media slot assignments**: Input media items and slot IDs being assigned
- **Pre-flight save data**: Slots and media IDs being sent to the server
- **Server response**: Slots and media IDs returned after save

Example output:
```
[WPSG] Layout Save — pre-flight
  Slots being sent: 1:slot-abc→mediaId=m123, 2:slot-def→mediaId=m456, ...

[WPSG] Layout Save — response
  Slots returned: 1:slot-abc→mediaId=m123, 2:slot-def→mediaId=m456, ...

[WPSG] Assign Media to Slots
  Input media: [m123, m456, ...]
  Assignments: slot-abc→m123, slot-def→m456, ...
```

## Persistence

The debug flag persists across browser page reloads, so you only need to set it once per session.

## Implementation

Debug utilities are in [src/utils/debug.ts](../src/utils/debug.ts) and provide:
- `isDebugEnabled()` — checks localStorage for the flag
- `debugGroup(label)` — starts a grouped console output
- `debugLog(...args)` — logs arguments (like console.log)
- `debugGroupEnd()` — ends the group

All debug calls throughout the layout builder are gated behind these utilities.
