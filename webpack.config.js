const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  entry: isDev ? './src/dev.js' : './src/NiueForecast.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'NiueForecast.js',
    library: isDev ? undefined : 'NiueForecast',
    libraryTarget: isDev ? undefined : 'umd',
    globalObject: isDev ? undefined : 'this'
  },
  externals: isDev
    ? {}
    : {
        react: 'React',
        'react-dom': 'ReactDOM'
      },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      }
    ]
  },
  devtool: 'source-map',
  plugins: [
    isDev &&
      new HtmlWebpackPlugin({
        template: './public/index.html'
      }),
  ].filter(Boolean),
  devServer: {
    static: './dist',
    hot: true,
    open: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};