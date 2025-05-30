# OopsTab

A tiny browser extension that automatically snapshots windows and tabs—preserving entire workflow states. Captures those perfect setups: coding sessions with Stack Overflow army, research rabbit holes, your awesome business dashboards, that collection of manga chapters, or those eye candy tabs saved for design inspiration. All that structure stays intact for whenever it's needed again.

<img src="./ReadmeImages/oopstab-screenshot.jpg" width="500">

## Why OopsTab?

<img src="./ReadmeImages/meme.gif">

Browsers are powerful with their solid recovery features, but those rescue sessions often dissolve into scattered page history if we don't catch them in time. We've all been there—our carefully arranged tabs just vanish like they never existed.

It's that sneaky problem that trips us up when we least expect it, like that table leg we always stub our toe on. OopsTab is here to keeps those tabs from fading into oblivion. Not just saving pages, but preserving the entire vibe of what we were building, learning, or procrastinating on—ready to jump back in whenever the mood strikes.

## Installation

### From Chrome Web Store: 
- <url>https://chromewebstore.google.com/detail/oopstab-%E2%80%93-never-lose-your/jccoagekghdeacpkpaedlnhkjfldgngn</url>

### From GitHub Release

1. Go to the [Releases](https://github.com/rockyhong/oopstab/releases) page
2. Download the latest version (usually a .zip file with file name `OopsTab.Never.Lose.Your.Tabs.Again-x.y.z.zip
`)
3. Unzip the downloaded file
4. In Chrome, navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top-right corner
6. Click "Load unpacked" and select the unzipped folder
7. OopsTab is now installed and ready to use!

## Documentation

Visit our [documentation site](https://rockyhong.github.io/OopsTab/) for more detailed information about features and usage.

For local development of the documentation site, see the [docs/README.md](docs/README.md) file.

## Development

### How to Clone

```bash
# Clone the repository
git clone https://github.com/RockyHong/OopsTab.git

# Navigate to project directory
cd oopstab

# Install dependencies
npm install
```

### How to Build

```bash
# Run development
npm run dev

# Build for production
npm run build
```

After building, the extension will be in the `dist` directory. You can load this as an unpacked extension in Chrome by:

1. Opening `chrome://extensions`
2. Enabling "Developer mode"
3. Clicking "Load unpacked" and selecting the `dist` directory

## License

[MIT License](LICENSE)
