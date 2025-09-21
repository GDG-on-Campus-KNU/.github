const axios = require('axios');
const fs = require('fs');
const path = require('path');

const notionApiKey = process.env.NOTION_API_KEY;
const notionDbId = process.env.NOTION_DB_ID; // Database ID
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

const lastIdFile = path.resolve('./last_sent_id.txt');

function getLastSentId() {
  if (fs.existsSync(lastIdFile)) {
    return fs.readFileSync(lastIdFile, 'utf-8').trim();
  }
  return null;
}

function saveLastSentId(id) {
  fs.writeFileSync(lastIdFile, id);
}

// Step 1: Database → Data Source
async function getDataSourceId(databaseId) {
  const response = await axios.get(
    `https://api.notion.com/v1/databases/${databaseId}`,
    {
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
    }
  );

  const dataSources = response.data.data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error('No data sources found in the database');
  }

  // 기본적으로 첫 번째 데이터 소스 사용
  return dataSources[0].id;
}

// Step 2: Fetch items from a data source
async function fetchNotionItems(dataSourceId) {
  const response = await axios.post(
    `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
    {
      sorts: [{ property: "created_time", direction: "ascending" }],
    },
    {
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.results;
}

async function sendDiscordMessage(content) {
  await axios.post(discordWebhookUrl, { content });
}

async function main() {
  try {
    const lastSentId = getLastSentId();
    const dataSourceId = await getDataSourceId(notionDbId);
    const items = await fetchNotionItems(dataSourceId);

    let newItems = items;
    if (lastSentId) {
      const index = items.findIndex(item => item.id === lastSentId);
      if (index !== -1) {
        newItems = items.slice(index + 1);
      }
    }

    for (const item of newItems) {
      const title = item.properties?.Name?.title?.[0]?.text?.content || '제목 없음';
      await sendDiscordMessage(`📝 새 글 추가됨: ${title}`);
    }

    if (newItems.length > 0) {
      saveLastSentId(newItems[newItems.length - 1].id);
    }

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
