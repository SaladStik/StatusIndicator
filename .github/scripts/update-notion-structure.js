const { DirectoryParser } = require('./directory-parser');
const { MermaidGenerator } = require('./mermaid-generator');
const { NotionStructureUpdater } = require('./notion-client');
const { VersionHistoryManager } = require('./version-history-manager');
const path = require('path');

async function main() {
  console.log('🚀 Starting Notion Code Structure Sync...\n');

  // Get environment variables
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;
  const REPO_PATH = process.env.GITHUB_WORKSPACE || process.cwd();
  const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
  const GITHUB_SHA = process.env.GITHUB_SHA;
  const GITHUB_ACTOR = process.env.GITHUB_ACTOR;
  const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME;
  const COMMIT_MESSAGE = process.env.COMMIT_MESSAGE;

  // Validate required variables
  if (!NOTION_API_KEY || !NOTION_PAGE_ID) {
    console.error('❌ Missing required environment variables:');
    if (!NOTION_API_KEY) console.error('   - NOTION_API_KEY');
    if (!NOTION_PAGE_ID) console.error('   - NOTION_PAGE_ID');
    process.exit(1);
  }

  try {
    // Initialize clients
    const parser = new DirectoryParser();
    const generator = new MermaidGenerator();
    const notionClient = new NotionStructureUpdater(NOTION_API_KEY);
    const versionManager = new VersionHistoryManager();

    // Step 1: Parse repository structure
    console.log('📂 Parsing repository structure...');
    console.log(`   Path: ${REPO_PATH}`);
    const structure = parser.parse(REPO_PATH, 4);
    console.log(`   ✓ Parsed ${countNodes(structure)} items\n`);

    // Step 2: Generate Mermaid diagram
    console.log('🎨 Generating Mermaid diagram...');
    const mermaidCode = generator.generateWithColors(structure);
    const currentHash = generator.calculateHash(structure);
    console.log(`   ✓ Generated diagram (hash: ${currentHash})\n`);

    // Step 3: Check if structure has changed
    console.log('🔍 Checking for changes...');
    const existingHash = await notionClient.getExistingVersionHash(NOTION_PAGE_ID);
    
    if (existingHash === currentHash) {
      console.log('   ℹ️  No changes detected. Structure is up to date.');
      console.log('   Skipping update to preserve version history.\n');
      return;
    }
    
    console.log('   ✓ Changes detected!\n');

    // Step 4: Get previous versions
    console.log('📚 Retrieving version history...');
    const previousVersions = await versionManager.getVersionHistory(
      notionClient.notion,
      NOTION_PAGE_ID
    );
    console.log(`   ✓ Found ${previousVersions.length} previous versions\n`);

    // Step 5: Create new version entry
    console.log('📝 Creating version entry...');
    const commitUrl = GITHUB_REPOSITORY && GITHUB_SHA
      ? `https://github.com/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}`
      : '';

    const versionEntry = versionManager.createVersionEntry(mermaidCode, {
      author: GITHUB_ACTOR || 'Unknown',
      branch: GITHUB_REF_NAME || 'main',
      commitSha: GITHUB_SHA || '',
      commitMessage: COMMIT_MESSAGE || 'No commit message',
      commitUrl: commitUrl
    });

    console.log(`   Version: ${versionEntry.version}`);
    console.log(`   Author: ${versionEntry.author}`);
    console.log(`   Branch: ${versionEntry.branch}`);
    console.log(`   Commit: ${versionEntry.commitSha?.substring(0, 7)}\n`);

    // Step 6: Prune old versions (keep last 5)
    const updatedHistory = [versionEntry, ...previousVersions];
    const prunedHistory = versionManager.pruneVersions(updatedHistory);

    // Step 7: Update Notion page
    console.log('📤 Updating Notion page...');
    await notionClient.updateCodeStructure(
      NOTION_PAGE_ID,
      mermaidCode,
      versionEntry,
      prunedHistory.slice(1) // Exclude current version from history
    );

    console.log('\n✅ Successfully updated Notion page!');
    console.log(`   📊 Current version: ${versionEntry.version}`);
    console.log(`   📚 Keeping ${prunedHistory.length - 1} previous versions`);
    console.log(`   🔗 View page: https://notion.so/${NOTION_PAGE_ID.replace(/-/g, '')}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\nStack trace:', error.stack);
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
