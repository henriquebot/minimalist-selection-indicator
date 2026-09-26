# Minimalist Selection Indicator

A tiny, system-agnostic Foundry VTT v14 module that replaces the heavy square token selection frame with a cleaner indicator.

## Features

- **Ring** selection indicator (default)
- **Corner brackets** alternative
- **Silhouette outline** that follows the visible token artwork and ignores transparent pixels
- Optional **neon glow** for both selected and hovered tokens, with adjustable intensity
- Native Foundry **color pickers** for selected and hovered tokens
- Adjustable thickness, opacity, and padding
- **Apply Preview** button: test unsaved settings directly on the canvas without closing the settings window
- English and Brazilian Portuguese localization, following Foundry's active language
- Works with square, rectangular, and gridless tokens
- No required dependencies
- Uses **libWrapper** automatically if it is installed and active

## Compatibility

- Foundry VTT **v14**
- Verified against the v14.368 API
- System agnostic

## Installation

In Foundry VTT, open **Add-on Modules → Install Module** and paste this manifest URL:

```
https://raw.githubusercontent.com/henriquebot/minimalist-selection-indicator/main/module.json
```

Then enable **Minimalist Selection Indicator** in your world.

## Configuration

Open **Game Settings → Configure Settings → Module Settings**.

Available settings:

- Indicator style: Ring / Corner brackets / Silhouette outline
- Neon glow on/off
- Glow intensity
- Line thickness
- Opacity
- Indicator padding
- Selected token color
- Hovered token color
- Apply Preview

Preview changes are temporary until **Save Changes** is used. Closing the settings window without saving restores the persisted appearance.

## Languages

- English
- Português (Brasil)

## Why?

Foundry's standard token selection frame is useful, but visually heavy for immersive, cinematic, or horror games. This module keeps token selection readable while reducing the "board game" look of the canvas.

## License

MIT.
