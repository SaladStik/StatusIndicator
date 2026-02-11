class VersionHistoryManager {
  constructor() {
    this.maxVersions = 5;
  }

  createVersionEntry(mermaidCode, metadata) {
    return {
      version: this.generateVersionNumber(),
      timestamp: new Date().toISOString(),
      author: metadata.author || 'Unknown',
      branch: metadata.branch || 'main',
      commitSha: metadata.commitSha || '',
      commitMessage: metadata.commitMessage || '',
      commitUrl: metadata.commitUrl || '',
      mermaidCode: mermaidCode,
      hash: this.hashCode(mermaidCode)
    };
  }

  generateVersionNumber() {
    const date = new Date();
    return `v${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}.${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  hasChanged(previousHash, currentHash) {
    return previousHash !== currentHash;
  }

  async getVersionHistory(notionClient, pageId) {
    try {
      const blocks = await notionClient.blocks.children.list({
        block_id: pageId,
        page_size: 100
      });

      const versions = [];
      
      // Look for version history blocks
      for (const block of blocks.results) {
        if (block.type === 'toggle' && 
            block.toggle?.rich_text?.[0]?.plain_text?.includes('Version History')) {
          
          // Get children of the toggle
          const versionBlocks = await notionClient.blocks.children.list({
            block_id: block.id
          });

          // Parse version data
          for (const versionBlock of versionBlocks.results) {
            if (versionBlock.type === 'callout' &&
                versionBlock.callout?.rich_text?.[0]?.plain_text?.includes('Version:')) {
              
              const text = versionBlock.callout.rich_text[0].plain_text;
              const versionData = this.parseVersionText(text);
              versions.push(versionData);
            }
          }
        }
      }

      return versions;
    } catch (error) {
      console.warn('Could not retrieve version history:', error.message);
      return [];
    }
  }

  parseVersionText(text) {
    const lines = text.split('\n');
    const data = {};
    
    for (const line of lines) {
      if (line.includes('Version:')) {
        data.version = line.split('Version:')[1]?.trim();
      } else if (line.includes('Author:')) {
        data.author = line.split('Author:')[1]?.trim();
      } else if (line.includes('Branch:')) {
        data.branch = line.split('Branch:')[1]?.trim();
      } else if (line.includes('Commit:')) {
        data.commitSha = line.split('Commit:')[1]?.trim();
      } else if (line.includes('Hash:')) {
        data.hash = line.split('Hash:')[1]?.trim();
      }
    }
    
    return data;
  }

  pruneVersions(versions) {
    // Keep only the latest maxVersions
    return versions.slice(0, this.maxVersions);
  }
}

module.exports = { VersionHistoryManager };
