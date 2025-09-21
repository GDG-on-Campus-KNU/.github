const axios = require('axios');
const fs = require('fs');
const path = require('path');

const notionApiKey = process.env.NOTION_API_KEY;
const notionDbId = process.env.NOTION_DB_ID;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

// 마지막으로 전송한 아이템 ID를 저장할 파일
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

async function fetchNotionItems() {
  const response = await axios.post(
    `https://api.notion.com/v1/databases/${notionDbId}/query`,
    {
      sorts: [{ property: "CreatedTime", direction: "ascending" }],
    },
    {
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
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
  const lastSentId = getLastSentId();
  const items = await fetchNotionItems();

  let newItems = items;
  if (lastSentId) {
    const index = items.findIndex(item => item.id === lastSentId);
    if (index !== -1) {
      newItems = items.slice(index + 1); // 마지막으로 보낸 이후 아이템만
    }
  }

  for (const item of newItems) {
    const title = item.properties?.Name?.title?.[0]?.text?.content || '제목 없음';
    await sendDiscordMessage(`📝 새 글 추가됨: ${title}`);
  }

  if (newItems.length > 0) {
    saveLastSentId(newItems[newItems.length - 1].id);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
