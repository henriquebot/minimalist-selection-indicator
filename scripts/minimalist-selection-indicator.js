const MODULE_ID = "minimalist-selection-indicator";
const PREVIEW_KEYS = [
  "style",
  "thickness",
  "opacity",
  "padding",
  "selectedColor",
  "hoverColor",
  "glow",
  "glowStrength"
];

const previewSettings = new Map();
const textureFilterState = new WeakMap();
let previewActive = false;

function setting(key) {
  if (previewActive && previewSettings.has(key)) return previewSettings.get(key);
  return game.settings.get(MODULE_ID, key);
}

function toColorInt(value, fallback = "#FFFFFF") {
  for (const candidate of [value, fallback]) {
    try {
      return Number(foundry.utils.Color.from(candidate));
    } catch (_err) {
      // Try fallback.
    }
  }
  return 0xFFFFFF;
}

function refreshAllTokens() {
  if (!canvas?.ready) return;
  for (const token of canvas.tokens?.placeables ?? []) {
    token.renderFlags.set({
      refreshBorder: true,
      refreshState: true
    });
    if (setting("style") === "outline") syncTextureFilters(token);
    else removeTextureFilters(token);
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

function drawGlow(graphics, token, style, lineWidth, color, alpha, paddingPct, strength) {
  const normalizedStrength = Math.max(0.25, Math.min(3, Number(strength) || 1));
  const layers = [
    { extra: 12 * normalizedStrength, alpha: 0.10 },
    { extra: 8 * normalizedStrength, alpha: 0.18 },
    { extra: 5 * normalizedStrength, alpha: 0.28 },
    { extra: 2.5 * normalizedStrength, alpha: 0.50 }
  ];

  for (const layer of layers) {
    drawIndicator(
      graphics,
      token,
      style,
      lineWidth + layer.extra,
      color,
      Math.min(1, alpha * layer.alpha * Math.min(1.5, normalizedStrength)),
      paddingPct
    );
  }
}

function isIndicatorActive(token) {
  return Boolean(token?.controlled || token?.hover || token?.layer?.highlightObjects);
}

function indicatorColor(token) {
  // Selection always wins over hover. Keeping this decision local avoids Foundry's
  // disposition/hover border logic bleeding a second color into our indicator.
  return token?.controlled
    ? toColorInt(setting("selectedColor"), "#D7F7FF")
    : toColorInt(setting("hoverColor"), "#FFFFFF");
}

function colorToRgba(color, alpha = 1) {
  const value = Number(color) >>> 0;
  return [
    ((value >> 16) & 0xFF) / 255,
    ((value >> 8) & 0xFF) / 255,
    (value & 0xFF) / 255,
    Math.max(0, Math.min(1, Number(alpha) || 0))
  ];
}

function stripMsiFilters(mesh) {
  if (!mesh || mesh.destroyed || !mesh.filters?.length) return;
  const remaining = mesh.filters.filter((filter) => !filter?._msiSelectionFilter);
  mesh.filters = remaining.length ? remaining : null;
}

function removeTextureFilters(token, { destroy = true } = {}) {
  const owned = textureFilterState.get(token);
  const meshes = new Set([owned?.mesh, token?.mesh].filter(Boolean));

  for (const mesh of meshes) {
    try {
      stripMsiFilters(mesh);
    } catch (_err) {
      // The token may be tearing down or swapping meshes.
    }
  }

  if (destroy && owned?.filters) {
    for (const filter of owned.filters) {
      try {
        filter?.destroy?.();
      } catch (_err) {
        // Best-effort GPU cleanup.
      }
    }
  }

  textureFilterState.delete(token);
}

function syncTextureFilters(token) {
  const mesh = token?.mesh;
  const active = Boolean(
    mesh &&
    !mesh.destroyed &&
    token.visible &&
    token.renderable !== false &&
    isIndicatorActive(token) &&
    setting("style") === "outline"
  );

  if (!active) {
    removeTextureFilters(token);
    return;
  }

  const color = indicatorColor(token);
  const opacity = Math.max(0, Math.min(1, Number(setting("opacity")) || 0));
  const thickness = Math.max(0.25, Number(setting("thickness")) || 0.5);
  const baseThickness = Math.max(1, CONFIG.Canvas.objectBorderThickness ?? 4);
  const lineWidth = Math.max(1, baseThickness * thickness);
  const glowEnabled = Boolean(setting("glow"));
  const glowStrength = Math.max(0.25, Math.min(3, Number(setting("glowStrength")) || 1));
  const state = token.controlled ? "selected" : "hover";
  const signature = [
    state,
    color,
    opacity,
    lineWidth,
    glowEnabled,
    glowStrength
  ].join("|");

  const owned = textureFilterState.get(token);
  if (owned?.mesh === mesh && owned.signature === signature) return;

  removeTextureFilters(token);

  const FilterNamespace = foundry.canvas?.rendering?.filters;
  const OutlineFilter = FilterNamespace?.OutlineOverlayFilter;
  const GlowFilter = FilterNamespace?.GlowOverlayFilter;

  if (!OutlineFilter?.create) {
    console.warn(MODULE_ID + " | OutlineOverlayFilter is unavailable; silhouette outline skipped.");
    return;
  }

  const filters = [];
  const outline = OutlineFilter.create({
    outlineColor: colorToRgba(color, opacity),
    knockout: false,
    wave: false
  });
  outline._msiSelectionFilter = true;
  outline.animated = false;
  outline.thickness = lineWidth;
  outline.padding = Math.max(Number(outline.padding) || 0, Math.ceil(lineWidth * 2 + 4));
  filters.push(outline);

  if (glowEnabled && GlowFilter?.create) {
    const distance = Math.round(10 + (glowStrength * 10));
    const glow = GlowFilter.create({
      glowColor: colorToRgba(color, 1),
      distance,
      quality: 0.12,
      knockout: false,
      alpha: opacity
    });
    glow._msiSelectionFilter = true;
    glow.animated = false;
    glow.outerStrength = 3 + (glowStrength * 4);
    glow.innerStrength = 0.5 + (glowStrength * 0.75);
    glow.padding = Math.max(Number(glow.padding) || 0, distance + 8);
    filters.push(glow);
  }

  const existing = (mesh.filters ?? []).filter((filter) => !filter?._msiSelectionFilter);
  mesh.filters = [...existing, ...filters];
  textureFilterState.set(token, { mesh, filters, signature });
}

function refreshBorderOverride() {
  const border = this.border;
  border.clear();

  if (!this.visible || !isIndicatorActive(this)) {
    removeTextureFilters(this);
    return;
  }

  const style = setting("style");

  // Silhouette mode belongs on the token mesh itself. Foundry's outline/glow filters
  // sample texture alpha, so transparent pixels are ignored and the effect hugs the art.
  if (style === "outline") {
    syncTextureFilters(this);
    return;
  }

  removeTextureFilters(this);

  const thickness = setting("thickness");
  const opacity = setting("opacity");
  const paddingPct = setting("padding");
  const color = indicatorColor(this);

  const baseThickness = Math.max(1, CONFIG.Canvas.objectBorderThickness ?? 4);
  const lineWidth = Math.max(1, baseThickness * thickness);

  // Glow applies to both selected and hovered tokens, using exactly the same state color.
  if (setting("glow")) {
    drawGlow(
      border,
      this,
      style,
      lineWidth,
      color,
      opacity,
      paddingPct,
      setting("glowStrength")
    );
  }

  // A subtle dark under-stroke keeps the indicator readable over bright maps
  // without recreating Foundry's heavy default selection box.
  drawIndicator(
    border,
    this,
    style,
    lineWidth + Math.max(1, baseThickness * 0.65),
    0x000000,
    opacity * 0.35,
    paddingPct
  );
  drawIndicator(border, this, style, lineWidth, color, opacity, paddingPct);
}

function colorField(initial) {
  const ColorField = foundry.data?.fields?.ColorField;
  return ColorField
    ? new ColorField({ required: true, nullable: false, initial })
    : String;
}

function registerSettings() {
  game.settings.register(MODULE_ID, "style", {
    name: "MSI.Settings.Style.Name",
    hint: "MSI.Settings.Style.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      ring: game.i18n.localize("MSI.Settings.Style.Ring"),
      corners: game.i18n.localize("MSI.Settings.Style.Corners"),
      outline: game.i18n.localize("MSI.Settings.Style.Outline")
    },
    default: "ring",
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "thickness", {
    name: "MSI.Settings.Thickness.Name",
    hint: "MSI.Settings.Thickness.Hint",
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
    name: "MSI.Settings.Opacity.Name",
    hint: "MSI.Settings.Opacity.Hint",
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
    name: "MSI.Settings.Padding.Name",
    hint: "MSI.Settings.Padding.Hint",
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
    name: "MSI.Settings.SelectedColor.Name",
    hint: "MSI.Settings.SelectedColor.Hint",
    scope: "world",
    config: true,
    type: colorField("#D7F7FF"),
    default: "#D7F7FF",
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "hoverColor", {
    name: "MSI.Settings.HoverColor.Name",
    hint: "MSI.Settings.HoverColor.Hint",
    scope: "world",
    config: true,
    type: colorField("#FFFFFF"),
    default: "#FFFFFF",
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "glow", {
    name: "MSI.Settings.Glow.Name",
    hint: "MSI.Settings.Glow.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: refreshAllTokens
  });

  game.settings.register(MODULE_ID, "glowStrength", {
    name: "MSI.Settings.GlowStrength.Name",
    hint: "MSI.Settings.GlowStrength.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0.25,
      max: 3,
      step: 0.25
    },
    default: 1,
    onChange: refreshAllTokens
  });
}

function normalizeSettingsRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (globalThis.jQuery && html instanceof jQuery) return html.get(0);
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function fieldValue(root, key) {
  const field = root.querySelector(`[name="${MODULE_ID}.${key}"]`);
  if (!field) return undefined;

  if (key === "glow") return Boolean(field.checked);

  const value = field.value;
  if (["thickness", "opacity", "padding", "glowStrength"].includes(key)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return value;
}

function applyPreview(root) {
  previewSettings.clear();

  for (const key of PREVIEW_KEYS) {
    const value = fieldValue(root, key);
    if (value !== undefined) previewSettings.set(key, value);
  }

  previewActive = true;
  refreshAllTokens();
  ui.notifications.info(game.i18n.localize("MSI.Preview.Applied"));
}

function clearPreview() {
  if (!previewActive) return;
  previewActive = false;
  previewSettings.clear();
  refreshAllTokens();
}

function addPreviewButton(html) {
  const root = normalizeSettingsRoot(html);
  if (!root) return;

  const lastField = root.querySelector(`[name="${MODULE_ID}.glowStrength"]`);
  if (!lastField) return;

  const lastGroup = lastField.closest(".form-group") ?? lastField.parentElement;
  if (!lastGroup || lastGroup.parentElement?.querySelector(".msi-preview-button")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "msi-preview-button";
  button.innerHTML = `<i class="fa-solid fa-eye"></i> ${game.i18n.localize("MSI.Preview.Button")}`;
  button.title = game.i18n.localize("MSI.Preview.Hint");
  button.addEventListener("click", () => applyPreview(root));

  lastGroup.insertAdjacentElement("afterend", button);
}

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("setup", () => {
  const libWrapperActive = game.modules.get("lib-wrapper")?.active && globalThis.libWrapper;

  if (libWrapperActive) {
    libWrapper.register(MODULE_ID, "Token.prototype._refreshBorder", refreshBorderOverride, "OVERRIDE");
    console.log(`${MODULE_ID} | Initialized with libWrapper`);
    return;
  }

  // No dependency is required. When libWrapper is present we use it for better
  // interoperability; otherwise a small direct override keeps the module standalone.
  const TokenClass = CONFIG.Token.objectClass;
  TokenClass.prototype._refreshBorder = refreshBorderOverride;
  console.log(`${MODULE_ID} | Initialized without libWrapper`);
});

Hooks.on("renderSettingsConfig", (_app, html) => {
  addPreviewButton(html);
});

Hooks.on("closeSettingsConfig", () => {
  // If the window is closed without saving, return the canvas to persisted values.
  // If it was saved, persisted values are already the source of truth after this reset.
  clearPreview();
});

Hooks.on("drawToken", (token) => {
  if (setting("style") === "outline") syncTextureFilters(token);
});

Hooks.on("refreshToken", (token) => {
  if (setting("style") === "outline") syncTextureFilters(token);
  else removeTextureFilters(token);
});

Hooks.on("destroyToken", (token) => {
  removeTextureFilters(token);
});

Hooks.once("ready", refreshAllTokens);
