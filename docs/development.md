---
layout: page
title: OopsTab Development Guide - Contributing & Building
description: Learn how to set up, build, and contribute to OopsTab, the browser extension that saves and restores window states and tabs.
permalink: /development/
image: /assets/images/oopstab-screenshot.jpg
keywords: browser extension development, Chrome extension, JavaScript, TypeScript, Webpack, Tailwind CSS, open source contribution
---

# OopsTab Development Guide

This guide covers how to set up the development environment for OopsTab, build the extension, and contribute to the project.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A Chromium-based browser (Chrome, Edge, Brave, etc.)

### How to Clone

```bash
# Clone the repository
git clone https://github.com/RockyHong/OopsTab.git

# Navigate to project directory
cd oopstab

# Install dependencies
npm install
```

## Building the Extension

### Development Build

```bash
# Run development build with hot reload
npm run dev
```

### Production Build

```bash
# Build for production
npm run build
```

After building, the extension will be in the `dist` directory. You can load this as an unpacked extension in Chrome by:

1. Opening `chrome://extensions`
2. Enabling "Developer mode" in the top-right corner
3. Clicking "Load unpacked" and selecting the `dist` directory

## Project Structure

The project is structured as a modern web application using:

- **TypeScript** for type-safe JavaScript
- **Webpack** for bundling and build pipeline
- **Tailwind CSS** for responsive styling
- **Chrome Extension APIs** for browser integration

### Key Directories

- `src/` - Main source code
  - `background/` - Background service worker
  - `components/` - React components
  - `utils/` - Utility functions and helpers
  - `types/` - TypeScript type definitions
- `public/` - Static assets
- `scripts/` - Build and helper scripts
- `docs/` - Documentation website (this site)

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Use TypeScript for all new code
- Follow the existing code style
- Add comments for complex logic
- Include tests for new features when possible

<div class="cta-section">
  <a href="https://github.com/rockyhong/OopsTab" class="cta-button">View on GitHub</a>
  <a href="{{ site.baseurl }}/features/" class="secondary-button">Explore Features</a>
</div>
