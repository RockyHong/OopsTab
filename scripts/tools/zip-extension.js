#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

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

// Ensure the builds directory exists
const buildsDir = path.join(projectRoot, 'builds');
if (!fs.existsSync(buildsDir)) {
  fs.mkdirSync(buildsDir, { recursive: true });
  console.log(`Created builds directory: ${buildsDir}`);
} else {
  console.log(`Using existing builds directory: ${buildsDir}`);
}

// Read manifest.json to get name and version
const manifestPath = path.join(projectRoot, 'dist', 'manifest.json');
console.log(`Reading manifest from: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { name, version } = manifest;

// Create zip file name
const zipFileName = `${name}-${version}.zip`;
const zipFilePath = path.join(buildsDir, zipFileName);
console.log(`Creating zip archive: ${zipFileName}`);

// Create a file to stream archive data to
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  const fileSize = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✓ Archive created successfully: ${zipFilePath}`);
  console.log(`✓ Total size: ${fileSize} MB`);
  console.log(`✓ The zip file is ready for distribution!`);
});

// Handle archive warnings
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

// Handle archive errors
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add the dist directory contents to the archive
const distDir = path.join(projectRoot, 'dist');
console.log(`Adding contents from: ${distDir}`);
archive.directory(distDir, false);

// Finalize the archive
console.log('Finalizing archive...');
archive.finalize(); 