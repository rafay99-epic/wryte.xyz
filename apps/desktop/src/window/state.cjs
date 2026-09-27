"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, screen } = require("electron");

/**
 * Persisted window bounds + zoom, so the app reopens where you left it.
 * Stored as a small JSON in userData. Hand-rolled (no dependency).
 *
 * @typedef {{ width: number, height: number, x?: number, y?: number,
 *   zoom: number, isMaximized?: boolean }} WinState
 */

const DEFAULT_STATE = { width: 1280, height: 840, zoom: 0 };

function withDefaults(saved) {
  return { ...DEFAULT_STATE, ...saved };
}

/** @type {WinState} */
let winState = withDefaults({});
/** @type {NodeJS.Timeout | undefined} */
let saveTimer;

function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

/** Load persisted state; falls back to defaults on first launch. */
function load() {
  try {
    winState = withDefaults(JSON.parse(fs.readFileSync(stateFile(), "utf8")));
  } catch {
    // First launch / unreadable — defaults are fine.
  }
}

/** Write immediately — used on close, since a timer wouldn't fire before quit. */
function writeNow() {
  clearTimeout(saveTimer);
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(winState));
  } catch {
    // Non-fatal: a failed write just means we forget bounds this once.
  }
}

/** Debounced write — used during live resize/move. */
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 400);
}

/** @returns {WinState} */
function get() {
  return winState;
}

/** Snapshot a window's current bounds/maximized state into memory (no write). */
function capture(win) {
  if (!win || win.isDestroyed()) return;
  winState.isMaximized = win.isMaximized();
  // A maximized window's bounds are the whole screen — don't restore that as
  // the un-maximized size.
  if (!winState.isMaximized) Object.assign(winState, win.getBounds());
}

/**
 * Whether the saved position still lands on a connected display — otherwise a
 * window saved on an unplugged monitor would open off-screen.
 */
function positionVisible() {
  const { x, y } = winState;
  if (typeof x !== "number" || typeof y !== "number") {
    return false;
  }
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      x < a.x + a.width && x + 100 > a.x && y < a.y + a.height && y + 40 > a.y
    );
  });
}

/** @param {number} level */
function setZoom(level) {
  winState.zoom = Math.max(-3, Math.min(3, level));
}

module.exports = {
  load,
  save,
  writeNow,
  get,
  capture,
  positionVisible,
  setZoom,
};
