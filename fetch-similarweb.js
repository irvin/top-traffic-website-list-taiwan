/**
 * SimilarWeb 網站流量排名抓取工具
 *
 * 使用方式：
 *   node fetch-similarweb.js [country]
 *   例如：node fetch-similarweb.js taiwan
 *        node fetch-similarweb.js japan
 *
 * 功能說明：
 *   從 SimilarWeb 下載指定國家的 top 50 網站排名，
 *   解析 HTML 表格並轉換成 JSON 格式儲存。
 */

const https = require('https');
const fs = require('fs');
const { URL } = require('url');
const zlib = require('zlib');

// 從命令列參數取得國家名稱，預設為 taiwan
const country = process.argv[2] || 'taiwan';
const SIMILARWEB_URL = `https://www.similarweb.com/top-websites/${country}/`;
const OUTPUT_FILE = `similarweb_top_${country}.json`;

// 設定 HTTPS agent 來處理某些環境下的 SSL 證書問題
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

function download(url, baseUrl = undefined) {
  return new Promise((resolve, reject) => {
    // 解析 URL 以便處理相對路徑的重新導向
    const parsedUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
    const currentBase = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      agent: httpsAgent
    };

    const req = https.request(options, (res) => {
      // 處理 redirect（301 / 302）
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error(`Redirect (${res.statusCode}) 但無 Location header`));
        console.log(`發現重新導向 -> ${loc}`);
        // 使用 currentBase 來處理相對路徑的重新導向
        return resolve(download(loc, currentBase));
      }

      // 處理 202 Accepted（可能是 WAF 挑戰，但仍嘗試讀取內容）
      if (res.statusCode === 202) {
        console.log('警告：收到 HTTP 202，嘗試繼續讀取內容...');
      } else if (res.statusCode !== 200) {
        return reject(new Error(`下載失敗，HTTP 狀態碼: ${res.statusCode}`));
      }

      // 檢查是否需要解壓縮
      const encoding = res.headers['content-encoding'];
      let stream = res;

      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = '';
      stream.on('data', (chunk) => {
        data += chunk;
      });
      stream.on('end', () => {
        // 檢查是否收到 WAF 挑戰頁面
        if (data.length === 0) {
          return reject(new Error('下載的內容為空'));
        }
        // 檢查是否為挑戰頁面（但允許繼續處理，因為可能只是警告）
        if (data.includes('Just a moment') || data.includes('Checking your browser') || data.includes('Please wait')) {
          console.log('警告：可能收到 WAF 挑戰頁面，但仍嘗試解析...');
        }
        resolve(data);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * 解碼 HTML 實體
 * @param {string} str - 包含 HTML 實體的字串
 * @returns {string} - 解碼後的字串
 */
function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 從 HTML 中解析表格資料
 * @param {string} html - HTML 內容
 * @returns {Array} - 解析後的網站資料陣列
 */
function parseTable(html) {
  const sites = [];

  // 找到所有表格行（使用 class 來識別，不依賴特定國家代碼）
  const trRegex = /<tr[^>]*class="[^"]*top-table__row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];

    // 提取 Rank - 使用更通用的匹配，匹配包含 __rank 的 class（不依賴特定前綴）
    const rankMatch = trContent.match(/<span[^>]*class="[^"]*__rank[^"]*"[^>]*>(\d+)<\/span>/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1], 10);

    // 提取 Website - 使用更通用的匹配，匹配包含 __domain 的 class（不依賴特定前綴）
    const websiteMatch = trContent.match(/<span[^>]*class="[^"]*__domain[^"]*"[^>]*>([^<]+)<\/span>/);
    if (!websiteMatch) continue;
    const website = websiteMatch[1].trim();

    // 提取 Category - 使用更通用的匹配，匹配包含 __category 的 class（不依賴特定前綴）
    const categoryMatch = trContent.match(/<a[^>]*class="[^"]*__category[^"]*"[^>]*>([^<]+)<\/a>/);
    const category = categoryMatch ? decodeHtmlEntities(categoryMatch[1].trim()) : null;

    sites.push({
      rank,
      website,
      category
    });
  }

  return sites;
}

async function main() {
  try {
    console.log(`正在從 SimilarWeb 下載 ${country} 流量排名...`);

    const html = await download(SIMILARWEB_URL);

    console.log('下載完成，正在解析表格資料...');

    const sites = parseTable(html);

    if (sites.length === 0) {
      throw new Error('未能解析到任何網站資料，可能是 HTML 結構改變或需要 JavaScript 渲染');
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sites, null, 2));

    console.log('------------------------------------------------');
    console.log('處理完成！');
    console.log(`共取得 ${sites.length} 筆網站排名`);
    console.log(`結果已儲存至: ${OUTPUT_FILE}`);
    console.log('前 5 筆範例:', JSON.stringify(sites.slice(0, 5), null, 2));
  } catch (err) {
    console.error('處理過程中發生錯誤:', err.message);
    process.exit(1);
  }
}

main();
