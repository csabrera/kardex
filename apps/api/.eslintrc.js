/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@kardex/eslint-config/nest'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'prisma/seed.ts'],
};
