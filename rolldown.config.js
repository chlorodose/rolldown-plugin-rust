import pkg from "./package.json" with { type: "json" };
import { defineConfig } from 'rolldown';
import typescript from "rollup-plugin-typescript2"

export default defineConfig({
    input: "src/index.ts",
    output: {
        name: pkg.name,
        dir: "dist",
        format: "es",
        sourcemap: true,
        minify: true
    },
    plugins: [
        typescript()
    ]
})