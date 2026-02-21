#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

function usage() {
  console.log(`
Usage: npm run release <version-type>

Version types:
  patch   - Bug fixes (1.0.0 -> 1.0.1)
  minor   - New features (1.0.0 -> 1.1.0)  
  major   - Breaking changes (1.0.0 -> 2.0.0)
  x.y.z   - Specific version number

Examples:
  npm run release patch
  npm run release minor
  npm run release 1.0.0
`);
  process.exit(1);
}

function main() {
  const versionArg = process.argv[2];
  
  if (!versionArg) {
    usage();
  }

  console.log('🚀 Starting release process...');

  // Ensure we're on main branch and clean
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    if (branch !== 'main') {
      console.error('❌ Must be on main branch for release');
      process.exit(1);
    }

    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status) {
      console.error('❌ Working directory must be clean for release');
      console.error('Uncommitted changes:');
      console.error(status);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Git check failed:', error.message);
    process.exit(1);
  }

  // Update version in package.json
  console.log('📝 Updating package.json version...');
  let newVersion;
  try {
    if (versionArg.match(/^\d+\.\d+\.\d+$/)) {
      // Specific version provided
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      if (packageJson.version === versionArg) {
        console.log(`✅ Version already at ${versionArg}, regenerating build info...`);
        newVersion = versionArg;
      } else {
        execSync(`npm version ${versionArg} --no-git-tag-version`, { stdio: 'inherit' });
        newVersion = versionArg;
      }
    } else {
      // Semantic version bump
      const output = execSync(`npm version ${versionArg} --no-git-tag-version`, { encoding: 'utf8' });
      newVersion = output.trim().replace('v', '');
    }
  } catch (error) {
    console.error('❌ Version update failed:', error.message);
    process.exit(1);
  }
  console.log(`✅ Version updated to ${newVersion}`);

  // Regenerate build info with current commit (before the release commit)
  console.log('🔨 Regenerating build info...');
  try {
    execSync('node scripts/generate-build-info.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build info generation failed:', error.message);
    process.exit(1);
  }

  // Build the project
  console.log('🏗️  Building project...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }

  // Run tests
  console.log('🧪 Running tests...');
  try {
    execSync('npm test', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }

  // Update CHANGELOG.md (only if version entry doesn't exist)
  console.log('📋 Checking CHANGELOG.md...');
  const today = new Date().toISOString().split('T')[0];
  
  if (existsSync('CHANGELOG.md')) {
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const versionPattern = new RegExp(`^## \\[${newVersion.replace(/\./g, '\\.')}\\]`, 'm');
    
    if (versionPattern.test(changelog)) {
      console.log(`✅ CHANGELOG.md already has entry for ${newVersion}`);
    } else {
      // Add new version entry after the header
      const updatedChangelog = changelog.replace(
        /^(# Changelog\n+)/,
        `$1## [${newVersion}] - ${today}\n\n`
      );
      writeFileSync('CHANGELOG.md', updatedChangelog);
      console.log(`✅ Added ${newVersion} entry to CHANGELOG.md`);
    }
  } else {
    // Create new changelog
    writeFileSync('CHANGELOG.md', `# Changelog\n\n## [${newVersion}] - ${today}\n\n`);
    console.log('✅ Created CHANGELOG.md');
  }

  // Commit the release
  console.log('📦 Creating release commit...');
  try {
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "🔖 release v${newVersion}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Release commit failed:', error.message);
    process.exit(1);
  }

  // Create git tag
  console.log('🏷️  Creating git tag...');
  try {
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Git tag creation failed:', error.message);
    process.exit(1);
  }

  console.log(`
🎉 Release v${newVersion} created successfully!

Next steps:
  git push origin main --tags    # Push to remote
  npm publish                    # Publish to npm (if ready)

The release commit and tag are ready locally.
`);
}

main();
