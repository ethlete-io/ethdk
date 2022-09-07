module.exports = {
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

  plugins: [require('prettier-plugin-packagejson'), require('prettier-plugin-organize-attributes')],
};
