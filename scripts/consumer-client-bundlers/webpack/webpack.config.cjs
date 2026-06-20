const path = require("path");

module.exports = {
  mode: "production",
  target: "node",
  entry: "./src/index.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  resolve: {
    extensions: [".js", ".cjs", ".mjs"],
  },
  experiments: {
    outputModule: true,
  },
};
