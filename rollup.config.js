import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import autoPreprocess from "svelte-preprocess";
import { env } from "process";
import { sep } from "path";

/** obsidian-calendar-ui still reads localStorage; use getLanguage() instead. */
function patchCalendarUiLanguage() {
  const from = 'localStorage.getItem("language")';
  return {
    name: "patch-calendar-ui-get-language",
    transform(code, id) {
      if (!id.includes(`${sep}obsidian-calendar-ui${sep}`) || !code.includes(from)) {
        return null;
      }
      return {
        code: code.split(from).join('require("obsidian").getLanguage()'),
        map: null,
      };
    },
  };
}

export default {
  input: "src/main.ts",
  output: {
    format: "cjs",
    file: "main.js",
    exports: "default",
  },
  external: ["obsidian", "fs", "os", "path"],
  plugins: [
    patchCalendarUiLanguage(),
    svelte({
      emitCss: false,
      preprocess: autoPreprocess(),
    }),
    typescript({ sourceMap: env.env === "DEV" }),
    resolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs({
      include: "node_modules/**",
    }),
  ],
};
