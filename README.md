# OopsTab - Chrome Extension Snapshot Manager

OopsTab is a Chrome extension that takes snapshots of your tab status and preserves tabs when the browser closes, whether intentionally or accidentally, ensuring they won't be buried in browser history.

## Features (Planned)

- Automatically snapshot tab states when browser closes
- Restore tab sessions with a single click
- Organize snapshots into collections
- Lightweight and clean UI built with modern tools

## Tech Stack

- **React**: Component-driven UI architecture
- **TypeScript**: Strong typing for better code quality
- **Tailwind CSS**: Utility-first styling
- **Webpack**: Bundling source files
- **Chrome Extension API**: Browser integration

## Development

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Git LFS (for binary assets)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/oopstab.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Build the extension
npm run build
```

After building, the extension will be in the `dist` directory. You can load this as an unpacked extension in Chrome by:

1. Opening chrome://extensions
2. Enabling "Developer mode"
3. Clicking "Load unpacked" and selecting the `dist` directory

## License

[MIT License](LICENSE)
