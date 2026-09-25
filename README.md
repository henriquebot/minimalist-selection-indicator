# Minimalist Selection Indicator

A tiny, system-agnostic Foundry VTT v14 module that replaces the heavy square token selection frame with a cleaner indicator.

## Features

- **Ring** selection indicator (default)
- **Corner brackets** alternative
- Separate selected and hover colors
- Adjustable thickness, opacity, and padding
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

- Indicator style: Ring / Corner brackets
- Line thickness
- Opacity
- Indicator padding
- Selected token color
- Hovered token color

## Why?

Foundry's standard token selection frame is useful, but visually heavy for immersive, cinematic, or horror games. This module keeps token selection readable while reducing the "board game" look of the canvas.

## License

MIT.
