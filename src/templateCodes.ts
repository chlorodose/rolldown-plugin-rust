export const indexJsSyncCode = `export * from "./index_bg.js";
import { __wbg_set_wasm } from "./index_bg.js";
import * as bgObject from "./index_bg.js";
import loadWASM from "./index_bg.wasm";
export default function() {
    let wasm = (new WebAssembly.Instance(loadWASM(), {"./index_bg.js": bgObject})).exports;
    __wbg_set_wasm(wasm);
    if(typeof wasm["__wbindgen_start"] === "function") wasm.__wbindgen_start();
}`;
export const indexJsAsyncCode = `export * from "./index_bg.js";
import { __wbg_set_wasm } from "./index_bg.js";
import * as bgObject from "./index_bg.js";
import loadWASM from "./index_bg.wasm";
export default async function() {
    let wasm = (new WebAssembly.Instance(await loadWASM(), {"./index_bg.js": bgObject})).exports;
    __wbg_set_wasm(wasm);
    if(typeof wasm["__wbindgen_start"] === "function") wasm.__wbindgen_start();
}`;
export const indexDTsSyncCode = `export default function (): void;\n`;
export const indexDTsAsyncCode = `export default async function (): void;\n`;
export const externalCode = `export default function() {
    return new WebAssembly.Module(buffer, compileOptions);
}`;
export const fetchCode = `export default async function() {
    return await WebAssembly.compileStreaming(fetch(url), compileOptions);
}`;
export const base64Code = `function getBuffer() {
    // Use native impl if in node.js
    if ("Buffer" in global) return Buffer.from(base64, "base64").buffer;
    // Otherwise we do it by hand
    // From package base64-arraybuffer written by niklasvh license with MIT, thank you!
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }
    let bufferLength = base64.length * 0.75,
        len = base64.length,
        i,
        p = 0,
        encoded1,
        encoded2,
        encoded3,
        encoded4;

    if (base64[base64.length - 1] === '=') {
        bufferLength--;
        if (base64[base64.length - 2] === '=') {
            bufferLength--;
        }
    }

    const arraybuffer = new ArrayBuffer(bufferLength),
        bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i += 4) {
        encoded1 = lookup[base64.charCodeAt(i)];
        encoded2 = lookup[base64.charCodeAt(i + 1)];
        encoded3 = lookup[base64.charCodeAt(i + 2)];
        encoded4 = lookup[base64.charCodeAt(i + 3)];

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
}

export default function () {
    return new WebAssembly.Module(getBuffer(), compileOptions);
}`;