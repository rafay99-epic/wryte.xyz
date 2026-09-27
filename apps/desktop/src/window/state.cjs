"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, screen } = require("electron");

const DEFAULT_STATE = { width: 1280, height: 840, zoom: 0 };

function withDefaults(saved) {
  return { ...DEFAULT_STATE, ...saved };
}

let winState = withDefaults({});
let saveTimer;

function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function load() {
  try {
    winState = withDefaults(JSON.parse(fs.readFileSync(stateFile(), "utf8")));
  } catch {}
}

function writeNow() {
  clearTimeout(saveTimer);
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(winState));
  } catch {}
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 400);
}

function get() {
  return winState;
}

function capture(win) {
  if (!win || win.isDestroyed()) return;
  winState.isMaximized = win.isMaximized();
  if (!winState.isMaximized) Object.assign(winState, win.getBounds());
}

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
