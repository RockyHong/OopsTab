const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Ensure the builds directory exists
const buildsDir = path.join(__dirname, '..', 'builds');
if (!fs.existsSync(buildsDir)) {
  fs.mkdirSync(buildsDir, { recursive: true });
}

// Read manifest.json to get name and version
const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { name, version } = manifest;

// Create zip file name
const zipFileName = `${name}-${version}.zip`;
const zipFilePath = path.join(buildsDir, zipFileName);

// Create a file to stream archive data to
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {

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
archive.directory(path.join(__dirname, '..', 'dist'), false);

// Finalize the archive
archive.finalize(); 