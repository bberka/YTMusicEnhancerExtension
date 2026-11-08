import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

// Content scripts must stay classic scripts, so content.js gets its own IIFE
// bundle instead of sharing chunks with the extension pages.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "content.js",
      formats: ["iife"],
      name: "MusicEnhancerContent",
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: { extend: false },
    },
  },
  plugins: [{
    name: "copy-content-to-firefox",
    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir;
      const firefoxDir = path.join(outDir, "firefox");
      await mkdir(firefoxDir, { recursive: true });
      for (const fileName of Object.keys(bundle)) {
        if (fileName === "manifest.json" || fileName.startsWith("firefox/")) continue;
        await copyFile(path.join(outDir, fileName), path.join(firefoxDir, fileName));
      }
    },
  }],
});
