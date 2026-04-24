import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const shared = {
    outdir: "dist",
    format: "esm" as const,
    target: "node" as const,
    sourcemap: "linked" as const,
    root: "src",
    external: ["react", "vue"],
    splitting: false,
};

function failIfBuildError(label: string, result: { success: boolean; logs: unknown[] }) {
    if (result.success) return;
    console.error(`Build failed (${label}):`, result.logs);
    process.exit(1);
}

process.chdir(projectRoot);
rmSync("dist", { recursive: true, force: true });

const indexVue = await Bun.build({
    ...shared,
    entrypoints: ["src/index.ts", "src/vue.ts"],
});
failIfBuildError("index + vue", indexVue);

const reactOut = await Bun.build({
    ...shared,
    entrypoints: ["src/react.ts"],
    banner: '"use client";',
});
failIfBuildError("react", reactOut);

const tsc = spawnSync("bun", ["x", "tsc", "-p", "tsconfig.build.json"], {
    stdio: "inherit",
    cwd: projectRoot,
    shell: false,
});
if (tsc.status !== 0) {
    process.exit(tsc.status ?? 1);
}
