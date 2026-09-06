import esbuild from "esbuild";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === "production";

await esbuild.build({
  banner: { js: "/* Mooring — Obsidian plugin */" },
  entryPoints: [path.join(root, "src/obsidian/main.ts")],
  bundle: true,
  outfile: path.join(root, "main.js"),
  platform: "node",
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  jsx: "automatic",
  alias: {
    "@/lib/agents/host": path.join(root, "src/obsidian/host-shim.ts"),
    "@": path.join(root, "src"),
  },
  external: [
    "obsidian",
    "electron",
    "child_process",
    "node:child_process",
    "fs",
    "node:fs",
    "path",
    "node:path",
    "os",
    "node:os",
    "crypto",
    "node:crypto",
    "util",
    "node:util",
    "stream",
    "node:stream",
    "events",
    "node:events",
    "assert",
    "node:assert",
  ],
  loader: {
    ".png": "dataurl",
    ".svg": "dataurl",
    ".css": "empty",
  },
  plugins: [
    {
      name: "strip-url-query",
      setup(build) {
        build.onResolve({ filter: /\?(url|raw)$/ }, (args) => {
          const cleaned = args.path.replace(/\?.*$/, "");
          if (cleaned.startsWith("@/")) {
            return { path: path.join(root, "src", cleaned.slice(2)) };
          }
          return { path: path.resolve(path.dirname(args.importer), cleaned) };
        });
      },
    },
  ],
});
