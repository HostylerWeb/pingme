const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Native build output under node_modules burns through inotify watchers on Linux.
const nativeArtifactBlockList = [
  /[\\/]\.cxx[\\/]/,
  /[\\/]android[\\/]\.gradle[\\/]/,
  /[\\/]android[\\/]app[\\/]build[\\/]/,
  /[\\/]android[\\/]build[\\/]/,
  /[\\/]ios[\\/]build[\\/]/,
  /[\\/]ios[\\/]Pods[\\/]/,
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...nativeArtifactBlockList,
];

module.exports = config;
