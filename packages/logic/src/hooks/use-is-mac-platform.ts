"use client";

import { isMac } from "@wryte/logic/lib/shortcuts";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useIsMacPlatform(): boolean {
  return useSyncExternalStore(subscribe, isMac, () => false);
}
