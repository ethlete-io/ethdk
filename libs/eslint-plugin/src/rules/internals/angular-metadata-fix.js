// @ts-check
'use strict';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 * @param {any} property
 */
const getMetadataEntryRemovalRange = (sourceCode, metadata, property) => {
  const entries = metadata.properties;
  const index = entries.indexOf(property);
  const openingBrace = sourceCode.getFirstToken(metadata);
  const closingBrace = sourceCode.getLastToken(metadata);

  if (!openingBrace || !closingBrace || index === -1) return property.range;
  if (entries.length === 1) return [openingBrace.range[1], closingBrace.range[0]];
  if (index < entries.length - 1) return [property.range[0], entries[index + 1].range[0]];

  return [entries[index - 1].range[1], property.range[1]];
};

module.exports = { getMetadataEntryRemovalRange };
