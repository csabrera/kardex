/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@kardex/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['.next/', 'node_modules/', 'out/', 'next.config.mjs'],
};
