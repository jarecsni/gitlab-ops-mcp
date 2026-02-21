#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

// Read package.json for metadata
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

// Get git commit hash (short)
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Warning: Could not get git commit hash');
}

// Get git branch
let gitBranch = 'unknown';
try {
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Warning: Could not get git branch');
}

// Generate build timestamp
const buildTimestamp = new Date().toISOString();

// Create build info object
const buildInfo = {
  version: packageJson.version,
  name: packageJson.name,
  description: packageJson.description,
  author: packageJson.author,
  license: packageJson.license,
  buildTimestamp,
  gitCommit,
  gitBranch,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch
};

// Get repository URL for the notice
const repoUrl = typeof packageJson.repository === 'string' 
  ? packageJson.repository 
  : packageJson.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || 'https://github.com/unknown/unknown';

// Format author for copyright
const authorName = typeof packageJson.author === 'string'
  ? packageJson.author
  : packageJson.author?.name 
    ? `${packageJson.author.name}${packageJson.author.email ? ` <${packageJson.author.email}>` : ''}`
    : 'Unknown Author';

// Write to TypeScript file
const tsContent = `// This file is auto-generated during build
// Do not edit manually - regenerated on each build

export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)} as const;

export const COPYRIGHT_NOTICE = \`${packageJson.name} v\${BUILD_INFO.version}
Copyright (c) ${new Date().getFullYear()} ${authorName}
Licensed under the ${packageJson.license || 'MIT'} License.

Built on \${BUILD_INFO.buildTimestamp} from commit \${BUILD_INFO.gitCommit} (\${BUILD_INFO.gitBranch})

For more information, visit: ${repoUrl}
\`;
`;

writeFileSync('src/build-info.ts', tsContent);
console.log('✅ Generated build info for commit:', gitCommit, 'on branch:', gitBranch);
