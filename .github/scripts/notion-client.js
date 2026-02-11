const { Client } = require("@notionhq/client");

class NotionStructureUpdater {
  constructor(apiKey) {
    this.notion = new Client({ auth: apiKey });
  }

  /**
   * Find the toggle block titled "keeping track of you 78234729374" on the page.
   */
  async findParentToggle(pageId) {
    const blocks = await this.notion.blocks.children.list({
      block_id: pageId,
    });
    return blocks.results.find(
      (block) =>
        block.type === "toggle" &&
        block.toggle?.rich_text?.some((rt) =>
          rt.plain_text
            ?.toLowerCase()
            .includes("keeping track of you 78234729374"),
        ),
    );
  }

  /**
   * Get all children of a block (handles pagination).
   */
  async getBlockChildren(blockId) {
    const children = [];
    let cursor;
    do {
      const response = await this.notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
      });
      children.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
    return children;
  }

  /**
   * Convert a block read from the API back into creation format (recursively).
   */
  async reconstructBlock(block) {
    const type = block.type;
    const data = block[type];
    if (!data) return null;

    const result = { object: "block", type };

    switch (type) {
      case "toggle":
        result.toggle = {
          rich_text: data.rich_text,
          color: data.color || "default",
          children: [],
        };
        if (block.has_children) {
          const children = await this.getBlockChildren(block.id);
          for (const child of children) {
            const converted = await this.reconstructBlock(child);
            if (converted) result.toggle.children.push(converted);
          }
        }
        break;
      case "callout":
        result.callout = {
          rich_text: data.rich_text,
          icon: data.icon,
          color: data.color || "default",
        };
        break;
      case "paragraph":
        result.paragraph = {
          rich_text: data.rich_text,
          color: data.color || "default",
        };
        break;
      case "code":
        result.code = {
          rich_text: data.rich_text,
          language: data.language || "plain text",
          caption: data.caption || [],
        };
        break;
      case "divider":
        result.divider = {};
        break;
      default:
        console.warn(`  ⚠️  Skipping unsupported block type: ${type}`);
        return null;
    }
    return result;
  }

  /**
   * Build the toggle block for a new commit entry.
   */
  buildCommitToggle(mermaidCode, versionEntry, structureHash) {
    const toggleChildren = [];

    // Version info callout (includes structure hash for change detection)
    toggleChildren.push({
      object: "block",
      type: "callout",
      callout: {
        rich_text: [
          {
            type: "text",
            text: {
              content:
                `Version: ${versionEntry.version}\n` +
                `Branch: ${versionEntry.branch}\n` +
                `${versionEntry.commitMessage?.substring(0, 100)}\n` +
                `Hash: ${structureHash}`,
            },
          },
        ],
        icon: {
          type: "external",
          external: { url: "https://cdn.simpleicons.org/git/F05032" },
        },
        color: "red_background",
      },
    });

    // Commit link
    if (versionEntry.commitUrl) {
      toggleChildren.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "View commit: " },
            },
            {
              type: "text",
              text: {
                content: versionEntry.commitSha.substring(0, 7),
                link: { url: versionEntry.commitUrl },
              },
              annotations: { code: true },
            },
          ],
        },
      });
    }

    // Structure diagram (split into 2000-char chunks for Notion API limit)
    const codeChunks = [];
    for (let i = 0; i < mermaidCode.length; i += 2000) {
      codeChunks.push({
        type: "text",
        text: { content: mermaidCode.substring(i, i + 2000) },
      });
    }
    toggleChildren.push({
      object: "block",
      type: "code",
      code: {
        rich_text: codeChunks,
        language: "mermaid",
      },
    });

    // Format the toggle title
    const shortSha = versionEntry.commitSha?.substring(0, 7) || "unknown";
    const dateStr = new Date(versionEntry.timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Denver",
      timeZoneName: "short",
    });
    const shortMsg =
      versionEntry.commitMessage?.substring(0, 120)?.trim() || "";
    const msgSuffix = versionEntry.commitMessage?.length > 120 ? "…" : "";
    const toggleTitle = `${shortSha} — ${versionEntry.author} — ${dateStr} — ${shortMsg}${msgSuffix}`;

    return {
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [
          {
            type: "text",
            text: { content: toggleTitle },
            annotations: { bold: true },
          },
        ],
        children: toggleChildren,
      },
    };
  }

  /**
   * Main entry point — finds the "keeping track of you 78234729374" toggle,
   * appends the new commit at the bottom (1 API call, scales forever).
   */
  async updateCodeStructure(pageId, mermaidCode, versionEntry, structureHash) {
    try {
      console.log(
        '📄 Searching for "keeping track of you 78234729374" toggle...',
      );
      const parentToggle = await this.findParentToggle(pageId);

      if (!parentToggle) {
        console.error(
          '❌ Could not find a toggle named "keeping track of you 78234729374" on the page.',
        );
        throw new Error(
          'Parent toggle "keeping track of you 78234729374" not found. ' +
            "Please create a toggle block with that title on your Notion page.",
        );
      }

      console.log(`✅ Found parent toggle: ${parentToggle.id}`);

      // Build the new commit toggle
      const newCommitBlock = this.buildCommitToggle(
        mermaidCode,
        versionEntry,
        structureHash,
      );

      // Append new commit to the parent toggle (goes to bottom)
      console.log("📤 Appending new commit entry...");
      await this.notion.blocks.children.append({
        block_id: parentToggle.id,
        children: [newCommitBlock],
      });

      console.log("✅ Successfully updated Notion page!");
    } catch (error) {
      console.error("❌ Error updating Notion page:", error);
      throw error;
    }
  }

  /**
   * Read the structure hash from the newest commit toggle's callout.
   */
  async getExistingVersionHash(pageId) {
    try {
      const parentToggle = await this.findParentToggle(pageId);
      if (!parentToggle) return null;

      // Get children of parent toggle (commit toggles, newest is first)
      const children = await this.getBlockChildren(parentToggle.id);

      for (const child of children) {
        if (child.type === "toggle" && child.has_children) {
          // Look inside the first commit toggle for its callout
          const innerBlocks = await this.getBlockChildren(child.id);
          for (const inner of innerBlocks) {
            if (inner.type === "callout") {
              const text = inner.callout?.rich_text?.[0]?.plain_text || "";
              const match = text.match(/Hash: ([a-z0-9-]+)/i);
              if (match) return match[1];
            }
          }
          break; // Only check the first (newest) commit toggle
        }
      }
    } catch (error) {
      console.warn("Could not get existing version hash:", error.message);
    }
    return null;
  }
}

module.exports = { NotionStructureUpdater };
