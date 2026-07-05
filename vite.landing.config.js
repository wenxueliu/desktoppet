const { defineConfig } = require("vite");

module.exports = defineConfig({
  base: "./",
  root: "landing",
  build: {
    outDir: "../dist/pages",
    emptyOutDir: true
  }
});
