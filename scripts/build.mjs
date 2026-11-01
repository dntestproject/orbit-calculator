import { build } from "esbuild";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
mkdirSync(resolve(root, "js"), { recursive: true });

await build({
  entryPoints: [resolve(root, "src/main.js")],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  target: ["es2020"],
  outfile: resolve(root, "js/app.js"),
  legalComments: "none",
});

console.log("built js/app.js");
