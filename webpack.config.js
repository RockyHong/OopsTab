const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const webpack = require('webpack');

// Check if icons directory exists and has files
const iconsExist = fs.existsSync(path.resolve(__dirname, 'public/icons')) && 
  fs.readdirSync(path.resolve(__dirname, 'public/icons')).length > 0;

// Check if assets directory exists
const assetsExist = fs.existsSync(path.resolve(__dirname, 'public/assets'));

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

// Only add assets if the directory exists
if (assetsExist) {
  copyPatterns.push({
    from: 'public/assets',
    to: 'assets'
  });
}

// Only add icons if they exist
if (iconsExist) {
  copyPatterns.push({ 
    from: 'public/icons', 
    to: 'icons' 
  });
}

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
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
      // Define process.env.NODE_ENV for conditional rendering of debug features
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      }),
    ],
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // Only include source maps in development mode
    devtool: isProduction ? false : 'source-map',
    // For production builds, enable tree shaking to remove unused code
    optimization: {
      usedExports: true,
    },
  };
}; 