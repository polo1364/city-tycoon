# 城市資本戰 v2.1（多檔案）— Hotfix

**修正**
- 新增 `ensureCash()`：自動抵押 → 仍不足則破產；若有債權人會將資產移交，否則收歸銀行。
- `updateOwners()` 忽略淘汰玩家；避免破產後仍顯示所有者色塊。

**使用**
解壓並覆蓋原目錄的四個檔：`index.html`、`style.css`、`game.js`、`README.md`。