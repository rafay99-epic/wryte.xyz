"use strict";

const { Menu } = require("electron");
const config = require("../config.cjs");
const win = require("../window/window.cjs");
const { openAboutWindow } = require("../about/about.cjs");
const updater = require("../updater/updater.cjs");

const isMac = process.platform === "darwin";

/** Build and install the application menu. */
function build() {
  const help = [
    {
      label: "Wryte on GitHub",
      click: () => win.openExternal(config.REPO_URL),
    },
    {
      label: "Report an Issue",
      click: () => win.openExternal(`${config.REPO_URL}/issues/new`),
    },
  ];

  const template = [
    ...(isMac
      ? [
          {
            label: "Wryte",
            submenu: [
              { label: "About Wryte", click: openAboutWindow },
              { label: "Check for Updates…", click: updater.checkManually },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => win.setZoom(0),
        },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => win.nudgeZoom(0.5),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => win.nudgeZoom(-0.5),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "History",
      submenu: [
        {
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          click: () => win.goBack(),
        },
        {
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          click: () => win.goForward(),
        },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: isMac
        ? help
        : [
            { label: "About Wryte", click: openAboutWindow },
            { label: "Check for Updates…", click: updater.checkManually },
            { type: "separator" },
            ...help,
          ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { build };
