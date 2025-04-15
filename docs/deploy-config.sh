#!/bin/bash

# Change to docs directory
cd docs

# Create a copy of _config.yml
cp _config.yml _config.yml.bak

# Update baseurl for GitHub Pages
sed -i '' 's/baseurl: ""/baseurl: "\/OopsTab"/g' _config.yml

echo "Configuration updated for GitHub Pages deployment."
echo "The baseurl has been set to '/OopsTab'."
echo "A backup of the original configuration is saved as _config.yml.bak"

# To revert changes:
# cp _config.yml.bak _config.yml 