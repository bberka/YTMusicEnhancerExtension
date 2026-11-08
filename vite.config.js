import { readFileSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const manifest = readFileSync(new URL("./manifest.json", import.meta.url), "utf8");
const contentCss = readFileSync(new URL("./content.css", import.meta.url), "utf8");
const iconSizes = [16, 32, 48, 128];

export default defineConfig({
  resolve: { alias: { "@": path.resolve("src") } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: "options.html",
        help: "help.html",
        content: "content.js",
        navigation: "navigation.js",
        background: "background.js",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [react(), tailwindcss(), {
    name: "emit-extension-files",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: manifest });
      this.emitFile({ type: "asset", fileName: "content.css", source: contentCss });
      for (const size of iconSizes) {
        const source = readFileSync(new URL(`./icons/icon${size}.png`, import.meta.url));
        this.emitFile({ type: "asset", fileName: `icons/icon${size}.png`, source });
      }
    },
    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir;
      const firefoxDir = path.join(outDir, "firefox");
      await mkdir(firefoxDir, { recursive: true });
      for (const fileName of Object.keys(bundle)) {
        if (fileName === "manifest.json" || fileName.startsWith("firefox/")) continue;
        const source = path.join(outDir, fileName);
        const destination = path.join(firefoxDir, fileName);
        await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(source, destination);
      }
      const firefoxManifest = JSON.parse(manifest);
      firefoxManifest.background = { scripts: ["background.js"] };
      firefoxManifest.browser_specific_settings = {
        gecko: { id: "music-enhancer@example.org", strict_min_version: "128.0" },
      };
      await writeFile(path.join(firefoxDir, "manifest.json"), JSON.stringify(firefoxManifest, null, 2));
    },
  }],
});
