# simhub-carplay

A CarPlay-style center-screen infotainment UI for a sim rig, driven by live SimHub telemetry.
It runs in a browser (Edge/Chromium kiosk or a SimHub dashboard web component) on the same
Windows PC as SimHub.

This is infotainment only. Shift lights and anything hard-real-time stay on the SimHub → CAN path.

```
 SimHub ──(Property Server plugin, TCP 18082)──► bridge (Node) ──WebSocket /ws──► UI (Svelte)
                                                    │  serves UI + /config.json on one port
 mock telemetry (no game needed) ──────────────────►┘
```

- **`/bridge`**: a Node/TypeScript process. It works out which game is running, subscribes to that game's SimHub properties, coalesces updates, and re-broadcasts them as compact JSON deltas over WebSocket. It also serves the built UI, so the page and socket share an origin.
- **`/ui`**: Vite + Svelte 5 + TypeScript. It has a split dashboard view and a paged app grid, with animated transitions between them. A state machine switches between them automatically when the car starts or stops. Navigation works by knob/D-pad focus or by touch.
- **`/ui/src/apps`**: plug-in apps (Job, Fuel, Tyres, Vehicle…). Each is a self-contained folder and shows up only for games that provide its data.
- **`/games`**: one JSON profile per game. Each maps channel names to SimHub properties (`GameData`, `GameRawData`, anything else).
- **`/shared`**: the WebSocket protocol and config types, imported by both sides. This is the contract the future SimHub C# plugin will implement, so the UI won't need changes when the backend is swapped.
- **`config.json`**: the **single** settings file. It holds ports, button mapping, units, and auto-switch thresholds.

## Requirements

- Windows, Node.js 20+ (developed on Node 26)
- For real data: SimHub with the [SimHub Property Server](https://github.com/pre-martin/SimHubPropertyServer) plugin

## Quick start (mock data, no game)

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. This starts the bridge in mock mode (port 8099) and the Vite dev
server with hot reload. Vite proxies `/ws` and `/config.json` to the bridge.

The mock drives laps of a fictional circuit for 75 s, then pulls over and idles for 15 s, on a loop.
You'll see the UI switch to the split view when the car moves and back to the grid when it stops.

By default the mock pretends to be Assetto Corsa. **`npm run dev:ats`** runs it as American Truck
Simulator instead, which brings up the ATS profile: mph, a speed-limit sign, the Job app, the Job
card in the split view, and truck vehicle data. Racing-only apps such as Race Info and Tyres are
hidden. Any game code works with `--game`, e.g. `npm run dev -w bridge -- --mock --game ETS2`.

| Key | Action |
| --- | --- |
| Arrow keys | Move focus (knob-style) |
| Enter | Select |
| Esc / Backspace | Back |
| Space or `G` | Toggle split view ↔ app grid |
| `H` | Home (app grid) |
| F2 | Debug overlay (connection, drive state, raw gamepad buttons/axes) |

Touch and mouse work too. Swipe the grid to change pages. The focus ring hides after a touch and
comes back on the next knob/key press.

### Production-style run (one process, one port)

```sh
npm run build        # builds ui/dist
npm run start:mock   # or: npm start   (real Property Server)
```

Then open **http://localhost:8099**.

## Pointing the bridge at the real Property Server

1. Install the **SimHub Property Server** plugin (copy it into the SimHub folder per its README),
   enable it in SimHub, and check its port in the plugin settings (default **18082**).
2. In `config.json`, set:
   ```json
   "bridge":         { "source": "propertyServer", ... },
   "propertyServer": { "host": "127.0.0.1", "port": 18082, "reconnectMs": 2000 }
   ```
   `source` already defaults to `propertyServer`; `npm run dev` and `npm run start:mock` override it
   with `--mock`. You can also pass `--source propertyServer` or `--source mock` explicitly.
3. Run `npm run build && npm start`, or for development run the bridge without `--mock`:
   `npm run dev -w bridge` in one terminal and `npm run dev:ui` in another.

The bridge reconnects automatically. When SimHub isn't running it reports `upstream: disconnected`
and the UI shows a "Waiting for SimHub telemetry" pill.

## Game profiles (`games/*.json`): where each piece of data comes from

The UI only uses **channel names** (`speedKmh`, `fuel`, `job.destinationCity`…). Each game
profile maps those names to SimHub properties:

```jsonc
// games/scs-trucks.json (shared by ATS and ETS2)
{
  "id": "scs-trucks",
  "abstract": true,
  "channels": {
    "lap": null,                       // null = this game doesn't have it (hides Race Info)
    "job.destinationCity": "DataCorePlugin.GameRawData.JobValues.CityDestination",
    "nav.speedLimitKph":   "DataCorePlugin.GameRawData.NavigationValues.SpeedLimit.Kph",
    ...
  }
}
// games/ats.json
{ "id": "ats", "short": "ATS", "match": ["ATS"], "extends": "scs-trucks", "units": "mph", "currency": "$" }
```

- **`_default.json`** holds the generic `GameData` channels every game starts from. Every profile
  extends it, directly or through `extends`.
- **`match`** lists the SimHub `DataCorePlugin.CurrentGame` codes the profile applies to. Games
  without a profile use `_default`, and the dock shows an abbreviation of the game code
  (`AssettoCorsaCompetizione` → `ACC`, `ForzaHorizon5` → `FH5`).
- **`short`, `units`, `currency`** are used for the dock label, "auto" units, and money.
- When the game changes, the bridge resolves the new profile, subscribes and unsubscribes only
  the properties that differ, and sends the UI a `profile` message plus a fresh snapshot.

To support a new game, or pull in more data, edit or add a JSON file and restart the bridge. No
code changes are needed. The truck profiles were built from a SimHub 9.13.5 property catalog.

Property Server naming:
- `dcp.X` = `DataCorePlugin.X` (e.g. `dcp.GameRunning`, `dcp.GamePaused`)
- `dcp.gd.X` = `DataCorePlugin.GameData.X` (e.g. `dcp.gd.SpeedKmh`)
- A full name with no prefix = "generic" access to almost any SimHub property, including
  `GameRawData.*`, `MediaInfo.*` and NCalc/custom properties. It's a bit slower.

To see what's available, connect with `telnet localhost 18082` and type `help`, or export a
property catalog from SimHub. An unknown property just stays `null`.

**Still to verify against a live game:** whether `dcp.gd.Fuel` is in litres or the game's
`FuelUnit` (ATS reports "Gallons"), and whether `NavigationTimeSeconds` is real time or game time.
Both are shown as reported, without conversion.

Value handling: `(null)` → `null`, `True`/`False` → booleans, numbers with a decimal comma (from
the Windows locale) are parsed, and .NET `timespan` values become seconds. `dcp.gd.Gear` is a
string (`"N"`, `"R"`, `"1"`…).

The Property Server pushes at most **10 Hz**. The UI interpolates the channels listed in
`ui.interpolate` (speed, RPM, track position) on `requestAnimationFrame`, so the numbers and the
map puck still move smoothly.

## Apps (`ui/src/apps/<id>/`)

Each folder is one app, and the registry discovers it automatically. `index.ts` default-exports
an `AppModule` ([ui/src/apps/types.ts](ui/src/apps/types.ts)):

```ts
export default {
  id: 'job',
  name: 'Job',
  colors: ['#d09a5c', '#8f5b28'],         // icon gradient
  glyph: '<path d="…"/>',                 // original 24×24 line glyph
  order: 25,                              // grid position
  requires: ['job.destinationCity'],      // shown only if the active game provides these
  dock: 3,                                // optional dock shortcut priority
  screen: JobScreen,                      // full-screen body (the shell adds the header/back)
  card: { component: JobCard, priority: 10, when: (t) => isOn(t.slow['job.onJob']) },
} satisfies AppModule;
```

- **Grid and dock** list only the apps the current game supports. Dock shortcuts are the three
  available apps with the lowest `dock` value.
- **Split-view card:** the lower-right card belongs to the highest-priority available app whose
  `when` passes. Now Playing is the default (priority 0). Job takes over while you're on a
  delivery.
- **Inside an app,** read `telemetry.slow['channel']`, check `telemetry.has('channel')` to show a
  tile only where the game supports it (see Vehicle), and use `units()` from the context for
  display units. The building blocks are `lib/kit` (Tile, Section, Bar) and `lib/format.ts`.

Current apps: Map, Now Playing (live title/artist from SimHub's `MediaInfo`), Race Info, Job, Fuel,
Tyres, Vehicle (assists, engine, brakes, drivetrain and damage, adapting per game), and Settings.

### Dock game indicator

Under the clock: a dot plus the game's short code (ATS, ETS2, AC…).
- **Green:** game running.
- **Amber:** SimHub is connected but the game isn't running.
- **Red:** no data path, meaning the bridge or SimHub is down. Hover or long-press shows the reason.

## Vehicle controls (screen → game)

The **Controls** app appears for any game whose profile has a `controls` section (ATS/ETS2 today).
It has headlights, high beam, hazards, beacon, turn signals, parking brake, cruise, diff lock,
lift axle, ignition, engine, wipers, and a hold-to-honk horn. Toggles show the **game's real
state**, so a tap shows "…" until the game confirms. "No response" usually means the SimHub
mapping below is missing.

How a tap reaches the game:

```
tap on screen ──WS {t:"control"}──► bridge ──trigger-input-pressed/released carplay.<id>──► Property Server
   ──► SimHub "PropertyServerPlugin.carplay.<id>" ──Keyboard emulation──► key press in the game
```

**One-time setup in SimHub** (per control):
1. *Controls and events → Keyboard emulation → Add mapping → Click to configure.* In the "Pick a
   control" dialog, if **Property Server** shows *Disabled*, click **Enable**.
2. With the dialog on "Waiting for input", tap the control on the screen, or run
   `curl -X POST http://localhost:8099/api/control/hazards` on the PC. SimHub shows
   `PropertyServerPlugin.carplay.hazards`.
3. Set **Press type: During**. The bridge holds the input for `controls.tapMs`, and holds the horn
   for as long as your finger is down. Then **Save**.
4. **Add key**: press the key the game uses for that action, e.g. ATS defaults: hazards `F`,
   headlights `L`, high beam `K`. Use whatever your own bindings are.

Control ids are the keys of `controls` in [games/scs-trucks.json](games/scs-trucks.json), and the
SimHub input name is `controls.inputPrefix` + id (`carplay.` by default). The headlights are a
`cycle` control: the game steps off → parking → on with one key, so choosing "Off" from "On"
sends two taps, `controls.gapMs` apart. To add a control, add an entry with a state channel. Known
ids get an icon from `ui/src/apps/controls/catalog.ts`, and others get a generic one.

Safety: the bridge only fires inputs for controls in the active profile, and it builds the input
name itself, so a client can't trigger arbitrary SimHub inputs. A held control is released when
the screen disconnects or the game changes. If the bridge listens on your LAN (below), anyone on
that network can operate these controls.

## Running on the rig display

### Raspberry Pi (or any other device on the network)

The bridge runs on the gaming PC next to SimHub. The display device only needs a browser:
1. In `config.json`, set `"bridge": { "host": "0.0.0.0", … }` and allow TCP 8099 through the
   Windows firewall.
2. On the Pi, open `http://<PC-IP>:8099` in kiosk Chromium, or point a SimHub remote dashboard's
   web view component at it.
3. The wheel is plugged into the PC, so the Pi's browser can't see it through the Gamepad API.
   Touch works. Wheel-button navigation from the Pi needs the backend input path
   (`/api/input/<action>`, or wheel buttons read through SimHub, which is planned).

### Edge kiosk on the second screen

```bat
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk http://localhost:8099 --edge-kiosk-type=fullscreen --no-first-run --user-data-dir=%LOCALAPPDATA%\simhub-carplay-kiosk
```

Kiosk mode opens on the primary monitor. If it won't go to the center screen, use
`--app=http://localhost:8099 --window-position=<x>,0 --start-fullscreen` instead, where `x` is
the left edge of the center screen in desktop coordinates. Use a dedicated `--user-data-dir` so
it doesn't attach to your normal Edge session.

Use **`localhost`**, not the PC's LAN IP. The Gamepad API only works in a secure context, and
`http://localhost` counts as one.

### Inside a SimHub dashboard (web view component)

Point the component at `http://localhost:8099`. The UI uses no browser storage, popups or service
workers, and loads everything from the bridge, so it should be fine in an embedded WebView. If the
page is served from somewhere else, use `?ws=ws://localhost:8099/ws` to tell it where the bridge is.

## Wheel buttons (Gamepad API)

Button mapping lives in `config.json → ui.input.gamepad`:

```jsonc
"gamepad": {
  "idContains": "",          // only read devices whose id contains this, e.g. "MOZA"
  "buttons": { "up": [12], "down": [13], "left": [14], "right": [15],
               "ok": [0], "back": [1], "toggleView": [3], "home": [] },
  "hatAxis": null,           // DirectInput POV hat exposed as an axis (often 9), or null
  "repeatDelayMs": 400, "repeatRateMs": 120
}
```

To find your indices:
1. Open the UI and press **F2** (or add `?debug` to the URL).
2. Press any wheel button once. Chromium only exposes gamepads after a button press.
3. The overlay lists each device's `id`, the pressed button indices, and axis values.
4. Moza bases and wheels show up as DirectInput (`non-standard` mapping), so the default
   indices (Xbox layout) will almost certainly be wrong. If the D-pad moves one axis through
   values like -1, -0.43, 0.14, 0.71, set `hatAxis` to that axis index.

Each action takes a list of buttons, so you can map several buttons to it. Keyboard bindings are
in `ui.input.keyboard`.

### ⚠️ Known risk: browser focus

In the rig the **game** has OS focus, not the browser. Chromium may stop reporting gamepad
input to a window that doesn't have focus (this applies to keyboard input too). I haven't verified
this with your hardware yet. The UI is built so this doesn't block you:

- The focus ring is drawn from the UI's own state, not CSS `:focus`, so it shows on an unfocused
  window.
- The protocol has an `input` message (`{"t":"input","action":"ok"}`) that the backend can send.
  The bridge already exposes `POST /api/input/<action>`
  (`up|down|left|right|ok|back|toggleView|home`), which takes the same path:
  ```sh
  curl -X POST http://localhost:8099/api/input/toggleView
  ```
  If the browser can't see the wheel in the background, wheel buttons can be read on the backend
  instead. Today that means anything that can make an HTTP call; in Phase 2, the C# plugin reads
  SimHub's own input mapping. The UI won't need changes.

## Auto view switching

`ui.autoSwitch` drives the view state machine (`ui/src/lib/viewState.svelte.ts`):

- **parked**: telemetry disconnected, game not running, game paused, or speed below
  `parkedBelowKmh` for `parkedAfterMs` (set it to `null` so sitting still, e.g. at a light, never
  counts as parked)
- **driving**: moving at or above the threshold

When the state *changes*, the UI moves between the two home screens: driving → split view,
parked → app grid. An open app is left alone. A manual toggle holds until the next change, so you
can look at the grid while driving and it won't snap back. Set `enabled: false` to switch views
only manually.

## Now Playing

`media.source` in config.json picks where track info comes from:

- **`simhub`** (default): SimHub's MediaInfo plugin. Title and artist only, no art, progress
  or working buttons.
- **`windows`**: the bridge reads the Windows media session itself, the same data as the
  volume flyout. You get album art, album, progress, play/pause state, and working
  previous / play-pause / next buttons. It works with any player that reports to Windows
  (Spotify, Apple Music, browsers, …), though some players leave out position or art.

With `windows`, the bridge starts a hidden Windows PowerShell 5.1 helper
([bridge/src/media/windowsMedia.ps1](bridge/src/media/windowsMedia.ps1)) when it starts, and
restarts it if it exits; it exits when the bridge does. It polls every `media.pollMs` and
replaces the game profiles' `media.*` mappings. Nothing extra to install or run.

## WebSocket protocol (v1)

Defined in [shared/src/protocol.ts](shared/src/protocol.ts). Frames are JSON text on `/ws`, keyed
by channel name:

```jsonc
{"t":"hello","v":1,"backend":"mock"}                    // first frame
{"t":"status","upstream":"connected","detail":"..."}    // upstream health, on change
{"t":"profile","profile":{"id":"ats","game":"ATS","short":"ATS","units":"mph","channels":[...]}}
                                                        // active game; followed by a snapshot
{"t":"snapshot","ts":1700000000000,"d":{"speedKmh":0,"gear":"N", ...}}  // full state on connect
{"t":"delta","ts":1700000000033,"d":{"speedKmh":87.4,"rpm":5120}}       // changed channels only
{"t":"input","action":"ok"}                             // navigation from the backend
{"t":"config","ui":{...}}                               // UI settings changed (Settings app)

// client -> server
{"t":"control","id":"hazards","action":"tap"}           // also "press"/"release" (momentary), "count" for cycles
{"t":"media","action":"playPause"}                     // also "next" / "previous" (media.source "windows")
{"t":"settings","patch":{"units":"mph","appearance":{"background":"aurora"}}}
                                                        // validated, saved to config.json, echoed to all as "config"
```

The bridge sends deltas at `bridge.broadcastHz` (default 30) and only when something changed.
Any backend that speaks this protocol (including the Phase 2 C# plugin) can replace the bridge
without UI changes. It should also serve `GET /config.json` (the `ui` section) and send `profile`
messages derived from `games/*.json`.

## Config reference (`config.json`)

| Key | Meaning |
| --- | --- |
| `bridge.host` / `port` | Where the bridge listens (UI + WebSocket). `127.0.0.1` keeps it local; use `0.0.0.0` to open it to the LAN (then gamepad input needs `localhost` on that machine). |
| `bridge.source` | `propertyServer` or `mock` |
| `bridge.broadcastHz` | Maximum WebSocket delta rate |
| `propertyServer.*` | Property Server address and reconnect delay |
| `mock.game` | SimHub game code the mock pretends to be (`AssettoCorsa`, `ATS`…); `--game` overrides it |
| `mock.*` | Mock update rate and driving/parked phase lengths |
| `controls.inputPrefix` | SimHub input name prefix for vehicle controls (`carplay.` → `PropertyServerPlugin.carplay.hazards`) |
| `media.source` | `simhub` or `windows` (see [Now Playing](#now-playing)) |
| `media.pollMs` | How often the Windows media helper checks the session |
| `controls.tapMs` / `gapMs` | How long a tap holds the input; pause between taps of a cycle control |
| `ui.units` | `auto` (use the game profile's units, else km/h), `kmh` or `mph` |
| `ui.interpolate` | Channels smoothed on the render loop: `linear`, or `wrap` for 0..1 values like track position |
| `ui.autoSwitch` | See above |
| `ui.input` | Keyboard and gamepad mapping |
| `ui.appearance.background` | Background preset (`black`, `graphite`, `midnight`, `aurora`, `sunset`, `ocean`, `forest`, `crimson`) or `custom` |
| `ui.appearance.custom` | Custom background gradient: `angle` (degrees), `from` / `to` (`#rrggbb`) |
| `ui.appearance.glass` | Frosted-glass cards (translucent + blur); turn off if the display's GPU struggles |
| `ui.appearance.iconScale` | App-grid icon size, `0.6`–`2` (`1` = default); fewer icons fit per page as it grows |

`ui.units` and `ui.appearance` can also be changed from the **Settings** app on the screen. The
bridge saves those keys back into this file (leaving the rest as written) and pushes the change
to every connected screen. For anything else, the bridge reads the config once at startup, so
restart it after edits. To use a different file,
pass `--config path\to\file.json` or set `CARPLAY_CONFIG`.

## Project layout

```
config.json                 the one settings file
games/*.json                per-game channel -> SimHub property maps (_default, scs-trucks, ats, ets2)
shared/src/protocol.ts      WebSocket message types (the backend contract)
shared/src/games.ts         game profile + ProfileInfo types
shared/src/config.ts        config.json types
bridge/src/index.ts         entry: picks the source, switches profiles when the game changes
bridge/src/games.ts         loads/merges game profiles (extends, null = remove)
bridge/src/server.ts        HTTP (static UI, /config.json, /api/input, /api/control) + WebSocket
bridge/src/controls.ts      vehicle controls -> SimHub input triggers (allow-list, tap/hold, queueing)
bridge/src/store.ts         latest values + dirty set -> deltas
bridge/src/sources/mock.ts            synthetic laps, racing + truck channels
bridge/src/sources/propertyServer.ts  TCP client for the Property Server (diffed resubscribes)
ui/src/App.svelte           shell, input dispatch, view transitions
ui/src/apps/                plug-in apps + registry (see "Apps")
ui/src/lib/kit/             Tile, Section, Bar: building blocks for app screens
ui/src/lib/format.ts        units, distances, durations, game clock, money
ui/src/lib/telemetry.svelte.ts  WS client, active profile, reactive slow values, interpolated fast values
ui/src/lib/viewState.svelte.ts  drive-state / view state machine
ui/src/lib/input.ts         keyboard + Gamepad API polling
ui/src/lib/focus.ts         spatial (knob) navigation
ui/src/lib/frameloop.ts     single requestAnimationFrame loop
ui/src/views/               SplitView, GridView (paged), AppScreen (app shell)
ui/src/components/          Dock, MapCard (canvas), DriveCard, DebugOverlay
```

How rendering works: fast channels (speed, RPM, track position) never touch Svelte state. Components
subscribe to the shared frame loop and write `textContent`, `transform`, or draw the canvas
directly, and only when the displayed value changes. Slow channels (gear, lap, delta, settings)
are ordinary reactive state.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Mock bridge + Vite dev server (hot reload) |
| `npm run dev:ats` | Same, with the mock pretending to be ATS (truck profile and apps) |
| `npm run build` | Build the UI into `ui/dist` |
| `npm start` | Bridge with the source from `config.json`, serving the built UI |
| `npm run start:mock` | Same, forced to mock data |
| `npm run check` | Type-check shared, bridge and UI (`tsc` + `svelte-check`) |

## Roadmap

- **Map**: real track outlines and opponent positions for racing. For ATS/ETS2, a world map with
  turn-by-turn navigation on [truckermudgeon/maps](https://github.com/truckermudgeon/maps).
- **Now Playing**: artwork and working transport buttons (SimHub `SystemControl.Media*`
  actions, or an SMTC helper)
- **Race info**: penalties, next-corner callouts
- **More game profiles**: ACC, iRacing, Forza (FH5/FH6)… each is one JSON file
- **Phase 2**: SimHub C# plugin hosting the same WebSocket protocol, with derived state and
  server-side wheel input
