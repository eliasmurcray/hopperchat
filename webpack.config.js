const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

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
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css"
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/index.html",
      filename: "index.html",
      chunks: ["index"],
      scriptLoading: "module"
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/onboarding.html",
      filename: "onboarding.html",
      chunks: ["onboarding"],
      scriptLoading: "module"
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/login.html",
      filename: "login.html",
      chunks: ["login"],
      scriptLoading: "module"
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/chats.html",
      filename: "chats.html",
      chunks: ["chats"],
      scriptLoading: "module"
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/chat.html",
      filename: "chat.html",
      chunks: ["chat"],
      scriptLoading: "module",
      publicPath: "../"
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/verify-email.html",
      filename: "verify-email.html",
      chunks: ["verify-email"],
      scriptLoading: "module"
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