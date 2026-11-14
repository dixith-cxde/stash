const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
// The offline PDF viewer page (assets/pdf/viewer.html).
config.resolver.assetExts.push('html');

module.exports = config;
