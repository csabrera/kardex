import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/validators.ts', 'src/formatters.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
});
