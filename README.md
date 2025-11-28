# 台灣網站流量排名抓取工具

從多個來源抓取台灣網站流量排名清單的工具集，包含：
- [Tranco List](https://tranco-list.eu/) - 全球前 100 萬網站排名
- [Cloudflare Radar](https://radar.cloudflare.com/) - Cloudflare 的台灣流量排名（前 100 名）
- [AhrefsTop](https://ahrefstop.com/websites/taiwan) - Ahrefs 的台灣 Organic Search 流量排名（前 100 名）

## 📊 資料來源

### Tranco List
[Tranco List](https://tranco-list.eu/) - 結合 Alexa, Cisco Umbrella, Majestic, Chrome User Experience Report 等多來源的網站排名，比單一來源更具可靠性與穩定性。

- 原始資料每日更新
- 篩選條件：網域結尾為 `.tw`

### Cloudflare Radar
[Cloudflare Radar](https://radar.cloudflare.com/) - Cloudflare 提供的全球網路流量分析平台，透過 Cloudflare 的全球網路基礎設施收集真實流量數據。提供台灣地區的前 100 名網站排名，包含網站分類資訊。資料透過 [Cloudflare Radar API](https://developers.cloudflare.com/radar/) 取得。

- 原始資料每日更新
- 需要 Cloudflare API Token，請在 `.env` 檔案中設定 `CLOUDFLARE_API_TOKEN`

### AhrefsTop
[AhrefsTop](https://ahrefstop.com/websites/taiwan) - 基於 Ahrefs 有機搜尋流量估算的網站排名。提供台灣地區的前 100 名網站排名，包含網站類別和搜尋流量數據。資料每月更新。

- 原始資料每月更新

## 🚀 使用方式

### 1. 安裝相依套件

```bash
npm install
```

### 2. 執行腳本

#### Tranco List
```bash
npm run tranco
```

#### Cloudflare Radar
```bash
npm run cloudflare
```
**注意**：需要在 .env 檔案中設定 Cloudflare API Token，請參考 `fetch-cloudflare.js` 中的說明。

#### AhrefsTop
```bash
npm run ahrefs
```

## 📁 輸出檔案

### Tranco List
執行後會產生 `tranco_list_tw.json`，格式如下：

```json
[
  {
    "rank": 123,
    "domain": "example.com.tw",
    "url": "https://example.com.tw"
  },
  ...
]
```

### Cloudflare Radar
執行後會產生 `cloudflare_radar_tw.json`，格式如下：

```json
[
  {
    "rank": 1,
    "domain": "google.com",
    "categories": [
      {
        "id": 145,
        "name": "Search Engines",
        "superCategoryId": 26
      }
    ]
  },
  ...
]
```

### AhrefsTop
執行後會產生 `ahrefs_top_tw.json`，格式如下：

```json
[
  {
    "rank": 1,
    "website": "wikipedia.org",
    "category": "Reference",
    "search_traffic_K": 80400
  },
  ...
]
```
**注意**：`search_traffic_K` 欄位為以 K 為單位的純數字（例如 "80.4M" 轉換為 80400）。

## 📜 授權

This project is licensed under the MIT License. See the [LICENSE](/LICENSE) file for details.

## 🙏 致謝

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).
