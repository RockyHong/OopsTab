# OopsTab Jekyll Site

This is the Jekyll-based website for the OopsTab browser extension. It's designed to be deployed to GitHub Pages.

## Local Development

To run this site locally:

1. Make sure you have Ruby installed (2.5.0 or higher)
2. Install Bundler if you don't have it:
   ```bash
   gem install bundler
   ```
3. Install dependencies:
   ```bash
   bundle install
   ```
4. Run the local server:
   ```bash
   bundle exec jekyll serve
   ```
5. View the site at [http://localhost:4000/OopsTab/](http://localhost:4000/OopsTab/)

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

## Editing Content

- All pages are written in Markdown with YAML frontmatter
- The site uses the Minima theme with customizations
- Images should be placed in the `assets/images` directory

## Deployment

This site is automatically deployed to GitHub Pages when changes are pushed to the main branch, using the GitHub Actions workflow defined in `.github/workflows/jekyll-gh-pages.yml`.

## License

See the [LICENSE](LICENSE) file for details.
