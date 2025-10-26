// 城市資本戰 Web 版 MVP
// 功能：擲骰、移動、購地、收租、車站/事業、機會/命運、入獄、抵押與贖回、AI 對手、存讀檔
// 尚未：蓋房/旅館、玩家交易
(() => {
  // ---------- 工具 ----------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function shuffle(a) {
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ---------- 參數/資料 ----------
  const COLORS = {
    brown: "#8d5524",
    lightBlue: "#7ab6ff",
    pink: "#ff8dc7",
    orange: "#ffa14a",
    red: "#ff6b6b",
    yellow: "#ffd93d",
    green: "#28c76f",
    darkBlue: "#5470ff"
  };

  const STATION_RENTS = [25, 50, 100, 200];
  const START_SALARY = 200;
  const JAIL_FINE = 50;

  // 40 格定義
  const tiles = [
    {idx:0, type:"START", label:"起點"},
    {idx:1, type:"PROPERTY", name:"老街", group:"brown", price:60},
    {idx:2, type:"CHEST", label:"命運"},
    {idx:3, type:"PROPERTY", name:"碼頭邊", group:"brown", price:60},
    {idx:4, type:"TAX", amount:200, label:"所得稅"},
    {idx:5, type:"STATION", name:"北站"},
    {idx:6, type:"PROPERTY", name:"松柏里", group:"lightBlue", price:100},
    {idx:7, type:"CHANCE", label:"機會"},
    {idx:8, type:"PROPERTY", name:"晴川街", group:"lightBlue", price:100},
    {idx:9, type:"PROPERTY", name:"望海巷", group:"lightBlue", price:120},
    {idx:10, type:"JAIL", label:"監獄／探監"},
    {idx:11, type:"PROPERTY", name:"春申坊", group:"pink", price:140},
    {idx:12, type:"UTILITY", name:"水務局"},
    {idx:13, type:"PROPERTY", name:"晴嶺道", group:"pink", price:140},
    {idx:14, type:"PROPERTY", name:"虹橋口", group:"pink", price:160},
    {idx:15, type:"STATION", name:"東站"},
    {idx:16, type:"PROPERTY", name:"琥珀道", group:"orange", price:180},
    {idx:17, type:"CHEST", label:"命運"},
    {idx:18, type:"PROPERTY", name:"桂花里", group:"orange", price:180},
    {idx:19, type:"PROPERTY", name:"柑園街", group:"orange", price:200},
    {idx:20, type:"FREE", label:"休息／免費停車"},
    {idx:21, type:"PROPERTY", name:"丹楓道", group:"red", price:220},
    {idx:22, type:"CHANCE", label:"機會"},
    {idx:23, type:"PROPERTY", name:"暮霞巷", group:"red", price:220},
    {idx:24, type:"PROPERTY", name:"赤城門", group:"red", price:240},
    {idx:25, type:"STATION", name:"南站"},
    {idx:26, type:"PROPERTY", name:"金河灣", group:"yellow", price:260},
    {idx:27, type:"PROPERTY", name:"日耀路", group:"yellow", price:260},
    {idx:28, type:"UTILITY", name:"電力局"},
    {idx:29, type:"PROPERTY", name:"曦光道", group:"yellow", price:280},
    {idx:30, type:"GOTOJAIL", label:"入獄"},
    {idx:31, type:"PROPERTY", name:"翠微里", group:"green", price:300},
    {idx:32, type:"PROPERTY", name:"青泉街", group:"green", price:300},
    {idx:33, type:"CHEST", label:"命運"},
    {idx:34, type:"PROPERTY", name:"森海巷", group:"green", price:320},
    {idx:35, type:"STATION", name:"西站"},
    {idx:36, type:"CHANCE", label:"機會"},
    {idx:37, type:"PROPERTY", name:"星光城", group:"darkBlue", price:350},
    {idx:38, type:"TAX", amount:100, label:"豪華稅"},
    {idx:39, type:"PROPERTY", name:"雲頂塔", group:"darkBlue", price:400}
  ];

  // 計算基礎租金（無房/旅館；擁有同色全組則翻倍）
  const baseRent = (price) => Math.round(price * 0.12);

  // 命運/機會卡（抽到後放到牌底）
  const chestDeck = shuffle([
    {t:"cash", v:+200, text:"城市補助，領 $200"},
    {t:"cash", v:+100, text:"退稅，領 $100"},
    {t:"cash", v:-100, text:"醫療費，付 $100"},
    {t:"cash", v:+150, text:"公司紅利，領 $150"},
    {t:"cash", v:-50, text:"罰款，付 $50"},
    {t:"moveTo", idx:0, text:"前進到起點並領薪"},
    {t:"jail", text:"直接入獄"},
    {t:"outCard", text:"獲得出獄卡"},
    {t:"repair", house:25, hotel:100, text:"維修費：每棟房 $25 / 旅館 $100（MVP 未實作房屋，視為 $0）"},
    {t:"collectFromEach", v:50, text:"顧問費：每位玩家付你 $50"},
    {t:"payToEach", v:25, text:"捐助：你付每位玩家 $25"},
    {t:"nearestUtility", text:"前進到最近的事業格（若有主付 10×點數；無主可買）"}
  ]);

  const chanceDeck = shuffle([
    {t:"moveTo", idx:0, text:"前進到起點並領薪"},
    {t:"nearestStation", text:"前進到最近的車站（若有主付 2×租金；無主可買）"},
    {t:"jail", text:"直接入獄"},
    {t:"outCard", text:"獲得出獄卡"},
    {t:"cash", v:+150, text:"抽中彩券，領 $150"},
    {t:"cash", v:-75, text:"收到罰單，付 $75"},
    {t:"back3", text:"回退 3 格"},
    {t:"payTax", v:200, text:"稅務稽核，支付 $200"},
    {t:"moveTo", idx:24, text:"前進到『赤城門』"},
    {t:"moveTo", idx:39, text:"前進到『雲頂塔』"},
    {t:"marketRush", text:"收租大月：本回合你收租 +$25（臨時）", bonus:+25},
    {t:"bonusNextGo", text:"下次經過起點 +$100 獎金"}
  ]);

  // 11x11 格座標映射
  function idxToCoord(i) {
    // 0 底左 -> 10 底右 -> 20 頂右 -> 30 頂左 -> 回到底左
    if (i <= 10) return {r:10, c:i};
    if (i <= 20) return {r:10-(i-10), c:10};
    if (i <= 30) return {r:0, c:10-(i-20)};
    return {r:i-30, c:0};
  }

  // ---------- 狀態 ----------
  const state = {
    players: [],
    cur: 0,
    dice: [0,0],
    doublesInRow: 0,
    awaitingBuy: false,
    mustEnd: false,
    bonusNextGo: new Set(),  // player indexes with +100 on next GO pass
    logSeq: 0
  };

  const PlayerColors = ["#e74c3c","#2980b9","#27ae60","#8e44ad","#f39c12","#16a085"];

  function makePlayer(name, isAI, color) {
    return {
      id: (typeof globalThis!=='undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID==='function')
        ? globalThis.crypto.randomUUID()
        : 'p-' + Math.random().toString(36).slice(2),
      name, isAI, color,
      cash: 1500,
      pos: 0,
      inJail: false,
      jailTurns: 0,
      outCard: 0,
      properties: [],
      mortgaged: new Set(),
      alive: true,
      rentBonusTemp: 0
    };
  }

  function initPlayers() {
    state.players = [
      makePlayer("你", false, PlayerColors[0]),
      makePlayer("蒼嶺", true, PlayerColors[1]),
      makePlayer("星河", true, PlayerColors[2]),
      makePlayer("雲岫", true, PlayerColors[3])
    ];
    state.cur = 0;
    state.dice = [0,0];
    state.doublesInRow = 0;
    state.awaitingBuy = false;
    state.mustEnd = false;
    state.bonusNextGo = new Set();
    renderPlayers();
    log("🎮 遊戲開始！4 位玩家就緒。", false);
  }

  // ---------- 介面渲染 ----------
  function buildBoard() {
    const board = $("#board");
    board.innerHTML = "";
    board.style.setProperty("--gs", 11);
    // 放置 11x11 空格
    for (let r=0;r<11;r++) {
      for (let c=0;c<11;c++) {
        const cell = document.createElement("div");
        cell.className = "tile empty";
        cell.style.gridRow = (r+1);
        cell.style.gridColumn = (c+1);
        board.appendChild(cell);
      }
    }
    // 將 40 格放上去
    for (const t of tiles) {
      const {r,c} = idxToCoord(t.idx);
      const cell = document.createElement("div");
      cell.className = "tile";
      cell.style.gridRow = (r+1);
      cell.style.gridColumn = (c+1);
      let cls = "";
      if (t.type==="PROPERTY") cls = "property";
      if (t.type==="STATION") cls = "station";
      if (t.type==="UTILITY") cls = "utility";
      if (t.type==="TAX") cls = "tax";
      if (t.type==="CHANCE") cls = "chance";
      if (t.type==="CHEST") cls = "chest";
      if (t.type==="GOTOJAIL") cls = "gotojail";
      if (t.type==="JAIL") cls = "jail";
      if (t.type==="START") cls = "start";
      if (t.type==="FREE") cls = "free";
      if ([0,10,20,30].includes(t.idx)) cell.classList.add("corner");
      if (cls) cell.classList.add(cls);

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = t.name || t.label || "";
      cell.appendChild(label);

      if (t.type==="PROPERTY") {
        const colorbar = document.createElement("div");
        colorbar.className = "colorbar";
        colorbar.style.background = COLORS[t.group] || "#ccc";
        cell.prepend(colorbar);
        const price = document.createElement("div");
        price.className = "price";
        const p = t.price;
        const r0 = Math.round(p*0.12);
        price.textContent = `$${p}｜租$${r0}`;
        cell.appendChild(price);
      }
      if (t.type==="STATION" || t.type==="UTILITY") {
        const price = document.createElement("div");
        price.className = "price";
        price.textContent = `可購買`;
        cell.appendChild(price);
      }
      // 所有者標記
      const owner = document.createElement("div");
      owner.className = "owner";
      owner.style.display = "none";
      owner.dataset.idx = t.idx;
      cell.appendChild(owner);

      board.appendChild(cell);
    }
    renderTokens();
    updateOwners();
  }

  function renderTokens() {
    // 先清理舊 token
    $$(".token").forEach(e => e.remove());
    for (let i=0;i<state.players.length;i++) {
      const p = state.players[i];
      if (!p.alive) continue;
      const {r,c} = idxToCoord(p.pos);
      const cell = $(`#board > .tile[style*="grid-row: ${r+1};"][style*="grid-column: ${c+1};"]`);
      const tok = document.createElement("div");
      tok.className = "token";
      tok.style.background = p.color;
      tok.dataset.p = String(i+1);
      cell.appendChild(tok);
    }
  }

  function updateOwners() {
    // reset owners
    $$(".owner").forEach(el => { el.style.display = "none"; });
    for (const pl of state.players) {
      for (const idx of pl.properties) {
        const {r,c} = idxToCoord(idx);
        const cell = $(`#board > .tile[style*="grid-row: ${r+1};"][style*="grid-column: ${c+1};"] .owner`);
        if (cell) {
          cell.style.display = "block";
          cell.style.background = pl.color;
        }
      }
    }
  }

  function renderPlayers() {
    const panel = $("#playersPanel");
    let html = "";
    state.players.forEach((p, i) => {
      if (!p.alive) return;
      html += `<div class="row">
        <div class="swatch" style="background:${p.color}"></div>
        <div class="name">${i===state.cur?"⭐ ":""}${p.name}${p.inJail?"（獄）":""}${p.outCard>0?"🃏":""}</div>
        <div class="cash">$${p.cash}</div>
      </div>`;
    });
    panel.innerHTML = html;
    $("#currentPlayer").textContent = `${state.players[state.cur].name}`;
  }

  function log(msg, highlightMe = false) {
    const logEl = $("#log");
    const div = document.createElement("div");
    div.className = "entry" + (highlightMe ? " me" : "");
    div.textContent = msg;
    logEl.prepend(div);
  }

  // ---------- 遊戲流程 ----------
  function nextPlayer() {
    // 跳過已破產玩家
    do {
      state.cur = (state.cur + 1) % state.players.length;
    } while(!state.players[state.cur].alive);

    state.dice = [0,0];
    state.doublesInRow = 0;
    state.awaitingBuy = false;
    state.mustEnd = false;
    renderPlayers();
    $("#btnRoll").disabled = state.players[state.cur].isAI; // 人類才能按
    $("#btnEnd").disabled = true;
    $("#btnBuy").disabled = true;
    $("#btnSkip").disabled = true;
    $("#dice1").textContent = "-";
    $("#dice2").textContent = "-";
    $("#turnInfo").textContent = "";

    checkWin();
    if (state.players[state.cur].isAI) {
      aiTurn();
    } else {
      // 如果在獄中，提供選項
      const p = state.players[state.cur];
      if (p.inJail) {
        showJailOptions(p);
      }
    }
  }

  function checkWin() {
    const alive = state.players.filter(p => p.alive);
    if (alive.length === 1) {
      showModal(`🏆 ${alive[0].name} 獲勝！（其他玩家皆已破產）`);
      $("#btnRoll").disabled = true;
      $("#btnEnd").disabled = true;
      return true;
    }
    return false;
  }

  function showModal(html, withCancel=false) {
    $("#modalBody").innerHTML = html;
    $("#modal").classList.remove("hidden");
    $("#modalCancel").style.display = withCancel ? "inline-flex" : "none";
    return new Promise(resolve => {
      const ok = () => { $("#modal").classList.add("hidden"); $("#modalOk").removeEventListener("click", ok); $("#modalCancel").removeEventListener("click", cancel); resolve(true); };
      const cancel = () => { $("#modal").classList.add("hidden"); $("#modalOk").removeEventListener("click", ok); $("#modalCancel").removeEventListener("click", cancel); resolve(false); };
      $("#modalOk").addEventListener("click", ok, {once:true});
      $("#modalCancel").addEventListener("click", cancel, {once:true});
    });
  }

  function showAssets() {
    const wrap = $("#assetsBody");
    const me = state.players[state.cur];
    let html = `<table class="asset-table">
      <thead><tr><th>#</th><th>地名</th><th>類型</th><th>狀態</th><th>操作</th></tr></thead><tbody>`;
    let i = 1;
    const owned = me.properties.map(idx => tiles[idx]);
    for (const t of owned) {
      const mort = me.mortgaged.has(t.idx);
      const typeTxt = t.type==="PROPERTY"?"地產":(t.type==="STATION"?"車站":"事業");
      html += `<tr>
        <td>${i++}</td>
        <td>${t.name || t.label}</td>
        <td>${typeTxt}</td>
        <td>${mort?"已抵押":"正常"}</td>
        <td>${
          mort ? `<button data-op="unmortgage" data-idx="${t.idx}">贖回</button>`
               : `<button data-op="mortgage" data-idx="${t.idx}">抵押</button>`
        }</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    wrap.innerHTML = html;
    // 綁定
    wrap.querySelectorAll("button[data-op]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (btn.dataset.op==="mortgage") doMortgage(me, idx);
        else doUnmortgage(me, idx);
        showAssets(); // refresh
        renderPlayers();
        updateOwners();
      });
    });
    $("#assetsPanel").classList.remove("hidden");
  }

  $("#btnAssets").addEventListener("click", showAssets);
  $("#btnCloseAssets").addEventListener("click", () => $("#assetsPanel").classList.add("hidden"));

  function rollDice() {
    const d1 = 1 + Math.floor(Math.random()*6);
    const d2 = 1 + Math.floor(Math.random()*6);
    state.dice = [d1,d2];
    $("#dice1").textContent = d1;
    $("#dice2").textContent = d2;
    return [d1,d2];
  }

  async function onRoll() {
    const p = state.players[state.cur];
    if (p.inJail) return; // 在獄中另有流程
    $("#btnRoll").disabled = true;
    const [d1,d2] = rollDice();
    const isDouble = d1===d2;
    if (isDouble) {
      state.doublesInRow++;
      if (state.doublesInRow>=3) {
        // 連三次雙骰 => 直接入獄
        log(`⚠️ ${p.name} 連續第三次擲出雙骰，被送入獄。`, p.isAI===false);
        goToJail(p);
        $("#btnEnd").disabled = false;
        return;
      }
    } else {
      state.doublesInRow = 0;
    }
    await moveSteps(p, d1+d2);
    await resolveTile(p, d1+d2);

    // 若擲出雙骰且仍然活著可再擲
    if (isDouble && p.alive && !p.inJail) {
      $("#turnInfo").textContent = "雙骰！你可再擲一次。";
      $("#btnRoll").disabled = false;
      $("#btnEnd").disabled = true;
    } else {
      $("#btnEnd").disabled = false;
    }
  }

  async function moveSteps(p, steps) {
    for (let i=0;i<steps;i++) {
      p.pos = (p.pos + 1) % 40;
      if (p.pos === 0) {
        let bonus = START_SALARY;
        if (state.bonusNextGo.has(p)) { bonus += 100; state.bonusNextGo.delete(p); }
        p.cash += bonus;
        renderPlayers();
        log(`💵 ${p.name} 經過起點，領 $${bonus}`, p.isAI===false);
      }
      renderTokens();
      await sleep(120);
    }
  }

  async function resolveTile(p, diceTotal) {
    const t = tiles[p.pos];
    if (t.type==="PROPERTY") {
      await onLandProperty(p, t);
    } else if (t.type==="STATION") {
      await onLandStation(p, t);
    } else if (t.type==="UTILITY") {
      await onLandUtility(p, t, diceTotal);
    } else if (t.type==="TAX") {
      await payToBank(p, t.amount, `稅金`);
    } else if (t.type==="CHANCE") {
      await drawCard(p, chanceDeck, "機會", diceTotal);
    } else if (t.type==="CHEST") {
      await drawCard(p, chestDeck, "命運", diceTotal);
    } else if (t.type==="GOTOJAIL") {
      goToJail(p);
    } else if (t.type==="JAIL") {
      log(`${p.name} 只是來探監。`, p.isAI===false);
    } else if (t.type==="FREE") {
      log(`${p.name} 於休息區放鬆片刻。`, p.isAI===false);
    }
  }

  function ownerOf(idx) {
    for (let i=0;i<state.players.length;i++) {
      const pl = state.players[i];
      if (!pl.alive) continue;
      if (pl.properties.includes(idx)) return i;
    }
    return -1;
  }

  function groupOwnedCount(ownerIdx, groupId) {
    const groupSlots = tiles.filter(t => t.type==="PROPERTY" && t.group===groupId).map(t => t.idx);
    const pl = state.players[ownerIdx];
    let cnt = 0;
    for (const idx of groupSlots) if (pl.properties.includes(idx) && !pl.mortgaged.has(idx)) cnt++;
    return {cnt, total: groupSlots.length};
  }

  async function onLandProperty(p, t) {
    const idx = t.idx;
    const base = baseRent(t.price);
    const ownerIdx = ownerOf(idx);
    if (ownerIdx<0) {
      // 無主：可購買
      const canBuy = p.cash >= t.price;
      if (!p.isAI) {
        $("#btnBuy").disabled = !canBuy;
        $("#btnSkip").disabled = false;
        state.awaitingBuy = true;
        $("#turnInfo").textContent = canBuy ? `可用 $${t.price} 購買《${t.name}》` : `資金不足，無法購買。`;
      } else {
        // AI：簡單策略：若現金> price+150 則買
        if (p.cash >= t.price + 150) {
          buyProperty(p, idx, t.price);
        } else {
          log(`🤔 ${p.name} 放棄購買《${t.name}》`, true);
        }
      }
    } else if (ownerIdx === state.players.indexOf(p)) {
      log(`${p.name} 來到自己的地《${t.name}》。`, p.isAI===false);
    } else {
      // 付租
      const owner = state.players[ownerIdx];
      if (owner.mortgaged.has(idx)) {
        log(`《${t.name}》已抵押，免租。`, p.isAI===false);
        return;
      }
      const {cnt, total} = groupOwnedCount(ownerIdx, t.group);
      let rent = base * (cnt===total ? 2 : 1);
      rent += owner.rentBonusTemp || 0;
      await payToPlayer(p, owner, rent, `租金：《${t.name}》`);
    }
  }

  async function onLandStation(p, t) {
    const idx = t.idx;
    const ownerIdx = ownerOf(idx);
    if (ownerIdx<0) {
      const price = 200;
      if (!p.isAI) {
        $("#turnInfo").textContent = `可用 $${price} 購買《${t.name}》`;
        state.awaitingBuy = true;
        $("#btnBuy").disabled = !(p.cash >= price);
        $("#btnBuy").dataset.price = String(price);
        $("#btnBuy").dataset.idx = String(idx);
        $("#btnSkip").disabled = false;
      } else {
        if (p.cash >= 350) buyProperty(p, idx, price);
      }
      // 若人類玩家，等待按鈕；AI 已處理
    } else if (ownerIdx === state.players.indexOf(p)) {
      log(`${p.name} 來到自己的《${t.name}》。`, p.isAI===false);
    } else {
      const owner = state.players[ownerIdx];
      if (owner.mortgaged.has(idx)) { log(`《${t.name}》已抵押，免租。`, p.isAI===false); return; }
      // 計算擁站數
      const ownerStations = [5,15,25,35].filter(s => owner.properties.includes(s) && !owner.mortgaged.has(s)).length;
      const rent = STATION_RENTS[clamp(ownerStations-1, 0, 3)] + (owner.rentBonusTemp||0);
      await payToPlayer(p, owner, rent, `車站租金：《${t.name}》`);
    }
  }

  async function onLandUtility(p, t, diceTotal) {
    const idx = t.idx;
    const ownerIdx = ownerOf(idx);
    if (ownerIdx<0) {
      const price = 150;
      if (!p.isAI) {
        $("#turnInfo").textContent = `可用 $${price} 購買《${t.name}》`;
        state.awaitingBuy = true;
        $("#btnBuy").disabled = !(p.cash >= price);
        $("#btnBuy").dataset.price = String(price);
        $("#btnBuy").dataset.idx = String(idx);
        $("#btnSkip").disabled = false;
      } else {
        if (p.cash >= 250) buyProperty(p, idx, price);
      }
    } else if (ownerIdx === state.players.indexOf(p)) {
      log(`${p.name} 來到自己的《${t.name}》。`, p.isAI===false);
    } else {
      const owner = state.players[ownerIdx];
      if (owner.mortgaged.has(idx)) { log(`《${t.name}》已抵押，免租。`, p.isAI===false); return; }
      const both = [12,28].every(u => owner.properties.includes(u) && !owner.mortgaged.has(u));
      const rate = both ? 10 : 4;
      const rent = diceTotal * rate + (owner.rentBonusTemp||0);
      await payToPlayer(p, owner, rent, `事業費用：《${t.name}》 ${rate}×點數`);
    }
  }

  function buyProperty(p, idx, priceOverride=null) {
    const t = tiles[idx];
    const price = priceOverride ?? (t.type==="PROPERTY"?t.price:(t.type==="STATION"?200:150));
    if (p.cash < price) { log(`資金不足，無法購買。`, !p.isAI); return; }
    p.cash -= price;
    p.properties.push(idx);
    updateOwners();
    renderPlayers();
    log(`📝 ${p.name} 以 $${price} 購得《${t.name || t.label}》`, p.isAI===false);
  }

  async function payToBank(p, amount, reason) {
    if (amount<=0) return;
    log(`🏦 ${p.name} 支付銀行 $${amount}（${reason}）`, p.isAI===false);
    await ensureCash(p, amount);
    if (!p.alive) return;
    p.cash -= amount;
    renderPlayers();
  }

  async function payToPlayer(payer, receiver, amount, reason) {
    if (amount<=0) return;
    log(`💸 ${payer.name} 支付 $${amount} 給 ${receiver.name}（${reason}）`, payer.isAI===false);
    await ensureCash(payer, amount, receiver);
    if (!payer.alive) return;
    payer.cash -= amount;
    receiver.cash += amount;
    renderPlayers();
  }

  async function ensureCash(p, amount, creditor=null) {
    if (p.cash >= amount) return;
    // 自動抵押：AI自動，人類彈窗協助
    while (p.cash < amount) {
      const available = p.properties.filter(idx => !p.mortgaged.has(idx));
      if (available.length===0) break;
      // 選最值錢抵押
      const candidate = available.map(idx => [idx, tiles[idx]]).sort((a,b) => getPrice(b[1])-getPrice(a[1]))[0][0];
      doMortgage(p, candidate);
    }
    if (p.cash < amount) {
      // 破產
      if (creditor) {
        // 移轉所有資產（含抵押狀態）
        for (const idx of p.properties) {
          creditor.properties.push(idx);
          if (p.mortgaged.has(idx)) creditor.mortgaged.add(idx);
        }
        log(`💥 ${p.name} 破產！資產移轉給 ${creditor.name}`, p.isAI===false);
      } else {
        log(`💥 ${p.name} 破產！資產回收給銀行。`, p.isAI===false);
      }
      p.properties = [];
      p.mortgaged = new Set();
      p.alive = false;
      renderPlayers();
      updateOwners();
      renderTokens();
      checkWin();
      return;
    }
  }

  function getPrice(t) {
    if (t.type==="PROPERTY") return t.price;
    if (t.type==="STATION") return 200;
    if (t.type==="UTILITY") return 150;
    return 0;
  }

  function doMortgage(p, idx) {
    const t = tiles[idx];
    if (!p.properties.includes(idx) || p.mortgaged.has(idx)) return;
    const val = Math.floor(getPrice(t) * 0.5);
    p.mortgaged.add(idx);
    p.cash += val;
    renderPlayers();
    log(`🏦 ${p.name} 抵押《${t.name || t.label}》，取得 $${val}`, p.isAI===false);
  }

  function doUnmortgage(p, idx) {
    const t = tiles[idx];
    if (!p.mortgaged.has(idx)) return;
    const cost = Math.floor(getPrice(t) * 0.5 * 1.1);
    if (p.cash < cost) { log(`現金不足，無法贖回。`, p.isAI===false); return; }
    p.cash -= cost;
    p.mortgaged.delete(idx);
    renderPlayers();
    log(`💳 ${p.name} 贖回《${t.name || t.label}》，支付 $${cost}`, p.isAI===false);
  }

  function goToJail(p) {
    p.inJail = true;
    p.jailTurns = 0;
    p.pos = 10;
    renderTokens();
    $("#turnInfo").textContent = `${p.name} 入獄。`;
  }

  async function drawCard(p, deck, name, diceTotal) {
    const card = deck.shift();
    deck.push(card);
    log(`📜 ${p.name} 抽到 ${name} 卡：${card.text}`, p.isAI===false);
    switch(card.t) {
      case "cash":
        if (card.v >= 0) { p.cash += card.v; renderPlayers(); }
        else { await payToBank(p, -card.v, name); }
        break;
      case "moveTo":
        await moveTo(p, card.idx, true);
        break;
      case "jail":
        goToJail(p); break;
      case "outCard":
        p.outCard += 1; renderPlayers(); break;
      case "repair":
        // MVP 無房屋，略
        break;
      case "collectFromEach":
        for (const other of state.players) {
          if (other===p || !other.alive) continue;
          await payToPlayer(other, p, card.v, `${name}卡`);
        }
        break;
      case "payToEach":
        for (const other of state.players) {
          if (other===p || !other.alive) continue;
          await payToPlayer(p, other, card.v, `${name}卡`);
        }
        break;
      case "nearestUtility":
        await moveToNearest(p, ["UTILITY"], diceTotal, true);
        break;
      case "nearestStation":
        await moveToNearest(p, ["STATION"], diceTotal, true, true);
        break;
      case "back3":
        await moveBack(p, 3);
        await resolveTile(p, diceTotal);
        break;
      case "payTax":
        await payToBank(p, card.v, `${name}卡`);
        break;
      case "marketRush":
        p.rentBonusTemp += (card.bonus||25);
        $("#turnInfo").textContent = "本回合收租 +$25";
        break;
      case "bonusNextGo":
        state.bonusNextGo.add(p);
        break;
    }
  }

  async function moveTo(p, idx, passGoCredit) {
    // 若越過起點可給薪資
    while (p.pos !== idx) {
      p.pos = (p.pos + 1) % 40;
      if (p.pos===0 && passGoCredit) {
        let bonus = START_SALARY;
        if (state.bonusNextGo.has(p)) { bonus += 100; state.bonusNextGo.delete(p); }
        p.cash += bonus; renderPlayers();
        log(`💵 ${p.name} 經過起點，領 $${bonus}`, p.isAI===false);
      }
      renderTokens();
      await sleep(80);
    }
  }
  async function moveToNearest(p, types, diceTotal, thenResolve, doubleRentOnStation=false) {
    let i = p.pos;
    do {
      i = (i + 1) % 40;
      const t = tiles[i];
      if (types.includes(t.type)) {
        await moveTo(p, i, true);
        // 若有主且為車站且 doubleRentOnStation ==> 2x 租
        if (thenResolve) {
          if (t.type==="UTILITY") await onLandUtility(p, t, diceTotal);
          else if (t.type==="STATION") {
            const before = STATION_RENTS.slice();
            if (doubleRentOnStation) {
              // 在 onLandStation 中處理：用 log 提示 +額外計算
              // 這裡設旗標：臨時把 owner 的 rentBonusTemp 大幅+ (但只加一次恐不準)
              // 更簡單：在 onLandStation 內正常算，然後多收同額一次
              const ownerIdx = ownerOf(t.idx);
              if (ownerIdx>=0 && ownerIdx !== state.players.indexOf(p)) {
                // 先計算一次租，然後再付一次
                const owner = state.players[ownerIdx];
                if (!owner.mortgaged.has(t.idx)) {
                  const ownerStations = [5,15,25,35].filter(s => owner.properties.includes(s) && !owner.mortgaged.has(s)).length;
                  const rent = STATION_RENTS[clamp(ownerStations-1, 0, 3)];
                  await payToPlayer(p, owner, rent*2, `雙倍車站租金（機會卡）《${t.name}》`);
                  return;
                }
              }
            }
            await onLandStation(p, t);
          }
        }
        return;
      }
    } while(true);
  }
  async function moveBack(p, steps) {
    for (let i=0;i<steps;i++) {
      p.pos = (p.pos - 1 + 40) % 40;
      renderTokens();
      await sleep(80);
    }
  }

  function showJailOptions(p) {
    if (p.isAI) return;
    const canPay = p.cash >= JAIL_FINE;
    let html = `<p>你在獄中，可選擇：</p>
      <ul>
        <li>支付 $${JAIL_FINE} 立即出獄並擲骰</li>
        <li>${p.outCard>0?"使用 1 張出獄卡":"嘗試擲出雙骰（最多 3 回合）"}</li>
      </ul>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
        <button id="jPay" ${canPay?"":"disabled"} class="ok">付保釋金</button>
        ${p.outCard>0?'<button id="jCard" class="primary">使用出獄卡</button>':''}
        <button id="jTry" class="primary">嘗試擲骰</button>
      </div>`;
    showModal(html, false).then(()=>{}); // 只是顯示
    $("#jPay")?.addEventListener("click", async () => {
      await payToBank(p, JAIL_FINE, "保釋金");
      if (!p.alive) return;
      p.inJail = false; p.jailTurns = 0; $("#modal").classList.add("hidden");
      await onRoll();
    }, {once:true});
    $("#jCard")?.addEventListener("click", async () => {
      if (p.outCard>0) { p.outCard--; p.inJail=false; p.jailTurns=0; renderPlayers(); $("#modal").classList.add("hidden"); await onRoll(); }
    }, {once:true});
    $("#jTry")?.addEventListener("click", async () => {
      $("#modal").classList.add("hidden");
      const [d1,d2] = rollDice();
      const dbl = d1===d2;
      if (dbl) {
        p.inJail=false; p.jailTurns=0;
        log(`${p.name} 擲出雙骰，出獄並移動 ${d1+d2} 步。`, p.isAI===false);
        await moveSteps(p, d1+d2);
        await resolveTile(p, d1+d2);
        $("#btnEnd").disabled = false;
      } else {
        p.jailTurns++;
        log(`${p.name} 未擲出雙骰（第 ${p.jailTurns}/3 回合）。`, p.isAI===false);
        if (p.jailTurns>=3) {
          await payToBank(p, JAIL_FINE, "保釋金");
          if (!p.alive) { $("#btnEnd").disabled = false; return; }
          p.inJail=false; p.jailTurns=0;
          await onRoll();
        } else {
          $("#btnEnd").disabled = false;
        }
      }
    }, {once:true});
  }

  // ---------- AI ----------
  async function aiTurn() {
    const p = state.players[state.cur];
    await sleep(400);
    if (p.inJail) {
      // 策略：前兩回合嘗試擲骰，第三回合付保釋金（若可）
      if (p.jailTurns<2) {
        const [d1,d2] = rollDice();
        const dbl = d1===d2;
        if (dbl) {
          p.inJail=false; p.jailTurns=0;
          log(`${p.name} 擲出雙骰出獄，移動 ${d1+d2} 步。`, true);
          await moveSteps(p, d1+d2);
          await resolveTile(p, d1+d2);
          $("#btnEnd").disabled = false;
          // 若雙骰可加擲
          if (dbl && p.alive && !p.inJail) {
            await sleep(400);
            await onRoll();
          }
          return;
        } else {
          p.jailTurns++;
          log(`${p.name} 嘗試失敗（第 ${p.jailTurns}/3 回合）`, true);
          $("#btnEnd").disabled = false;
          return;
        }
      } else {
        if (p.cash >= JAIL_FINE) {
          await payToBank(p, JAIL_FINE, "保釋金");
          if (!p.alive) { $("#btnEnd").disabled = false; return; }
          p.inJail=false; p.jailTurns=0;
        } else {
          // 抵押再付
          await ensureCash(p, JAIL_FINE);
          if (!p.alive) { $("#btnEnd").disabled = false; return; }
          await payToBank(p, JAIL_FINE, "保釋金");
          if (!p.alive) { $("#btnEnd").disabled = false; return; }
          p.inJail=false; p.jailTurns=0;
        }
      }
    }
    await onRoll();
  }

  // ---------- 事件綁定 ----------
  $("#btnRoll").addEventListener("click", onRoll);

  $("#btnEnd").addEventListener("click", () => {
    // 清理臨時加成
    const p = state.players[state.cur];
    p.rentBonusTemp = 0;
    nextPlayer();
  });

  $("#btnBuy").addEventListener("click", () => {
    if (!state.awaitingBuy) return;
    const p = state.players[state.cur];
    const t = tiles[p.pos];
    let price = (t.type==="PROPERTY") ? t.price : (t.type==="STATION" ? 200 : 150);
    buyProperty(p, t.idx, price);
    state.awaitingBuy = false;
    $("#btnBuy").disabled = true;
    $("#btnSkip").disabled = true;
    $("#btnEnd").disabled = false;
  });

  $("#btnSkip").addEventListener("click", () => {
    state.awaitingBuy = false;
    $("#btnBuy").disabled = true;
    $("#btnSkip").disabled = true;
    $("#btnEnd").disabled = false;
  });

  $("#btnReset").addEventListener("click", () => {
    if (confirm("確定要重新開始？")) {
      initPlayers();
      buildBoard();
      renderTokens();
      $("#btnRoll").disabled = false;
      $("#btnEnd").disabled = true;
      $("#btnBuy").disabled = true;
      $("#btnSkip").disabled = true;
      $("#dice1").textContent = "-";
      $("#dice2").textContent = "-";
      $("#turnInfo").textContent = "";
      $("#log").innerHTML = "";
    }
  });

  // 存讀檔
  $("#btnSave").addEventListener("click", () => {
    const save = JSON.stringify(state, (k,v) => {
      if (k==="mortgaged") return Array.from(v);
      if (k==="bonusNextGo") return Array.from(v).map(pl => state.players.indexOf(pl));
      if (typeof v==="function") return undefined;
      return v;
    });
    localStorage.setItem("tycoon_save", save);
    log("💾 已存檔（本機瀏覽器）。", false);
  });
  $("#btnLoad").addEventListener("click", () => {
    const s = localStorage.getItem("tycoon_save");
    if (!s) { alert("沒有存檔。"); return; }
    const obj = JSON.parse(s);
    // 只還原關鍵欄位
    state.cur = obj.cur;
    state.dice = obj.dice;
    state.doublesInRow = obj.doublesInRow;
    state.awaitingBuy = false;
    state.mustEnd = false;
    state.players = obj.players.map(p => {
      const np = makePlayer(p.name, p.isAI, p.color);
      np.cash = p.cash; np.pos = p.pos; np.inJail = p.inJail; np.jailTurns = p.jailTurns;
      np.outCard = p.outCard; np.properties = p.properties; np.alive = p.alive;
      np.mortgaged = new Set(p.mortgaged||[]);
      np.rentBonusTemp = p.rentBonusTemp||0;
      return np;
    });
    state.bonusNextGo = new Set((obj.bonusNextGo||[]).map(i => state.players[i]));
    renderPlayers(); buildBoard(); renderTokens();
    $("#btnRoll").disabled = state.players[state.cur].isAI;
    $("#btnEnd").disabled = true;
    log("📂 已讀檔。", false);
  });

  // ---------- 初始化 ----------
  initPlayers();
  buildBoard();
  renderTokens();
  $("#btnEnd").disabled = true;
})();