/** @type {import("prettier").Config} */
const config = {
  printWidth: 120,
  singleQuote: true,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  bracketSpacing: true,
  arrowParens: 'always',
  trailingComma: 'all',
  attributeGroups: [
    '$ANGULAR_STRUCTURAL_DIRECTIVE',
    '$ANGULAR_ELEMENT_REF',
    '$ANGULAR_ANIMATION',
    '$ANGULAR_ANIMATION_INPUT',
    '$ANGULAR_TWO_WAY_BINDING',
    '$ANGULAR_INPUT',
    '$ANGULAR_OUTPUT',
    '$ID',
    '$CLASS',
  ],

  plugins: ['prettier-plugin-packagejson', 'prettier-plugin-organize-attributes'],
};

module.exports = config;
