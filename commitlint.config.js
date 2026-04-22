/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nueva feature
        'fix',      // Bug fix
        'docs',     // Documentación
        'chore',    // Mantenimiento, deps, config
        'refactor', // Refactor sin cambios funcionales
        'test',     // Tests
        'perf',     // Mejoras de performance
        'style',    // Cambios de formato (no afectan código)
        'build',    // Cambios de build system
        'ci',       // Cambios en CI/CD
        'revert',   // Revertir commit anterior
      ],
    ],
    'subject-case': [0],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
};
