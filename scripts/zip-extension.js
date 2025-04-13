const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Ensure the builds directory exists
const buildsDir = path.join(__dirname, '..', 'builds');
if (!fs.existsSync(buildsDir)) {
  fs.mkdirSync(buildsDir, { recursive: true });
  console.log(`Created builds directory: ${buildsDir}`);
} else {
  console.log(`Using existing builds directory: ${buildsDir}`);
}

// Read manifest.json to get name and version
const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
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
const distDir = path.join(__dirname, '..', 'dist');
console.log(`Adding contents from: ${distDir}`);
archive.directory(distDir, false);

// Finalize the archive
console.log('Finalizing archive...');
archive.finalize(); 