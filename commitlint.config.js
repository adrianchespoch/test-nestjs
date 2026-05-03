/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'body-max-line-length': [1, 'always', 100],
  },
};
