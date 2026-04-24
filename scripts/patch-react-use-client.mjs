import { readFileSync, writeFileSync } from "node:fs";

const path = "dist/react.js";
const code = readFileSync(path, "utf8");
if (!code.startsWith('"use client"')) {
    writeFileSync(path, `"use client";\n${code}`);
}
