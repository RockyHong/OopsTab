#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Regular expression to match only console.log statements
// The key difference is we'll capture the ending semicolon separately to preserve syntax
const CONSOLE_PATTERNS = [
  // Only matches console.log with balanced parentheses, properly handling nested parentheses
  /console\.log\s*\((?:[^)(]|\((?:[^)(]|\([^)(]*\))*\))*\)(;?)/g
];

// File extensions to process
const VALID_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Count statistics
let totalFilesProcessed = 0;
let totalConsoleLogsRemoved = 0;
let totalFilesModified = 0;

// Process a single file
function processFile(filePath) {
  // Check if file has valid extension
  const ext = path.extname(filePath);
  if (!VALID_EXTENSIONS.includes(ext)) {
    return;
  }

  // Read file content
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Error reading file ${filePath}: ${err.message}`);
    return;
  }

  let modified = false;
  let consoleLogsRemoved = 0;
  let newContent = content;

  // Apply the pattern, preserving semicolons
  for (const pattern of CONSOLE_PATTERNS) {
    const matches = newContent.match(pattern) || [];
    consoleLogsRemoved += matches.length;
    
    if (matches.length > 0) {
      modified = true;
      // Replace console statements with their semicolon if they had one, or empty string
      newContent = newContent.replace(pattern, (match, semicolon) => {
        return semicolon || '';  // Return just the semicolon if it exists, otherwise empty string
      });
    }
  }

  // Additional pass to clean up empty lines
  newContent = newContent
    // Remove lines that only have whitespace and a semicolon
    .replace(/^\s*;\s*$/gm, '')
    // Remove lines that are completely empty (just whitespace)
    .replace(/^\s*$/gm, '')
    // Remove multiple consecutive empty lines and replace with a single empty line
    .replace(/\n{3,}/g, '\n\n');

  // Write back the file if modified
  if (modified) {
    try {
      fs.writeFileSync(filePath, newContent, 'utf8');
      totalFilesModified++;
      totalConsoleLogsRemoved += consoleLogsRemoved;
      console.log(`Cleaned ${consoleLogsRemoved} console statements from ${filePath}`);
    } catch (err) {
      console.error(`Error writing file ${filePath}: ${err.message}`);
    }
  }

  totalFilesProcessed++;
}

// Process a directory recursively
function processDirectory(dirPath) {
  // Read directory contents
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.error(`Error reading directory ${dirPath}: ${err.message}`);
    return;
  }

  // Process each file/directory
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    
    // Skip node_modules and .git directories
    if (file === 'node_modules' || file === '.git' || file === 'dist') {
      continue;
    }
    
    try {
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        processDirectory(fullPath);
      } else if (stats.isFile()) {
        processFile(fullPath);
      }
    } catch (err) {
      console.error(`Error processing ${fullPath}: ${err.message}`);
    }
  }
}

// Add a dry run option
function processFileWithDryRun(filePath, dryRun) {
  // Check if file has valid extension
  const ext = path.extname(filePath);
  if (!VALID_EXTENSIONS.includes(ext)) {
    return;
  }

  // Read file content
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Error reading file ${filePath}: ${err.message}`);
    return;
  }

  let consoleLogsRemoved = 0;
  let newContent = content;

  // Apply the pattern, preserving semicolons
  for (const pattern of CONSOLE_PATTERNS) {
    const matches = newContent.match(pattern) || [];
    consoleLogsRemoved += matches.length;
    
    if (matches.length > 0 && !dryRun) {
      // Replace console statements with their semicolon if they had one, or empty string
      newContent = newContent.replace(pattern, (match, semicolon) => {
        return semicolon || '';  // Return just the semicolon if it exists, otherwise empty string
      });
    }
  }

  if (!dryRun) {
    // Additional pass to clean up empty lines
    newContent = newContent
      // Remove lines that only have whitespace and a semicolon
      .replace(/^\s*;\s*$/gm, '')
      // Remove lines that are completely empty (just whitespace)
      .replace(/^\s*$/gm, '')
      // Remove multiple consecutive empty lines and replace with a single empty line
      .replace(/\n{3,}/g, '\n\n');
  }

  // Write back the file if modified and not in dry run mode
  if (consoleLogsRemoved > 0) {
    if (dryRun) {
      console.log(`[DRY RUN] Would clean ${consoleLogsRemoved} console statements from ${filePath}`);
    } else {
      try {
        fs.writeFileSync(filePath, newContent, 'utf8');
        totalFilesModified++;
        totalConsoleLogsRemoved += consoleLogsRemoved;
        console.log(`Cleaned ${consoleLogsRemoved} console statements from ${filePath}`);
      } catch (err) {
        console.error(`Error writing file ${filePath}: ${err.message}`);
      }
    }
  }

  totalFilesProcessed++;
}

// Process a directory recursively with dry run option
function processDirectoryWithDryRun(dirPath, dryRun) {
  // Read directory contents
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.error(`Error reading directory ${dirPath}: ${err.message}`);
    return;
  }

  // Process each file/directory
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    
    // Skip node_modules and .git directories
    if (file === 'node_modules' || file === '.git' || file === 'dist') {
      continue;
    }
    
    try {
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        processDirectoryWithDryRun(fullPath, dryRun);
      } else if (stats.isFile()) {
        processFileWithDryRun(fullPath, dryRun);
      }
    } catch (err) {
      console.error(`Error processing ${fullPath}: ${err.message}`);
    }
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node clean-console-logs.js <path> [--dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run     Show what would be removed without changing files');
    console.log('');
    console.log('Examples:');
    console.log('  node clean-console-logs.js src/components/Button.tsx   # Clean a single file');
    console.log('  node clean-console-logs.js src/components              # Clean all files in a directory');
    console.log('  node clean-console-logs.js src --dry-run               # Show what would be removed without changes');
    return;
  }

  const targetPath = args[0];
  const dryRun = args.includes('--dry-run');
  
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path '${targetPath}' does not exist`);
    return;
  }
  
  console.log(`Processing: ${targetPath}${dryRun ? ' (DRY RUN)' : ''}`);
  
  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    processDirectoryWithDryRun(targetPath, dryRun);
  } else if (stats.isFile()) {
    processFileWithDryRun(targetPath, dryRun);
  }
  
  console.log('\nSummary:');
  console.log(`- Files processed: ${totalFilesProcessed}`);
  if (dryRun) {
    console.log(`- Files that would be modified: ${totalFilesModified}`);
    console.log(`- Console statements that would be removed: ${totalConsoleLogsRemoved}`);
  } else {
    console.log(`- Files modified: ${totalFilesModified}`);
    console.log(`- Console statements removed: ${totalConsoleLogsRemoved}`);
  }
}

main(); 