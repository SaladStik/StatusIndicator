class MermaidGenerator {
  constructor() {
    this.nodeCounter = 0;
    this.nodeMap = new Map();
  }

  generate(structure) {
    this.nodeCounter = 0;
    this.nodeMap.clear();

    const mermaidCode = ['graph TD'];
    
    // Generate root node
    const rootId = this.getNodeId(structure.path);
    mermaidCode.push(`    ${rootId}[${structure.name}/]`);
    
    // Process children
    if (structure.children && structure.children.length > 0) {
      this.processChildren(structure, rootId, mermaidCode, 1);
    }

    return mermaidCode.join('\n');
  }

  processChildren(parent, parentId, output, depth) {
    if (!parent.children) return;

    // Separate directories and files
    const dirs = parent.children.filter(c => c.type === 'directory');
    const files = parent.children.filter(c => c.type === 'file');

    // Process directories first
    for (const dir of dirs) {
      const nodeId = this.getNodeId(dir.path);
      output.push(`    ${parentId} --> ${nodeId}[${dir.name}/]`);
      
      if (dir.children && dir.children.length > 0) {
        this.processChildren(dir, nodeId, output, depth + 1);
      }
    }

    // Then process important files
    const importantFiles = this.filterImportantFiles(files);
    for (const file of importantFiles) {
      const nodeId = this.getNodeId(file.path);
      output.push(`    ${parentId} --> ${nodeId}[${file.name}]`);
    }
  }

  filterImportantFiles(files) {
    const importantExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.json', '.yml', '.yaml',
      '.md', '.env.example',
      '.tf', '.sh'
    ];
    
    const importantNames = [
      'package.json',
      'tsconfig.json',
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'README.md',
      '.gitignore',
      '.env.example',
      'turbo.json',
      'pnpm-workspace.yaml'
    ];

    return files.filter(file => 
      importantNames.includes(file.name) ||
      importantExtensions.some(ext => file.name.endsWith(ext))
    );
  }

  getNodeId(path) {
    if (!this.nodeMap.has(path)) {
      const id = `Node${this.nodeCounter++}`;
      this.nodeMap.set(path, id);
    }
    return this.nodeMap.get(path);
  }

  generateWithColors(structure) {
    const base = this.generate(structure);
    const styles = this.generateStyles(structure);
    return base + '\n\n' + styles;
  }

  generateStyles(structure) {
    const styles = [];
    const colorMap = {
      'apps': '#fff4e1',
      'services': '#e8f5e9',
      'packages': '#f3e5f5',
      'infrastructure': '#e0f2f1',
      'docs': '#fce4ec',
      'scripts': '#e1f5fe',
      'tests': '#fff3e0'
    };

    // Add root style
    const rootId = this.getNodeId(structure.path);
    styles.push(`    style ${rootId} fill:#e1f5ff`);

    // Add color styles for top-level directories
    if (structure.children) {
      for (const child of structure.children) {
        if (child.type === 'directory' && colorMap[child.name]) {
          const nodeId = this.getNodeId(child.path);
          styles.push(`    style ${nodeId} fill:${colorMap[child.name]}`);
        }
      }
    }

    return styles.join('\n');
  }

  // Calculate a hash for the structure to detect changes
  calculateHash(structure) {
    const str = JSON.stringify(structure);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

module.exports = { MermaidGenerator };
