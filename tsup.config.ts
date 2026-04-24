import { defineConfig } from "tsup";

export default defineConfig({
    tsconfig: "tsconfig.build.json",
    entry: ["src/index.ts", "src/react.ts", "src/vue.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    outDir: "dist",
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ["react", "vue"],
});
