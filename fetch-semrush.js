/**
 * Semrush 台灣流量排名抓取工具
 *
 * 使用方式：
 *   node fetch-semrush.js
 *
 * 功能說明：
 *   從 Semrush Trending Websites (https://www.semrush.com/trending-websites/tw/all)
 *   下載台灣完整網站排名，直接從 HTML 中的 window.__PRELOADED_STATE__ 提取資料。
 */

const https = require('https');
const fs = require('fs');
const { URL } = require('url');

const SEMRUSH_URL = 'https://www.semrush.com/trending-websites/tw/all';
const OUTPUT_FILE = 'semrush_top_tw.json';

// 設定 HTTPS agent 來處理某些環境下的 SSL 證書問題
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

function download(url, baseUrl = undefined) {
  return new Promise((resolve, reject) => {
    // 解析 URL 以便處理相對路徑的重新導向
    const parsedUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
    const currentBase = `${parsedUrl.protocol}//${parsedUrl.host}`;

    https.get(parsedUrl.href, { agent: httpsAgent }, (res) => {
      // 處理 redirect（301 / 302）
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error(`Redirect (${res.statusCode}) 但無 Location header`));
        console.log(`發現重新導向 -> ${loc}`);
        // 使用 currentBase 來處理相對路徑的重新導向
        return resolve(download(loc, currentBase));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`下載失敗，HTTP 狀態碼: ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve(data));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 從 HTML 中提取 window.__PRELOADED_STATE__ 的資料
 * @param {string} html - HTML 內容
 * @returns {Object|null} - 解析後的狀態資料，如果找不到則返回 null
 */
function extractPreloadedState(html) {
  // 尋找 window.__PRELOADED_STATE__ = {...} 的模式
  const pattern = /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/;
  const match = html.match(pattern);

  if (!match) {
    // 如果沒有找到分號結尾，嘗試找到開始位置然後手動匹配括號
    const startMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({)/);
    if (startMatch) {
      const startIndex = startMatch.index + startMatch[0].length - 1;
      let braceCount = 0;
      let endIndex = -1;

      for (let i = startIndex; i < html.length; i++) {
        if (html[i] === '{') braceCount++;
        if (html[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }

      if (endIndex > 0) {
        const jsonStr = html.substring(startIndex, endIndex);
        try {
          return JSON.parse(jsonStr);
        } catch (err) {
          console.error('解析 JSON 時發生錯誤:', err.message);
          return null;
        }
      }
    }
    return null;
  }

  try {
    const jsonStr = match[1];
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('解析 JSON 時發生錯誤:', err.message);
    // 如果直接解析失敗，嘗試手動匹配括號
    const startIndex = match.index + match[0].indexOf('{');
    let braceCount = 0;
    let endIndex = -1;

    for (let i = startIndex; i < html.length; i++) {
      if (html[i] === '{') braceCount++;
      if (html[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (endIndex > 0) {
      const jsonStr = html.substring(startIndex, endIndex);
      try {
        return JSON.parse(jsonStr);
      } catch (err2) {
        console.error('再次解析 JSON 時發生錯誤:', err2.message);
        return null;
      }
    }

    return null;
  }
}

/**
 * 將 Semrush 資料轉換成所需格式
 * @param {Array} domains - domains 陣列
 * @returns {Array} - 轉換後的網站資料陣列
 */
function convertData(domains) {
  if (!domains || !Array.isArray(domains)) {
    return [];
  }

  return domains.map((domain, index) => ({
    rank: index + 1,
    domain_name: domain.domain_name || '',
    total_traffic: domain.total_traffic || 0
  }));
}

async function main() {
  try {
    console.log('正在從 Semrush 下載台灣流量排名...');

    const html = await download(SEMRUSH_URL);

    console.log('下載完成，正在解析資料...');

    const preloadedState = extractPreloadedState(html);

    if (!preloadedState) {
      throw new Error('無法從 HTML 中找到 window.__PRELOADED_STATE__');
    }

    if (!preloadedState.data || !preloadedState.data.domains) {
      throw new Error('預載入狀態中沒有找到 domains 資料');
    }

    const domains = preloadedState.data.domains;
    console.log(`找到 ${domains.length} 筆網站資料`);

    const sites = convertData(domains);

    if (sites.length === 0) {
      throw new Error('未能解析到任何網站資料');
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
