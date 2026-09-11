# The two-tone focus ring is built: notes for review

**2026-09-10.** The halo ring you endorsed in your v2 response (§4) is implemented, tested and
on the dev site. Both of the constraints you set are held, and both are held structurally
rather than by convention, so they cannot drift later. This note says what it does, what it
measured out at across the 23 shipped themes, and the three things worth your eye when you
look at it in situ.

Nothing here blocks anything. The ring ships as it is unless you want a change.

---

## What it does

A focused control draws a 2px core in the theme's contrast-audited accent rung
(`primaryStroke`, the same rung the inputs and tabs already use), sitting inside a 6px halo.
The offset means the visible result is 2px of halo, then the 2px core, then 2px of halo again.
Geometry is identical on every theme.

The halo is derived, not authored. The engine takes the theme's own background hue, drops the
chroma to near zero, and steps the lightness toward one pole until the result clears 3:1
against the core. Light pole on dark themes, dark pole on light ones, as you specified.

## Your two constraints, measured

**"A neutral drawn from the theme's own grounds, never a second brand colour."** Held. The
highest chroma any halo reaches across all 23 themes is 4.4, on Tokyo Night. For reference,
the accent seeds themselves run from roughly 40 to 110. The halo is always within a few steps
of grey, and it always carries the background's hue rather than the accent's.

**"Ring geometry stays constant across themes."** Held. The widths are framework constants in
one stylesheet rule. Only the two colours resolve per theme, and a theme has no way to set the
geometry.

## What it resolved to

The full table, generated from the shipped engine. `halo:core` is the pair contrast, which is
the guarantee that the two tones separate from each other. `halo:surf` and `core:surf` are how
each tone reads against the surface behind the control.

| Theme | Scheme | Halo | Core | halo:core | halo:surf | core:surf |
|---|---|---|---|---|---|---|
| default-dark | dark | `#edf5fb` | `#008e85` | 3.66 | 14.33 | 3.92 |
| default-light | light | `#101416` | `#006e66` | 3.02 | 17.66 | 5.85 |
| material-dark | dark | `#fcf1f4` | `#915bcd` | 4.15 | 15.11 | 3.64 |
| material-light | light | `#251e20` | `#7444ff` | 3.12 | 16.34 | 5.23 |
| darcula | dark | `#251e20` | `#7aaace` | 6.59 | 1.54 | 4.28 |
| nord | dark | `#1d2025` | `#76aebd` | 6.66 | 1.62 | 4.10 |
| solarized-dark | dark | `#f2f9fb` | `#3496de` | 3.00 | 12.21 | 4.06 |
| solarized-light | light | `#0e0d0a` | `#00639e` | 3.03 | 15.86 | 5.23 |
| high-contrast | dark | `#fcf1f4` | `#2b82bc` | 3.79 | 15.77 | 4.16 |
| catppuccin-mocha | dark | `#1f1f24` | `#7aa4e9` | 6.50 | 1.31 | 4.98 |
| tokyo-night | dark | `#1f1f25` | `#79a1f6` | 6.43 | 1.13 | 5.72 |
| gruvbox-dark | dark | `#251e20` | `#f97b0d` | 6.12 | 1.41 | 4.34 |
| cyberpunk | dark | `#f3f3fb` | `#dd007c` | 4.36 | 16.88 | 3.87 |
| synthwave | dark | `#f3f3fb` | `#dd655a` | 3.13 | 14.83 | 4.74 |
| github-light | light | `#251e20` | `#1570e1` | 3.45 | 15.35 | 4.45 |
| catppuccin-latte | light | `#020203` | `#004dda` | 3.04 | 17.05 | 5.62 |
| sunset-boulevard | light | `#21201a` | `#ba5100` | 3.32 | 14.66 | 4.42 |
| ocean-breeze | light | `#0c0f11` | `#006499` | 3.01 | 16.76 | 5.57 |
| crimson-canvas | dark | `#f8f2f8` | `#f7453e` | 3.24 | 14.26 | 4.40 |
| forest-whisper | light | `#121614` | `#007232` | 3.00 | 14.65 | 4.88 |
| halloween | dark | `#fcf1f4` | `#b66200` | 4.02 | 15.11 | 3.76 |
| reverse-halloween | light | `#251e20` | `#8953cb` | 3.24 | 14.99 | 4.63 |
| midnight-rose | dark | `#fcf1f4` | `#e10b5c` | 4.32 | 15.77 | 3.65 |

---

## Three things for your eye

### 1. Five dark themes flip to a dark halo, and they do look different

Darcula, Nord, Catppuccin Mocha, Tokyo Night and Gruvbox Dark all have accents light enough
that a white halo could not clear 3:1 against the core. The engine flips them to the dark pole
instead, which is the fallback behaviour working exactly as designed. The pair guarantee still
holds, and on those five the core is what separates the ring from the surface.

The visual consequence is real though. On those five the halo sits at 1.1 to 1.6 against the
surface, which means it reads as a soft dark edge that nearly blends into the background rather
than as a bright outline. The ring is still clearly visible, but it does not look like the ring
on the default dark theme. Whether that is acceptable range or an inconsistency you want closed
is a design call, not an accessibility one, and it is yours.

If you want them consistent, the lever is the derivation rule rather than per-theme overrides.
We deliberately did not add an authored halo override to theme JSON, because that would
reintroduce exactly the failure mode the derived halo exists to close.

### 2. Eight themes sit almost exactly on the 3:1 floor

Solarized Dark and Forest Whisper land on 3.00, and Ocean Breeze, the default light theme,
Solarized Light, Catppuccin Latte, Material Light and Synthwave are all between 3.01 and 3.13.
That is the ramp stopping at the first step that passes rather than continuing to a comfortable
margin.

It is compliant, and it is thin. If you would rather the pair had visible headroom, raising the
target from 3:1 to something like 4:1 is a one-line change to the derivation and would push
those eight further toward their pole. The cost is that the halo gets brighter or darker than
strictly necessary on those themes, which slightly increases how much the ring draws attention.
Our instinct is that it is worth doing and we would like your read before changing it.

### 3. The 2 / 2 / 2 geometry

Six pixels of total ring, evenly split. We checked it at 2x on the tightest layouts we have: a
segmented control, a filter chip, a switch inside the settings drawer, and a button inside a
table cell. None of them clips the halo and none of them collides with a neighbour.

The thing to judge in situ is weight rather than fit. At small control sizes the ring is a
noticeable amount of the control's visual mass, and if it reads as heavy the halo is the half
to thin rather than the core.

---

## Where to see it

The dev site is `https://wordpress.lan/`. Tab through the gallery header, then open the
Settings panel and tab through the controls there. The themes worth comparing directly are
the default dark theme against Tokyo Night, which is the clearest example of the pole flip,
and the default light theme, which is one of the eight sitting on the floor.

## What it does not cover

The ring is audited across the 23 shipped themes and is derived rather than authored, which is
what makes it correct for user-authored themes that no audit can see. That was the point of
building it. What no audit can reach is a user's own gallery border and tile colours, which are
arbitrary hex values from the settings panel and are not theme tokens. A control sitting on top
of a user-chosen colour is outside what the halo can guarantee, and always was.
