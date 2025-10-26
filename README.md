# 城市資本戰 v2.2（多檔案）— Cache Bust + Safe Ensure

**為什麼你還看到「Can't find variable: ensureCash」？**
- GitHub Pages / 行動瀏覽器常把 `game.js` 強制快取，雖然你已更新檔案，但使用者仍拿到舊版 JS。

**怎麼解決**
1. 我把 JS 檔更名為 **`game-v22.js`**，在 `index.html` 直接引用新檔名（或加版本參數 `?v=xxx` 都可以）。
2. 內部新增 **`safeEnsureCash()`**，即使外面殘留舊全域也不會噴錯。

**使用**
- 覆蓋 `index.html`、`style.css`，並新增 `game-v22.js`（無需保留舊 `game.js`）。
- 若你的站上仍同時有舊 `index.html`，務必確保 `<script src="game-v22.js" defer></script>`。