# OopsTab Documentation Site

This directory contains a Jekyll-based documentation site for the OopsTab browser extension. It's designed to be deployed to GitHub Pages.

## Local Development

To run this site locally:

1. Navigate to the docs directory:

   ```bash
   cd docs
   ```

2. Make sure you have Ruby installed (2.5.0 or higher)

3. Install Bundler if you don't have it:

   ```bash
   gem install bundler
   ```

4. Install dependencies:

   ```bash
   bundle install
   ```

5. Run the local server using the provided script:

   ```bash
   # From the root directory
   ./docs/test-site.sh
   ```

   This script will:

   - Create a backup of your \_config.yml
   - Temporarily set `baseurl` to empty for local testing
   - Start the Jekyll server
   - Restore the original config when you press Ctrl+C

6. View the site at [http://localhost:4000/](http://localhost:4000/)

## Structure

- `_config.yml` - Main configuration file
- `index.md` - Home page
- `features.md` - Features page
- `development.md` - Development guide
- `_layouts/` - Page layouts
  - `default.html` - Base layout
  - `home.html` - Home page layout
  - `page.html` - Regular page layout
- `assets/css/main.scss` - Main stylesheet
- `_sass/` - SASS partials

## Editing Content

- All pages are written in Markdown with YAML frontmatter
- The site uses the Minima theme with customizations
- Images should be placed in the `assets/images` directory

## Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the main branch, using the GitHub Actions workflow defined in `.github/workflows/jekyll-gh-pages.yml`.

The workflow:

1. Builds the Jekyll site from the `docs` directory
2. Deploys the built site to GitHub Pages
3. Makes it available at https://rockyhong.github.io/OopsTab/

No manual deployment steps are required - just push to the main branch!

## SEO Optimization

The site includes:

- Proper meta tags for search engines and social media
- Structured data for rich snippets
- Sitemap.xml for search engine indexing
- Robots.txt file for crawler guidance

## License

See the [LICENSE](../LICENSE) file for details.
