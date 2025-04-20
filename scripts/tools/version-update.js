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

// Find the project root by looking for package.json
function findProjectRoot(startDir) {
  let currentDir = startDir;
  
  // Limit to 10 levels up to prevent infinite loop
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // We've reached the root directory
      break;
    }
    
    currentDir = parentDir;
  }
  
  throw new Error('Could not find project root (no package.json found)');
}

// Get project root
const projectRoot = findProjectRoot(__dirname);
console.log(`Project root: ${projectRoot}`);

// Determine paths
const packagePath = path.join(projectRoot, 'package.json');
const manifestPath = path.join(projectRoot, 'public', 'manifest.json');

console.log('Reading manifest and package files...');
console.log(`- Package: ${packagePath}`);
console.log(`- Manifest: ${manifestPath}`);

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

  // Run build process after updating version
  console.log('\n📦 Building extension...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
    console.log('✅ Build successful!');
  } catch (error) {
    console.error('\n❌ Build failed! Reverting version changes...');
    
    // Revert manifest.json
    manifest.version = currentVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Revert package.json
    packageJson.version = currentVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    
    console.error('Version changes reverted. Please fix the build issues and try again.');
    process.exit(1);
  }
}

// Git operations
try {
  // For level 0, use the current version for the tag
  const tagVersion = level === 0 ? currentVersion : newVersion;
  
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

  // Create and push tag
  console.log(`Creating tag v${tagVersion}...`);
  execSync(`git tag -a v${tagVersion} -m "Version ${tagVersion}"`);
  console.log(`Tag v${tagVersion} created successfully`);
  console.log('You can push the tag with: git push origin --tags');

} catch (error) {
  console.error(`Git operation failed: ${error.message}`);
  process.exit(1);
} 