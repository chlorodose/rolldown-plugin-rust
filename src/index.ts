import { spawn } from "node:child_process";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { Plugin } from "rolldown";
import { base64Code, externalCode, fetchCode, indexDTsAsyncCode, indexDTsSyncCode, indexJsAsyncCode, indexJsSyncCode } from "./templateCodes";
import { existsSync } from "node:fs";

interface PluginConfig {
    /** Path to wasm-bindgen binary */
    wasmBindgen: string,
    /** Path to cargo binary */
    cargo: string;
    /** Extra args pass to wasm-bindgen command */
    wasmBindgenArgs: string[],
    /** Extra args pass to cargo build command */
    cargoArgs: string[]
    /** The profile where cargo builds for(Defaults dev in watch mode, otherwise release) */
    profile: "dev" | "release" | null | string,
    /** Target cpu architecture where cargo builds for(Keep it "mvp" unless you know what you're doing!) */
    targetCpu: "mvp" | "generic" | "bleeding-edge" | string,
    /** 
     * How do you wants to load your wasm file
     * base64: encode wasm file in js by base64-encoding(The default)
     * fetch: i want to load wasm file by `fetch`
     * external: i'll handle it myself(by another plugin)
     */
    wasmLoadMethod: "base64" | "fetch" | "external",
    /** Options will pass to the second parameter of `new WebAssembly.Module`(Defaults to undefined) */
    wasmCompileOptions: string | object,
    /** Do you want copy the typescript declaration file to the next of Cargo.toml? (Defaults to true) */
    copyDTS: boolean
}

export default function rust(cfg: Partial<PluginConfig> = {}): Plugin {
    const config: PluginConfig = {
        profile: cfg.profile ?? null,
        targetCpu: cfg.targetCpu ?? "mvp",
        wasmBindgen: cfg.wasmBindgen ?? "wasm-bindgen",
        cargo: cfg.cargo ?? "cargo",
        wasmBindgenArgs: cfg.wasmBindgenArgs ?? [],
        cargoArgs: cfg.cargoArgs ?? [],
        wasmLoadMethod: cfg.wasmLoadMethod ?? "base64",
        wasmCompileOptions: cfg.wasmCompileOptions ?? "undefined",
        copyDTS: cfg.copyDTS ?? true
    };

    if (config.wasmLoadMethod === "fetch") {
        console.warn("Load wasm in fetch is still experimental and may not work.");
    }

    let isWasmLoadAsync: boolean;
    switch (config.wasmLoadMethod) {
        case "base64":
        case "external":
            isWasmLoadAsync = false;
            break;
        case "fetch":
            isWasmLoadAsync = true;
            break;
    }

    const wasmFileMap: Map<string, string> = new Map();

    return {
        name: "rolldown-plugin-rust",
        buildStart() {
            wasmFileMap.clear();
            if (config.profile === null) {
                config.profile = (this.meta.watchMode) ? "dev" : "release";
            }
        },
        resolveId: {
            order: "pre",
            async handler(source, importer) {
                if (!source.endsWith("Cargo")) return null;
                source += ".toml";
                const p = path.join(path.dirname(importer ?? "."), source);
                if (!existsSync(p)) return null;
                const debug = this.debug.bind(this);
                debug(`Trying to resolve rust crate from ${p}`);
                const buildTask: Promise<void> = new Promise((resolve, reject) => {
                    const args = ["build", "--manifest-path", p, "--profile", config.profile!, "--target=wasm32-unknown-unknown", "-Zbuild-std=std,panic_abort", "--config", `target.wasm32-unknown-unknown.rustflags=["-Ctarget-cpu=${config.targetCpu}"]`].concat(config.cargoArgs);
                    debug(`Executing ${[config.cargo].concat(args).join(" ")}`);
                    const task = spawn(config.cargo, args, {
                        stdio: ["inherit", "inherit", "inherit"]
                    });
                    task.once("error", reject);
                    task.once("exit", (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Cargo build failed with code ${code}`));
                        }
                    });
                });
                const metaTask: Promise<{ targetDir: string, crateName: string }> = new Promise((resolve, reject) => {
                    const args = ["metadata", "--manifest-path", p, "--no-deps", "--format-version", "1"];
                    debug(`Executing ${[config.cargo].concat(args).join(" ")}`);
                    const task = spawn(config.cargo, args, {
                        stdio: ["pipe", "pipe", "pipe"]
                    });
                    task.once("error", reject);
                    let data = "";
                    task.stdout.setEncoding("utf-8");
                    task.stdout.addListener("data", (chunk) => {
                        data += chunk;
                    });
                    task.once("exit", (code) => {
                        if (code !== 0) {
                            reject(new Error(`Cargo metadata failed with code ${code}`));
                            return;
                        }
                        try {
                            const obj = JSON.parse(data);
                            resolve({
                                targetDir: obj["target_directory"],
                                crateName: obj["packages"][0]["name"]
                            })
                        } catch (error) {
                            reject(new Error("Failed to parse cargo metadata", { cause: error }));
                        }
                    });
                });
                const [_, meta] = await Promise.all([buildTask, metaTask]);
                const dir: string = await new Promise((resolve, reject) => {
                    const args = [path.join(meta.targetDir, "wasm32-unknown-unknown", config.profile!, `${meta.crateName.replaceAll("-", "_")}.wasm`), "--out-dir", path.join(meta.targetDir, "rolldown-plugin-rust", meta.crateName, config.profile!), "--out-name", "index"].concat(config.wasmBindgenArgs);
                    debug(`Executing ${[config.wasmBindgen].concat(args).join(" ")}`)
                    const task = spawn(config.wasmBindgen,
                        args, {
                        stdio: ["inherit", "inherit", "inherit"]
                    });
                    task.once("error", reject);
                    task.once("exit", (code) => {
                        if (code === 0) {
                            resolve(path.join(meta.targetDir, "rolldown-plugin-rust", meta.crateName, config.profile!));
                        } else {
                            reject(new Error(`WasmBindgen failed with code ${code}`))
                        }
                    });
                });
                await Promise.all([
                    writeFile(path.join(dir, "index.js"), isWasmLoadAsync ? indexJsAsyncCode : indexJsSyncCode, { encoding: "utf-8" }),
                    writeFile(path.join(dir, "index.d.ts"), isWasmLoadAsync ? indexDTsAsyncCode : indexDTsSyncCode, { encoding: "utf-8", flag: "a" })
                ]);
                if (config.copyDTS) {
                    await copyFile(path.join(dir, "index.d.ts"), path.join(path.dirname(p), "Cargo.d.ts"));
                }
                wasmFileMap.set(path.join(dir, "index_bg.wasm"), meta.crateName);
                return {
                    id: path.join(dir, "index.js"),
                    moduleSideEffects: true
                };
            }
        },
        async load(id) {
            if (!wasmFileMap.has(id)) return null;
            const crateName = wasmFileMap.get(id)!;
            wasmFileMap.delete(id);
            const compileOptions = `const compileOptions = ${(typeof config.wasmCompileOptions === "string") ? config.wasmCompileOptions : JSON.stringify(config.wasmCompileOptions)};\n`
            if (config.wasmLoadMethod === "external") {
                let resolve = await this.resolve(id, id, {
                    skipSelf: true,
                    custom: {
                        "rolldown-plugin-rust": {
                            crateName: crateName
                        }
                    }
                });
                return `const buffer = require("${resolve?.id ?? id}");\n` + compileOptions + externalCode;
            }
            if (config.wasmLoadMethod === "base64") {
                const base64 = (await readFile(id, { encoding: null })).toString("base64");
                return `const base64 = "${base64}";\n` + compileOptions + base64Code;
            }
            const referenceId = this.emitFile({
                type: "asset",
                name: `${crateName}.wasm`,
                originalFileName: path.basename(id),
                source: await readFile(id, { encoding: null })
            });
            this.debug(`Emit wasm file ${id} to refenceId ${referenceId}`);
            if (config.wasmLoadMethod === "fetch") {
                return `const url = new URL(import.meta.ROLLUP_FILE_URL_${referenceId});` + compileOptions + fetchCode;
            }
        }
    };
};