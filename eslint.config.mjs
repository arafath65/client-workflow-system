import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Next.js generated files
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Dependencies
    "node_modules/**",

    // Electron / desktop generated files
    "release/**",
    "desktop-runtime/**",

    // Electron CommonJS runtime files
    "electron/**/*.cjs",

    // Desktop build helper scripts
    "scripts/**/*.cjs",
  ]),
]);

export default eslintConfig;