import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tauriConfig from "./src-tauri/tauri.conf.json" with { type: "json" };
import { isUpdaterEndpointConfigured } from "./src/lib/updater-config.ts";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [vue()],
  define: {
    __UPDATER_CONFIGURED__: JSON.stringify(
      isUpdaterEndpointConfigured(tauriConfig.plugins.updater.endpoints),
    ),
  },

  // Keep Rust errors visible in Tauri commands.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
