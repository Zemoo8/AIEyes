const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Ignore heavy/generated native build trees to avoid Windows watcher ENOENT issues.
config.resolver.blockList = [
	/android\/app\/build\/.*/,
	/android\/build\/.*/,
	/android\/\.cxx\/.*/,
	/node_modules\/\.expo-modules-core-.*\/.*/,
];

module.exports = config;
