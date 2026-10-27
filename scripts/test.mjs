import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: [
    "tests/analytics.test.ts",
    "tests/data.test.ts",
    "tests/catalog-progress.test.ts",
    "tests/ui.test.tsx",
    "tests/catalog-ui.test.tsx",
    "tests/setup.ts",
    "tests/media.test.tsx",
    "tests/database.test.ts",
    "tests/cloud.test.tsx",
  ],
  outdir: ".test-build",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
});
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./.test-build/setup.js",
    "--test",
    ".test-build/analytics.test.js",
    ".test-build/data.test.js",
    ".test-build/catalog-progress.test.js",
    ".test-build/catalog-ui.test.js",
    ".test-build/ui.test.js",
    ".test-build/media.test.js",
    ".test-build/database.test.js",
    ".test-build/cloud.test.js",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
