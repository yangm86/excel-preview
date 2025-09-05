import { defineConfig } from '@rslib/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2015',
      // bundle: false
      dts: {
        bundle: {
          // 将 react 的类型剔除
          bundledPackages: [],
        },
      },
      autoExternal: {
        dependencies: true,
        optionalDependencies: true,
        peerDependencies: true,
        devDependencies: true,
      },
    },
  ],
  output: {
    target: 'web',
    // overrideBrowserslist: []
  },
  source: {
    entry: {
      // index: 'src/components/**',
      index: 'src/components/Excel/index.tsx',
    },
  },
  plugins: [pluginReact(/** options here */)],
});
