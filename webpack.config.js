const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const names = [
  "index",
  "onboarding",
  "login",
  "chats",
  "chat",
  "verify-email"
];
const entries = {};
names.forEach((name) => {
  entries[name] = "/src/tsx/" + name + ".tsx";
});

const plugins = [];

Object.keys(entries).forEach((entry) => {
  const plugin = new HtmlWebpackPlugin({
    template: "./src/html/" + entry + ".html",
    filename: entry + ".html",
    chunks: [entry],
    scriptLoading: "module",
    ...(entry === "chat" || entry === "user" ? { publicPath: "../" } : {})
  });
  plugins.push(plugin);
});

module.exports = {
  mode: "production",
  entry: {
    "index": "/src/tsx/index.tsx",
    "onboarding": "/src/tsx/onboarding.tsx",
    "login": "/src/tsx/login.tsx",
    "chats": "/src/tsx/chats.tsx",
    "chat": "/src/tsx/chat.tsx",
    "verify-email": "/src/tsx/verify-email.tsx"
  },
  experiments: {
    topLevelAwait: true
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader"
        ],
      },
      {
        test: /\.tsx$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ],
  },
  output: {
    publicPath: "./",
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash].js",
    clean: true
  },
  optimization: {
    minimizer: [
      new CssMinimizerPlugin(),
      new TerserPlugin()
    ]
  },
  resolve: {
    extensions: [".js", ".json", ".ts", ".tsx"],
  },
  plugins: [
    ...plugins,
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css"
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "./src/favicons",
          to: ""
        },
        {
          from: "./src/images",
          to: ""
        }
      ]
    })
  ]
};