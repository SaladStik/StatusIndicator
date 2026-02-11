const fs = require("fs");
const path = require("path");

class DirectoryParser {
  constructor() {
    this.ignorePatterns = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
      ".DS_Store",
      ".turbo",
      ".cache",
      "out",
      "tmp",
      "temp",
    ];
  }

  parse(rootPath, maxDepth = 20) {
    return this.parseDirectory(rootPath, 0, maxDepth);
  }

  parseDirectory(dirPath, currentDepth, maxDepth) {
    const name = path.basename(dirPath) || path.basename(process.cwd());
    const node = {
      name,
      path: dirPath,
      type: "directory",
      children: [],
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    try {
      const items = fs.readdirSync(dirPath);

      // Sort: directories first, then files
      items.sort((a, b) => {
        const aPath = path.join(dirPath, a);
        const bPath = path.join(dirPath, b);
        const aIsDir = fs.statSync(aPath).isDirectory();
        const bIsDir = fs.statSync(bPath).isDirectory();

        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      for (const item of items) {
        if (this.shouldIgnore(item)) continue;

        const itemPath = path.join(dirPath, item);

        try {
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            node.children.push(
              this.parseDirectory(itemPath, currentDepth + 1, maxDepth),
            );
          } else {
            node.children.push({
              name: item,
              path: itemPath,
              type: "file",
            });
          }
        } catch (err) {
          // Skip files we can't read
          console.warn(`Skipping ${itemPath}: ${err.message}`);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error.message);
    }

    return node;
  }

  shouldIgnore(name) {
    // Allow .github through so it appears in the diagram
    if (name === ".github") return false;
    return (
      this.ignorePatterns.some(
        (pattern) => name.includes(pattern) || name === pattern,
      ) || name.startsWith(".")
    );
  }
}

module.exports = { DirectoryParser };
