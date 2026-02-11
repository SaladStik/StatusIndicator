const { Client } = require('@notionhq/client');

class NotionStructureUpdater {
  constructor(apiKey) {
    this.notion = new Client({ auth: apiKey });
  }

  async updateCodeStructure(pageId, mermaidCode, versionEntry, previousVersions = []) {
    try {
      console.log('📄 Fetching existing Notion page structure...');
      const blocks = await this.notion.blocks.children.list({
        block_id: pageId,
      });

      // Find the "Code Structure" section
      const structureHeading = blocks.results.find(
        (block) =>
          block.type === 'heading_2' &&
          block.heading_2?.rich_text?.[0]?.plain_text === 'Code Structure'
      );

      if (structureHeading) {
        console.log('✏️  Updating existing Code Structure section...');
        await this.updateExistingSection(structureHeading.id, mermaidCode, versionEntry, previousVersions);
      } else {
        console.log('✨ Creating new Code Structure section...');
        await this.createStructureSection(pageId, mermaidCode, versionEntry, previousVersions);
      }

      console.log('✅ Successfully updated Notion page!');
    } catch (error) {
      console.error('❌ Error updating Notion page:', error);
      throw error;
    }
  }

  async updateExistingSection(headingId, mermaidCode, versionEntry, previousVersions) {
    // Get all blocks after the heading
    const children = await this.notion.blocks.children.list({
      block_id: headingId,
    });

    // Delete old content (but not the next heading)
    for (const block of children.results) {
      if (block.type?.startsWith('heading')) break;
      
      try {
        await this.notion.blocks.delete({
          block_id: block.id,
        });
      } catch (err) {
        console.warn(`Could not delete block ${block.id}:`, err.message);
      }
    }

    // Add new content
    await this.appendStructureBlocks(headingId, mermaidCode, versionEntry, previousVersions);
  }

  async appendStructureBlocks(parentId, mermaidCode, versionEntry, previousVersions) {
    const blocks = [];

    // Current version info callout
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `🚀 Current Version: ${versionEntry.version}\n` +
                       `👤 Author: ${versionEntry.author}\n` +
                       `🌿 Branch: ${versionEntry.branch}\n` +
                       `⏰ Updated: ${new Date(versionEntry.timestamp).toLocaleString()}\n` +
                       `💬 Commit: ${versionEntry.commitMessage?.substring(0, 100)}`,
            },
          },
        ],
        icon: { emoji: '📊' },
        color: 'blue_background',
      },
    });

    // Commit link
    if (versionEntry.commitUrl) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: '🔗 View commit: ',
              },
            },
            {
              type: 'text',
              text: {
                content: versionEntry.commitSha.substring(0, 7),
                link: { url: versionEntry.commitUrl },
              },
              annotations: {
                code: true,
              },
            },
          ],
        },
      });
    }

    // Current structure diagram
    blocks.push({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: mermaidCode,
            },
          },
        ],
        language: 'mermaid',
      },
    });

    // Version history toggle
    if (previousVersions.length > 0) {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      });

      const toggleBlock = {
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `📚 Version History (${previousVersions.length} previous versions)`,
              },
              annotations: {
                bold: true,
              },
            },
          ],
          children: [],
        },
      };

      // Add version history items as children
      for (let i = 0; i < previousVersions.length && i < 5; i++) {
        const version = previousVersions[i];
        
        toggleBlock.toggle.children.push({
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `Version: ${version.version}\n` +
                           `Author: ${version.author}\n` +
                           `Branch: ${version.branch}\n` +
                           `Commit: ${version.commitSha?.substring(0, 7)}\n` +
                           `Hash: ${version.hash}`,
                },
              },
            ],
            icon: { emoji: '📦' },
            color: 'gray_background',
          },
        });
      }

      blocks.push(toggleBlock);
    }

    // Append all blocks in chunks (Notion has a limit per request)
    const chunkSize = 100;
    for (let i = 0; i < blocks.length; i += chunkSize) {
      const chunk = blocks.slice(i, i + chunkSize);
      await this.notion.blocks.children.append({
        block_id: parentId,
        children: chunk,
      });
    }
  }

  async createStructureSection(pageId, mermaidCode, versionEntry, previousVersions) {
    const blocks = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [
            {
              type: 'text',
              text: { content: '📁 Code Structure' },
            },
          ],
        },
      },
    ];

    await this.notion.blocks.children.append({
      block_id: pageId,
      children: blocks,
    });

    // Get the heading ID we just created
    const updatedBlocks = await this.notion.blocks.children.list({
      block_id: pageId,
    });

    const newHeading = updatedBlocks.results.find(
      (block) =>
        block.type === 'heading_2' &&
        block.heading_2?.rich_text?.[0]?.plain_text?.includes('Code Structure')
    );

    if (newHeading) {
      await this.appendStructureBlocks(newHeading.id, mermaidCode, versionEntry, previousVersions);
    }
  }

  async getExistingVersionHash(pageId) {
    try {
      const blocks = await this.notion.blocks.children.list({
        block_id: pageId,
      });

      for (const block of blocks.results) {
        if (block.type === 'callout' &&
            block.callout?.rich_text?.[0]?.plain_text?.includes('Current Version:')) {
          
          const text = block.callout.rich_text[0].plain_text;
          const match = text.match(/Hash: ([a-z0-9]+)/);
          if (match) {
            return match[1];
          }
        }
      }
    } catch (error) {
      console.warn('Could not get existing version hash:', error.message);
    }
    return null;
  }
}

module.exports = { NotionStructureUpdater };
