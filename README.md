# rolldown-plugin-rust

A Rolldown plugin that integrates Rust code (compiled to WebAssembly) into your JavaScript/TypeScript projects.

This plugin handles the compilation of Rust code to WebAssembly and makes it easy to import and use in your JavaScript/TypeScript applications. It automates the entire process from building your Rust code to generating the necessary JavaScript bindings.

## Features

- Automatic compilation of Rust code to WebAssembly using Cargo and wasm-bindgen
- Seamless integration with Rolldown build process
- Multiple WASM loading methods:
  - **base64**: Embed WASM as base64-encoded data (default)
  - **fetch**: Load WASM file via fetch API
  - **external**: Handle WASM loading with another plugin
- TypeScript declarations for your Rust modules

## Requirements

- **Rust toolchain**:
  - Rust (rustc, cargo)
  - wasm32-unknown-unknown target: `rustup target add wasm32-unknown-unknown`
  - rust-src component: `rustup component add rust-src`
- **wasm-bindgen CLI**: `cargo install wasm-bindgen-cli`
- **Rolldown** bundler

## Installation

```shell
$ npm install --save-dev rolldown-plugin-rust
```

## Usage

### Example project structure
```
my-project/
├── src/
│   ├── index.js         # Your JS entry point
│   └── lib.rs           # Your Rust entry point
├── Cargo.toml           # Rust package manifest
├── package.json         # JS package manifest
└── rolldown.config.js   # Rolldown config with rust plugin
```

Add the plugin to your rolldown configuration file:
```js
import { defineConfig } from 'rolldown';
import rust from 'rolldown-plugin-rust';

export default defineConfig({
  // ... other config options
  plugins: [
    rust(/* You can config this plugin here, but the defaults is pretty fine. */),
    // ... other plugins
  ]
});
```

Add imports to your javascript file
```js
// src/index.js
import {* as rust, initWasm} from '../Cargo';

// First, initialize the WASM module
initWasm();
// ...Or if you chose the async way
await initWasm();

// Then you can use your rust code freely
rust.do_something();
```

## Configuration Options
The plugin accepts the following configuration options:
```typescript
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
```

## Loading Methods Explained

- base64 (default): WASM binary is encoded as base64 and embedded directly in the JavaScript output. This provides a single-file solution but increases the JavaScript file size.
- fetch: WASM file is emitted as a separate asset and loaded via fetch at runtime. This keeps your JavaScript file smaller but requires an additional HTTP request.
- external: WASM loading is delegated to another plugin. Use this if you have a custom WASM loading strategy.

### Loading Method Behavior
- base64 and external methods use synchronous loading
- fetch method uses asynchronous loading (requires await initWasm())

## License
MIT License