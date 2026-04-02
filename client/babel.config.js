module.exports = function (api) {
  const isProduction = api.env('production');
  
  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './',
        },
      },
    ],
  ];
  
  // 生产环境移除 console.log，但保留 console.error 和 console.warn
  if (isProduction) {
    plugins.push([
      'transform-remove-console',
      {
        exclude: ['error', 'warn']
      }
    ]);
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
