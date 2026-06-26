import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  bundle: true,
  // Bundler toutes les deps runtime : le module est chargé via CDN (jsDelivr)
  // et ne peut pas résoudre node_modules.
  noExternal: [/.*/],
  dts: true,
  clean: true,
  treeshake: true,
  target: "es2022",
});
