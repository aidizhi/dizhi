import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'lib/svg-utils.js',
  output: [
    { file: 'dist/svg-utils.cjs.js', format: 'cjs' },
    { file: 'dist/svg-utils.esm.js', format: 'esm' },
    { file: 'dist/svg-utils.umd.js', format: 'umd', name: 'SVGUtils' }
  ],
  plugins: [resolve()]
};
