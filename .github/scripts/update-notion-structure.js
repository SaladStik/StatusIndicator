const { DirectoryParser } = require("./directory-parser");
const { MermaidGenerator } = require("./mermaid-generator");
const { NotionStructureUpdater } = require("./notion-client");
const { VersionHistoryManager } = require("./version-history-manager");
const path = require("path");

async function main() {
  console.log("🚀 Starting Notion Code Structure Sync...\n");

  // Get environment variables
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;
  const REPO_PATH = process.env.GITHUB_WORKSPACE || process.cwd();
  const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
  const GITHUB_SHA = process.env.GITHUB_SHA;
  const GITHUB_ACTOR = process.env.GITHUB_ACTOR;
  const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME;
  const COMMIT_MESSAGE = process.env.COMMIT_MESSAGE;
  const COMMIT_AUTHOR = process.env.COMMIT_AUTHOR;
  const GIT_DIFF = process.env.GIT_DIFF || "";
  const COMMIT_COUNT = parseInt(process.env.COMMIT_COUNT || "0", 10);
  const EVENT_NAME = process.env.EVENT_NAME || "push";
  const DELETED_REF = process.env.DELETED_REF || "";
  const DELETED_REF_TYPE = process.env.DELETED_REF_TYPE || "";

  // Validate required variables
  if (!NOTION_API_KEY || !NOTION_PAGE_ID) {
    console.error("❌ Missing required environment variables:");
    if (!NOTION_API_KEY) console.error("   - NOTION_API_KEY");
    if (!NOTION_PAGE_ID) console.error("   - NOTION_PAGE_ID");
    process.exit(1);
  }

  try {
    // Handle branch deletion events
    if (
      EVENT_NAME === "delete" &&
      DELETED_REF_TYPE === "branch" &&
      DELETED_REF
    ) {
      console.log(`🗑️  Branch deleted: ${DELETED_REF}`);
      const notionClient = new NotionStructureUpdater(NOTION_API_KEY);
      await notionClient.markBranchDeleted(NOTION_PAGE_ID, DELETED_REF);
      console.log("\n✅ Branch toggle marked as deleted!");
      return;
    }

    // Initialize clients
    const parser = new DirectoryParser();
    const generator = new MermaidGenerator();
    const notionClient = new NotionStructureUpdater(NOTION_API_KEY);
    const versionManager = new VersionHistoryManager();

    // Step 1: Parse repository structure
    console.log("📂 Parsing repository structure...");
    console.log(`   Path: ${REPO_PATH}`);
    const structure = parser.parse(REPO_PATH, 20);
    console.log(`   ✓ Parsed ${countNodes(structure)} items\n`);

    // Step 2: Parse git diff for change highlighting
    const changedFiles = { added: [], modified: [], deleted: [] };
    if (GIT_DIFF) {
      for (const line of GIT_DIFF.split("\n")) {
        const match = line.match(/^([AMDR])\t(.+)$/);
        if (match) {
          const [, status, filePath] = match;
          if (status === "A") changedFiles.added.push(filePath);
          else if (status === "M") changedFiles.modified.push(filePath);
          else if (status === "D") changedFiles.deleted.push(filePath);
          else if (status === "R") changedFiles.added.push(filePath);
        }
      }
      console.log(
        `🔀 Git diff: +${changedFiles.added.length} ~${changedFiles.modified.length} -${changedFiles.deleted.length}`,
      );
    }

    // Step 3: Generate Mermaid diagram
    console.log("🎨 Generating Mermaid diagram...");
    const mermaidCode = generator.generateWithColors(structure, changedFiles);
    const currentHash = generator.calculateHash(structure);
    console.log(`   ✓ Generated diagram (hash: ${currentHash})\n`);

    // Step 4: Create version entry
    console.log("📝 Creating version entry...");
    const commitUrl =
      GITHUB_REPOSITORY && GITHUB_SHA
        ? `https://github.com/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}`
        : "";

    const versionEntry = versionManager.createVersionEntry(mermaidCode, {
      author: COMMIT_AUTHOR || GITHUB_ACTOR || "Unknown",
      branch: GITHUB_REF_NAME || "main",
      commitSha: GITHUB_SHA || "",
      commitMessage: COMMIT_MESSAGE || "No commit message",
      commitUrl: commitUrl,
    });

    console.log(`   Version: ${versionEntry.version}`);
    console.log(`   Author: ${versionEntry.author}`);
    console.log(`   Branch: ${versionEntry.branch}`);
    console.log(`   Commit: ${versionEntry.commitSha?.substring(0, 7)}\n`);

    // Step 5: Update Notion page (new commit is prepended inside the parent toggle)
    console.log("📤 Updating Notion page...");
    console.log(`   📊 Total commits: ${COMMIT_COUNT}`);
    await notionClient.updateCodeStructure(
      NOTION_PAGE_ID,
      mermaidCode,
      versionEntry,
      currentHash,
      COMMIT_COUNT,
    );

    console.log("\n✅ Successfully updated Notion page!");
    console.log(`   📊 Current version: ${versionEntry.version}`);
    console.log(
      `    View page: https://notion.so/${NOTION_PAGE_ID.replace(/-/g, "")}`,
    );
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// Helper function to count nodes in structure
function countNodes(node) {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

// Run the script
main();
