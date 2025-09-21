const axios = require('axios');

const notionApiKey = process.env.NOTION_API_KEY;
const notionDbId = process.env.NOTION_DB_ID; // Database ID
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

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
  // 30분 전 시간 (UTC 기준)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const response = await axios.post(
    `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
    {
      sorts: [{ property: "생성 일시", direction: "ascending" }],
      filter: {
        property: "생성 일시",
        date: {
          on_or_after: thirtyMinutesAgo
        }
      }
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

// Step 3: Send message to Discord
async function sendDiscordMessage(content) {
  await axios.post(discordWebhookUrl, { content });
}

async function main() {
  try {
    const dataSourceId = await getDataSourceId(notionDbId);
    const items = await fetchNotionItems(dataSourceId);

    for (const item of items) {
      const title = item.properties?.Name?.title?.[0]?.text?.content || '제목 없음';
      const pageId = item.id.replace(/-/g, ''); // 하이픈 제거
      const notionLink = `https://www.notion.so/${pageId}`;
      await sendDiscordMessage(`📝 새 글 추가됨: ${title}\n🔗 <${notionLink}>`);
    }

  } catch (err) {
    console.error('Error:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

main();
