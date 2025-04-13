#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if version level argument is provided
if (process.argv.length < 3) {
  console.error('Usage: node version-update.js <level>');
  console.error('  level: 0 = tag only (no version change)');
  console.error('  level: 1 = patch, 2 = minor, 3 = major');
  process.exit(1);
}

// Get the version level from command line arguments
const level = parseInt(process.argv[2]);
if (![0, 1, 2, 3].includes(level)) {
  console.error('Level must be 0 (tag only), 1 (patch), 2 (minor), or 3 (major)');
  process.exit(1);
}

// Read manifest.json
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
const packagePath = path.join(__dirname, '..', 'package.json');

console.log('Reading manifest and package files...');
let manifest, packageJson;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
} catch (error) {
  console.error(`Error reading files: ${error.message}`);
  process.exit(1);
}

// Get current version
const currentVersion = manifest.version;
console.log(`Current version: ${currentVersion}`);

// Parse version components
const versionParts = currentVersion.split('.').map(Number);
if (versionParts.length !== 3) {
  console.error('Version format must be x.y.z');
  process.exit(1);
}

let [major, minor, patch] = versionParts;
let newVersion = currentVersion;

// Update version based on level (skip if level is 0)
if (level > 0) {
  switch (level) {
    case 1: // Patch
      patch += 1;
      console.log(`Updating patch version: ${patch}`);
      break;
    case 2: // Minor
      minor += 1;
      patch = 0;
      console.log(`Updating minor version: ${minor}.0`);
      break;
    case 3: // Major
      major += 1;
      minor = 0;
      patch = 0;
      console.log(`Updating major version: ${major}.0.0`);
      break;
  }

  // Create new version string
  newVersion = `${major}.${minor}.${patch}`;
  console.log(`New version: ${newVersion}`);

  // Update manifest.json
  console.log('Updating manifest.json...');
  manifest.version = newVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Update package.json
  console.log('Updating package.json...');
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('Files updated successfully');
}

// Git operations
try {
  // Check if there are uncommitted changes and we're not in tag-only mode
  if (level > 0) {
    console.log('Checking git status...');
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      console.log('Committing changes...');
      execSync('git add public/manifest.json package.json');
      execSync(`git commit -m "Bump version to ${newVersion}"`);
      console.log('Changes committed');
    } else {
      console.log('No changes to commit');
    }
  }

  // For level 0, use the current version for the tag
  const tagVersion = level === 0 ? currentVersion : newVersion;

  // Create and push tag
  console.log(`Creating tag v${tagVersion}...`);
  execSync(`git tag -a v${tagVersion} -m "Version ${tagVersion}"`);
  console.log(`Tag v${tagVersion} created successfully`);
  console.log('You can push the tag with: git push origin --tags');

} catch (error) {
  console.error(`Git operation failed: ${error.message}`);
  process.exit(1);
} 