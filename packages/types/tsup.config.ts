import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/entities/index.ts',
    'src/enums/index.ts',
    'src/errors/index.ts',
    'src/dto/index.ts',
  ],
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
