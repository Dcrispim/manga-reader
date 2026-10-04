const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Migrations are .sql files bundled as source (see babel.config.js).
config.resolver.sourceExts.push("sql");

module.exports = config;
