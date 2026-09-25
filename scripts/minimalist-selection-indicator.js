const MODULE_ID = "minimalist-selection-indicator";

function setting(key) {
  return game.settings.get(MODULE_ID, key);
}

function parseHexColor(value, fallback = 0xFFFFFF) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
}

function refreshAllTokens() {
  if (!canvas?.ready) return;
  for (const token of canvas.tokens?.placeables ?? []) {
    token.renderFlags.set({
      refreshBorder: true,
      refreshState: true
    });
  }
}

function drawRing(graphics, token, lineWidth, color, alpha, paddingPct) {
  const pad = Math.min(token.w, token.h) * (paddingPct / 100);
  const cx = token.w / 2;
  const cy = token.h / 2;
  const rx = Math.max(1, (token.w / 2) + pad);
  const ry = Math.max(1, (token.h / 2) + pad);

  graphics.lineStyle(lineWidth, color, alpha);
  graphics.drawEllipse(cx, cy, rx, ry);
}

function drawCorners(graphics, token, lineWidth, color, alpha, paddingPct) {
  const pad = Math.min(token.w, token.h) * (paddingPct / 100);
  const left = -pad;
  const top = -pad;
  const right = token.w + pad;
  const bottom = token.h + pad;
  const length = Math.max(8, Math.min(token.w, token.h) * 0.18);

  graphics.lineStyle(lineWidth, color, alpha);

  graphics.moveTo(left, top + length);
  graphics.lineTo(left, top);
  graphics.lineTo(left + length, top);

  graphics.moveTo(right - length, top);
  graphics.lineTo(right, top);
  graphics.lineTo(right, top + length);

  graphics.moveTo(right, bottom - length);
  graphics.lineTo(right, bottom);
  graphics.lineTo(right - length, bottom);

  graphics.moveTo(left + length, bottom);
  graphics.lineTo(left, bottom);
  graphics.lineTo(left, bottom - length);
}

function drawIndicator(graphics, token, style, lineWidth, color, alpha, paddingPct) {
  if (style === "corners") {
    drawCorners(graphics, token, lineWidth, color, alpha, paddingPct);
  } else {
    drawRing(graphics, token, lineWidth, color, alpha, paddingPct);
  }
}

function refreshBorderOverride() {
  const border = this.border;
  border.clear();

  if (!this.visible) return;

  const style = setting("style");
  const thickness = setting("thickness");
  const opacity = setting("opacity");
  const paddingPct = setting("padding");

  const baseThickness = Math.max(1, CONFIG.Canvas.objectBorderThickness ?? 4);
  const lineWidth = Math.max(1, baseThickness * thickness);

  // A subtle dark under-stroke keeps the indicator readable over bright maps
  // without recreating Foundry's heavy default selection box.
  drawIndicator(border, this, style, lineWidth + Math.max(1, baseThickness * 0.65), 0x000000, opacity * 0.35, paddingPct);
  drawIndicator(border, this, style, lineWidth, 0xFFFFFF, opacity, paddingPct);
}

function getBorderColorOverride() {
  if (this.controlled) {
    return parseHexColor(setting("selectedColor"), 0xD7F7FF);
  }
  return parseHexColor(setting("hoverColor"), 0xFFFFFF);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "style", {
    name: "Indicator style",
    hint: "Ring replaces the selection square with a thin ellipse. Corner brackets keep only four minimal corner marks.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      ring: "Ring",
      corners: "Corner brackets"
    },
    default: "ring",
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "thickness", {
    name: "Line thickness",
    hint: "Thickness relative to Foundry's normal token border.",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0.25,
      max: 2,
      step: 0.25
    },
    default: 0.5,
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "opacity", {
    name: "Opacity",
    hint: "Opacity of the selection indicator.",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0.2,
      max: 1,
      step: 0.1
    },
    default: 0.8,
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "padding", {
    name: "Indicator padding",
    hint: "Distance from the token edge as a percentage of the token's smallest dimension.",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: -8,
      max: 20,
      step: 1
    },
    default: 4,
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "selectedColor", {
    name: "Selected token color",
    hint: "Hex color used for a controlled token, for example #D7F7FF.",
    scope: "world",
    config: true,
    type: String,
    default: "#D7F7FF",
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "hoverColor", {
    name: "Hovered token color",
    hint: "Hex color used while hovering a token, for example #FFFFFF.",
    scope: "world",
    config: true,
    type: String,
    default: "#FFFFFF",
    onChange: refreshAllTokens
  });
});

Hooks.once("setup", () => {
  const libWrapperActive = game.modules.get("lib-wrapper")?.active && globalThis.libWrapper;

  if (libWrapperActive) {
    libWrapper.register(MODULE_ID, "Token.prototype._refreshBorder", refreshBorderOverride, "OVERRIDE");
    libWrapper.register(MODULE_ID, "Token.prototype._getBorderColor", getBorderColorOverride, "OVERRIDE");
    console.log(`${MODULE_ID} | Initialized with libWrapper`);
    return;
  }

  // No dependency is required. When libWrapper is present we use it for better
  // interoperability; otherwise a small direct override keeps the module standalone.
  const TokenClass = CONFIG.Token.objectClass;
  TokenClass.prototype._refreshBorder = refreshBorderOverride;
  TokenClass.prototype._getBorderColor = getBorderColorOverride;
  console.log(`${MODULE_ID} | Initialized without libWrapper`);
});

Hooks.once("ready", refreshAllTokens);
