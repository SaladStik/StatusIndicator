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
   * Find an existing branch sub-toggle inside the parent toggle.
   * Returns the block ID if found, or null.
   */
  async findBranchToggle(parentToggleId, branchName) {
    const children = await this.getBlockChildren(parentToggleId);
    for (const child of children) {
      if (child.type === "toggle") {
        const text = child.toggle?.rich_text
          ?.map((rt) => rt.plain_text)
          .join("")
          .trim();
        if (text === `🔀 ${branchName}` || text === branchName) {
          return child.id;
        }
      }
    }
    return null;
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

    // Format the toggle title — first line of commit message only
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
    const fullMsg = (versionEntry.commitMessage || "").trim();
    const firstLine = fullMsg.split(/\r?\n/)[0]?.trim() || "";
    const shortMsg = firstLine.substring(0, 120);
    const isMultiLine = fullMsg.includes("\n");
    const msgSuffix =
      shortMsg.length < firstLine.length || isMultiLine ? "…" : "";
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
   * Build the grey callout containing a toggle with the full commit message.
   * This must be appended in a separate API call because Notion limits
   * nesting depth to 2 levels per append.
   */
  buildCommitMessageCallout(commitMessage) {
    return {
      object: "block",
      type: "callout",
      callout: {
        rich_text: [],
        icon: { type: "emoji", emoji: "💬" },
        color: "gray_background",
        children: [
          {
            object: "block",
            type: "toggle",
            toggle: {
              rich_text: [
                {
                  type: "text",
                  text: { content: "Click To View Commit Message" },
                  annotations: { bold: true },
                },
              ],
              children: [
                {
                  object: "block",
                  type: "paragraph",
                  paragraph: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: commitMessage },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    };
  }

  /**
   * Build the mermaid structure diagram code block.
   */
  buildMermaidCodeBlock(mermaidCode) {
    const codeChunks = [];
    for (let i = 0; i < mermaidCode.length; i += 2000) {
      codeChunks.push({
        type: "text",
        text: { content: mermaidCode.substring(i, i + 2000) },
      });
    }
    return {
      object: "block",
      type: "code",
      code: {
        rich_text: codeChunks,
        language: "mermaid",
      },
    };
  }

  /**
   * Main entry point — finds the "keeping track of you 78234729374" toggle,
   * then finds or creates a branch sub-toggle and appends the commit there.
   */
  async updateCodeStructure(
    pageId,
    mermaidCode,
    versionEntry,
    structureHash,
    commitCount = 0,
  ) {
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

      // Build the commit blocks array — add a divider every 15 commits
      const commitBlocks = [newCommitBlock];
      if (commitCount > 0 && commitCount % 15 === 0) {
        console.log(`   ➖ Adding divider (commit #${commitCount})`);
        commitBlocks.push({ object: "block", type: "divider", divider: {} });
      }

      // Find or create the branch sub-toggle
      const branchName = versionEntry.branch;
      console.log(`🔀 Looking for branch toggle: ${branchName}...`);
      const existingBranchId = await this.findBranchToggle(
        parentToggle.id,
        branchName,
      );

      let appendResult;
      if (existingBranchId) {
        // Branch toggle exists — append the commit inside it
        console.log(`✅ Found existing branch toggle: ${existingBranchId}`);
        console.log("📤 Appending commit to branch toggle...");
        appendResult = await this.notion.blocks.children.append({
          block_id: existingBranchId,
          children: commitBlocks,
        });
      } else {
        // Create a new branch toggle with the commit as its first child
        console.log(`🆕 Creating new branch toggle: ${branchName}`);
        appendResult = await this.notion.blocks.children.append({
          block_id: parentToggle.id,
          children: [
            {
              object: "block",
              type: "toggle",
              toggle: {
                rich_text: [
                  {
                    type: "text",
                    text: { content: `🔀 ${branchName}` },
                    annotations: { bold: true },
                  },
                ],
                color: "blue_background",
                children: commitBlocks,
              },
            },
          ],
        });
      }

      // Second API call: append commit message callout + mermaid diagram
      // inside the commit toggle. Separate call due to Notion's 2-level nesting limit.
      let commitToggleId;

      if (existingBranchId) {
        // We appended directly — the commit toggle is in the result
        const commitToggleBlock = appendResult.results?.find(
          (b) => b.type === "toggle",
        );
        commitToggleId = commitToggleBlock?.id;
      } else {
        // We created a new branch toggle — the commit toggle is nested inside it
        const branchToggleBlock = appendResult.results?.find(
          (b) => b.type === "toggle",
        );
        if (branchToggleBlock) {
          const branchChildren = await this.getBlockChildren(
            branchToggleBlock.id,
          );
          const commitToggleBlock = branchChildren.find(
            (b) => b.type === "toggle",
          );
          commitToggleId = commitToggleBlock?.id;
        }
      }

      if (commitToggleId) {
        const secondaryBlocks = [];
        if (versionEntry.commitMessage) {
          secondaryBlocks.push(
            this.buildCommitMessageCallout(versionEntry.commitMessage),
          );
        }
        secondaryBlocks.push(this.buildMermaidCodeBlock(mermaidCode));

        console.log("💬 Appending commit message & mermaid diagram...");
        await this.notion.blocks.children.append({
          block_id: commitToggleId,
          children: secondaryBlocks,
        });
      }

      console.log("✅ Successfully updated Notion page!");
    } catch (error) {
      console.error("❌ Error updating Notion page:", error);
      throw error;
    }
  }

  /**
   * Mark a branch toggle as deleted — change background to red and
   * update the title to show it's been deleted.
   */
  async markBranchDeleted(pageId, branchName) {
    try {
      console.log(
        '📄 Searching for "keeping track of you 78234729374" toggle...',
      );
      const parentToggle = await this.findParentToggle(pageId);
      if (!parentToggle) {
        console.error("❌ Parent toggle not found.");
        return;
      }

      console.log(`🔀 Looking for branch toggle: ${branchName}...`);
      const children = await this.getBlockChildren(parentToggle.id);
      let branchBlock = null;
      for (const child of children) {
        if (child.type === "toggle") {
          const text = child.toggle?.rich_text
            ?.map((rt) => rt.plain_text)
            .join("")
            .trim();
          if (
            text === `🔀 ${branchName}` ||
            text === branchName ||
            text === `❌ ${branchName} (deleted)`
          ) {
            branchBlock = child;
            break;
          }
        }
      }

      if (!branchBlock) {
        console.log(`⚠️  No toggle found for branch: ${branchName}`);
        return;
      }

      console.log(`✅ Found branch toggle: ${branchBlock.id}`);
      console.log("🔴 Updating to deleted state (red background)...");

      await this.notion.blocks.update({
        block_id: branchBlock.id,
        toggle: {
          rich_text: [
            {
              type: "text",
              text: { content: `❌ ${branchName} (deleted)` },
              annotations: { bold: true, strikethrough: true, color: "red" },
            },
          ],
          color: "red_background",
        },
      });

      console.log("✅ Branch toggle marked as deleted.");
    } catch (error) {
      console.error("❌ Error marking branch as deleted:", error);
      throw error;
    }
  }

  /**
   * Read the structure hash from the newest commit toggle's callout.
   * Searches inside branch sub-toggles for the most recent commit.
   */
  async getExistingVersionHash(pageId) {
    try {
      const parentToggle = await this.findParentToggle(pageId);
      if (!parentToggle) return null;

      // Get children of parent toggle (branch sub-toggles)
      const branchToggles = await this.getBlockChildren(parentToggle.id);

      for (const branch of branchToggles) {
        if (branch.type === "toggle" && branch.has_children) {
          // Look inside this branch toggle for commit toggles
          const commits = await this.getBlockChildren(branch.id);
          for (const commit of commits) {
            if (commit.type === "toggle" && commit.has_children) {
              // Look inside the commit toggle for its callout
              const innerBlocks = await this.getBlockChildren(commit.id);
              for (const inner of innerBlocks) {
                if (inner.type === "callout") {
                  const text = inner.callout?.rich_text?.[0]?.plain_text || "";
                  const match = text.match(/Hash: ([a-z0-9-]+)/i);
                  if (match) return match[1];
                }
              }
              return null; // Only check the newest commit in the first branch
            }
          }
        }
      }
    } catch (error) {
      console.warn("Could not get existing version hash:", error.message);
    }
    return null;
  }
}

module.exports = { NotionStructureUpdater };
