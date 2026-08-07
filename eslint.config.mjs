import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next@15.5.22 still ships its "next/core-web-vitals" and
// "next/typescript" presets in the legacy eslintrc shareable-config format
// (plain `module.exports = { extends: [...] }` — see
// node_modules/eslint-config-next/core-web-vitals.js), not as native flat
// config arrays. ESLint 9 only understands flat config by default, so
// FlatCompat (from @eslint/eslintrc) bridges the legacy presets in. This is
// the same pattern `create-next-app` itself scaffolds for this combination
// of eslint-config-next/ESLint versions.
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
