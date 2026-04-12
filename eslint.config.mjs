import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase Edge Functions run on Deno with esm.sh imports and
    // Deno.env. They are not part of the Next.js build graph and
    // have no TypeScript project reference — eslint-config-next
    // false-positives on them heavily.
    "supabase/functions/**",
  ]),
  // Node.js CommonJS scripts — relax TS-flavoured rules that
  // assume ES modules. These files run via `node scripts/foo.js`,
  // use require()/module.exports legitimately, and are not part
  // of the Next.js build graph.
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
