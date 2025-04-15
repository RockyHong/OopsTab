#!/bin/bash

# Navigate to the docs directory
cd docs

# Create a backup of _config.yml if it doesn't exist
if [ ! -f _config.yml.bak ]; then
  echo "Creating backup of _config.yml..."
  cp _config.yml _config.yml.bak
fi

# Temporarily update baseurl for local testing
echo "Temporarily setting baseurl to empty for local testing..."
sed -i '' 's/baseurl: "\/OopsTab"/baseurl: ""/g' _config.yml

# Install Jekyll dependencies if needed
if [ ! -f Gemfile.lock ]; then
  echo "Installing Jekyll dependencies..."
  bundle install
fi

# Run Jekyll server
echo "Starting Jekyll server..."
bundle exec jekyll serve

# When done, restore the original config (trap SIGINT)
function cleanup {
  echo "Restoring original configuration..."
  cp _config.yml.bak _config.yml
  echo "Configuration restored for GitHub Pages deployment."
  exit 0
}

# Setup trap to catch Ctrl+C
trap cleanup SIGINT

# Wait for user to press Ctrl+C
wait 