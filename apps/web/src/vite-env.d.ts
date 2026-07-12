/// <reference types="vite/client" />

import type { ShowtimeHostBridge } from "@showtime/shared";

declare global {
  interface Window {
    showtime?: ShowtimeHostBridge;
  }
}
