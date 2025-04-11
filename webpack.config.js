const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');

// Check if icons directory exists and has files
const iconsExist = fs.existsSync(path.resolve(__dirname, 'public/icons')) && 
  fs.readdirSync(path.resolve(__dirname, 'public/icons')).length > 0;

const copyPatterns = [
  { 
    from: 'public/manifest.json', 
    to: 'manifest.json' 
  },
  {
    from: 'src/middleware-tab.html',
    to: 'middleware-tab.html'
  },
  {
    from: 'src/middleware-tab.js',
    to: 'middleware-tab.js'
  }
];

// Only add icons if they exist
if (iconsExist) {
  copyPatterns.push({ 
    from: 'public/icons', 
    to: 'icons' 
  });
}

module.exports = {
  entry: {
    oopstab: './src/pages/oopstab/index.tsx',
    options: './src/options/index.tsx',
    background: './src/background/index.ts',
    content: './src/content/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/pages/oopstab/index.html',
      filename: 'oopstab.html',
      chunks: ['oopstab'],
    }),
    new HtmlWebpackPlugin({
      template: './public/options.html',
      filename: 'options.html',
      chunks: ['options'],
    }),
    new CopyWebpackPlugin({
      patterns: copyPatterns,
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}; 