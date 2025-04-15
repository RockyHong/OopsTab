#!/bin/bash

# Navigate to the docs directory
cd docs

# Check if required files exist
echo "Checking required files for Jekyll site..."

# Required files
required_files=(
  "_config.yml"
  "index.md"
  "features.md"
  "development.md"
  "Gemfile"
  "assets/css/main.scss"
  "_sass/main.scss"
  "_layouts/default.html"
  "_layouts/home.html"
  "_layouts/page.html"
  "sitemap.xml"
  "robots.txt"
  "404.md"
)

missing_files=()

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    missing_files+=("$file")
  fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
  echo "✅ All required files are present."
else
  echo "❌ Missing files:"
  for file in "${missing_files[@]}"; do
    echo "  - $file"
  done
  exit 1
fi

# Check image files
image_files=(
  "assets/images/oopstab-screenshot.jpg"
  "assets/images/meme.gif"
  "assets/images/oopstab-icon.png"
  "assets/images/favicon-16x16.png"
  "assets/images/favicon-32x32.png"
  "assets/images/apple-touch-icon.png"
)

missing_images=()

for file in "${image_files[@]}"; do
  if [ ! -f "$file" ]; then
    missing_images+=("$file")
  fi
done

if [ ${#missing_images[@]} -eq 0 ]; then
  echo "✅ All image files are present."
else
  echo "❌ Missing images:"
  for file in "${missing_images[@]}"; do
    echo "  - $file"
  done
  echo "Note: Missing images may cause the site to display incorrectly."
fi

# Check for Git LFS issues
echo "Checking for Git LFS configuration..."
if command -v git lfs &> /dev/null; then
  cd ..
  lfs_images=$(git lfs ls-files | grep -i "docs/assets/images" | wc -l)
  if [ "$lfs_images" -gt 0 ]; then
    echo "⚠️  Warning: Some images are tracked with Git LFS."
    echo "   This may cause image display issues on GitHub Pages."
    echo "   Possible solutions:"
    echo "   1. Make sure Git LFS is properly set up in your GitHub repo"
    echo "   2. Consider using GitHub's LFS image support for GitHub Pages"
    echo "   3. Or convert images to standard Git tracking with:"
    echo "      git lfs migrate export --include=\"docs/assets/images/**/*\" --everything"
  else
    echo "✅ No Git LFS issues detected with images."
  fi
  cd docs
else
  echo "⚠️  Git LFS not found. If you're using LFS for images, install it first."
fi

# Try Jekyll build to check for errors
echo "Attempting Jekyll build to check for errors..."
bundle exec jekyll build --safe --baseurl="/OopsTab" --destination=./_site_test

if [ $? -eq 0 ]; then
  echo "✅ Jekyll build successful!"
  # Clean up test build
  rm -rf _site_test
else
  echo "❌ Jekyll build failed. Please check the error messages above."
  exit 1
fi

echo "✨ All checks passed. Your Jekyll site is ready for GitHub Pages deployment!"
echo "To deploy, simply push your changes to the main branch."
echo "To test locally, run ./test-site.sh" 