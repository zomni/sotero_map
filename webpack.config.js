const path = require("path");

module.exports = {
    mode: "production",
  entry: ['./src/index.js'],
//   {script: "./src/main.js",
// style: "./src/index.css"},
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, "dist/"),
  },
  experiments: {
    topLevelAwait: true
    
  },
  module: {
    rules: [
      // {
      //   test: /\.css$/i,
      //   use: ["style-loader", "css-loader"],
      // }
    ],
  },
};