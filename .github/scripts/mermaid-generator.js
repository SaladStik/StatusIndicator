class MermaidGenerator {
  constructor() {
    this.nodeCounter = 0;
    this.nodeMap = new Map();
  }

  generate(structure) {
    this.nodeCounter = 0;
    this.nodeMap.clear();

    const mermaidCode = ["graph TD"];

    // Generate root node
    const rootId = this.getNodeId(structure.path);
    mermaidCode.push(`    ${rootId}["${structure.name}/"]`);

    // Process children
    if (structure.children && structure.children.length > 0) {
      this.processChildren(structure, rootId, mermaidCode, 1);
    }

    return mermaidCode.join("\n");
  }

  processChildren(parent, parentId, output, depth) {
    if (!parent.children) return;

    // Separate directories and files
    const dirs = parent.children.filter((c) => c.type === "directory");
    const files = parent.children.filter((c) => c.type === "file");

    // Process directories first
    for (const dir of dirs) {
      const nodeId = this.getNodeId(dir.path);
      output.push(`    ${parentId} --> ${nodeId}["${dir.name}/"]`);

      if (dir.children && dir.children.length > 0) {
        this.processChildren(dir, nodeId, output, depth + 1);
      }
    }

    // Then process important files
    const importantFiles = this.filterImportantFiles(files);
    for (const file of importantFiles) {
      const nodeId = this.getNodeId(file.path);
      output.push(`    ${parentId} --> ${nodeId}["${file.name}"]`);
    }
  }

  filterImportantFiles(files) {
    const importantExtensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".json",
      ".yml",
      ".yaml",
      ".md",
      ".env.example",
      ".tf",
      ".sh",
    ];

    const importantNames = [
      "package.json",
      "tsconfig.json",
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      "README.md",
      ".gitignore",
      ".env.example",
      "turbo.json",
      "pnpm-workspace.yaml",
    ];

    return files.filter(
      (file) =>
        importantNames.includes(file.name) ||
        importantExtensions.some((ext) => file.name.endsWith(ext)),
    );
  }

  getNodeId(path) {
    if (!this.nodeMap.has(path)) {
      const id = `Node${this.nodeCounter++}`;
      this.nodeMap.set(path, id);
    }
    return this.nodeMap.get(path);
  }

  generateWithColors(structure, changedFiles = {}) {
    const base = this.generate(structure);
    const deleted = changedFiles.deleted || [];

    // Add ghost nodes for deleted files — show the full missing directory chain
    const ghostLines = [];
    const ghostNodeIds = [];
    if (deleted.length > 0) {
      const rootPath = structure.path;
      const relMap = this.buildRelativePathMap(structure, rootPath);
      // Track ghost dir nodes so we don't create duplicates when
      // multiple deleted files share the same missing parent dirs
      const ghostDirMap = new Map(); // relPath → ghostNodeId

      for (const fp of deleted) {
        const parts = fp.split("/");

        // Walk from the root of the path toward the leaf.
        // Find the deepest segment that exists in the real tree.
        let anchorIndex = -1; // index of the deepest existing segment
        for (let i = parts.length - 1; i >= 1; i--) {
          const candidate = parts.slice(0, i).join("/");
          if (relMap.has(candidate)) {
            anchorIndex = i;
            break;
          }
        }

        // The real anchor node (existing dir, or repo root)
        const anchorRel =
          anchorIndex > 0 ? parts.slice(0, anchorIndex).join("/") : null;
        const anchorAbs = anchorRel ? relMap.get(anchorRel) : rootPath;
        let prevNodeId = this.nodeMap.get(anchorAbs);
        if (!prevNodeId) continue;

        // Create ghost dir nodes for every missing intermediate directory
        const startIdx = anchorIndex > 0 ? anchorIndex : 0;
        for (let i = startIdx; i < parts.length - 1; i++) {
          const dirRel = parts.slice(0, i + 1).join("/");
          if (relMap.has(dirRel)) {
            // This dir exists in the real tree – just follow it
            prevNodeId = this.nodeMap.get(relMap.get(dirRel));
            continue;
          }
          if (ghostDirMap.has(dirRel)) {
            // Already created a ghost for this dir in a previous file
            prevNodeId = ghostDirMap.get(dirRel);
            continue;
          }
          const ghostDirId = `Node${this.nodeCounter++}`;
          ghostLines.push(
            `    ${prevNodeId} -.-> ${ghostDirId}["❌ ${parts[i]}/"]`,
          );
          ghostNodeIds.push(ghostDirId);
          ghostDirMap.set(dirRel, ghostDirId);
          prevNodeId = ghostDirId;
        }

        // Create the ghost file node at the end of the chain
        const fileName = parts[parts.length - 1];
        const ghostFileId = `Node${this.nodeCounter++}`;
        ghostLines.push(
          `    ${prevNodeId} -.-> ${ghostFileId}["❌ ${fileName}"]`,
        );
        ghostNodeIds.push(ghostFileId);
      }
    }

    const graph =
      ghostLines.length > 0 ? base + "\n" + ghostLines.join("\n") : base;

    // Global default class: neon violet text on every node
    const defaultClass = "    classDef default color:#7B00FF,font-weight:bold";

    const styles = this.generateStyles(structure, changedFiles, ghostNodeIds);
    return graph + "\n\n" + defaultClass + "\n" + styles;
  }

  /**
   * Build a set of all relative paths that are parents of changed files.
   * e.g. "API/app/config.py" → ["API", "API/app"]
   */
  getAffectedDirs(filePaths) {
    const dirs = new Set();
    for (const fp of filePaths) {
      const parts = fp.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join("/"));
      }
    }
    return dirs;
  }

  /**
   * Build a map from relative path → absolute path for every node we emitted.
   */
  buildRelativePathMap(structure, rootPath) {
    const map = new Map();
    const walk = (node) => {
      // Compute the relative path from the repo root
      const rel = node.path
        .replace(rootPath, "")
        .replace(/\\/g, "/")
        .replace(/^\//, "");
      if (rel) map.set(rel, node.path);
      if (node.children) node.children.forEach(walk);
    };
    walk(structure);
    return map;
  }

  generateStyles(structure, changedFiles = {}, ghostNodeIds = []) {
    const styles = [];
    const rootPath = structure.path;

    // Static colour map for well-known top-level dirs
    const colorMap = {
      apps: "#fff4e1",
      services: "#e8f5e9",
      packages: "#f3e5f5",
      infrastructure: "#e0f2f1",
      docs: "#fce4ec",
      scripts: "#e1f5fe",
      tests: "#fff3e0",
    };

    // Root node style
    const rootId = this.getNodeId(structure.path);
    styles.push(`    style ${rootId} fill:#e1f5ff`);

    // Static top-level directory colours
    if (structure.children) {
      for (const child of structure.children) {
        if (child.type === "directory" && colorMap[child.name]) {
          const nodeId = this.getNodeId(child.path);
          styles.push(`    style ${nodeId} fill:${colorMap[child.name]}`);
        }
      }
    }

    // --- Git diff change colours ---
    const added = changedFiles.added || [];
    const modified = changedFiles.modified || [];
    const deleted = changedFiles.deleted || [];

    if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
      return styles.join("\n");
    }

    // Map relative paths to absolute paths so we can look up node IDs
    const relMap = this.buildRelativePathMap(structure, rootPath);

    // Directories that contain changes get a lighter tinted border
    const addedDirs = this.getAffectedDirs(added);
    const modifiedDirs = this.getAffectedDirs(modified);
    const deletedDirs = this.getAffectedDirs(deleted);

    // Helper to style a relative path
    const styleRel = (rel, fill, stroke) => {
      const abs = relMap.get(rel);
      if (!abs) return;
      const nodeId = this.nodeMap.get(abs);
      if (!nodeId) return;
      styles.push(
        `    style ${nodeId} fill:${fill},stroke:${stroke},stroke-width:2px`,
      );
    };

    // Colour changed files  (green = new, yellow = modified, red = deleted)
    for (const fp of added) styleRel(fp, "#d4edda", "#28a745");
    for (const fp of modified) styleRel(fp, "#fff3cd", "#ffc107");

    // Style ghost nodes for deleted files (red with dashed connection, neon text)
    for (const ghostId of ghostNodeIds) {
      styles.push(
        `    style ${ghostId} fill:#f8d7da,stroke:#dc3545,stroke-width:2px,stroke-dasharray:5,color:#7B00FF`,
      );
    }

    // Colour parent directories of changes (lighter tints)
    for (const dir of addedDirs) styleRel(dir, "#e6ffec", "#28a745");
    for (const dir of modifiedDirs) styleRel(dir, "#fff9e6", "#ffc107");
    for (const dir of deletedDirs) styleRel(dir, "#ffeef0", "#dc3545");

    return styles.join("\n");
  }

  // Calculate a hash for the structure to detect changes
  calculateHash(structure) {
    const str = JSON.stringify(structure);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

module.exports = { MermaidGenerator };
