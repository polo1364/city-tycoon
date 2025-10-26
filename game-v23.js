// 城市資本戰 Web 版 v2.3：棋子移動 + 5段建屋 + 經濟升級 + 直式優化
"use strict";
(function(){
  var diagEl = document.getElementById('diag');
  function diagOK(msg){ if (diagEl){ diagEl.className=''; diagEl.textContent='✅ '+msg; } }
  function diagERR(msg){ if (diagEl){ diagEl.className='err'; diagEl.textContent='🚨 '+msg; } }

  window.addEventListener('error', function(e){ diagERR('JS 錯誤：'+(e.message||e)); });
  window.addEventListener('unhandledrejection', function(e){ diagERR('Promise 錯誤：'+(e.reason&&e.reason.message||e.reason)); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function boot(){ try{ main(); diagOK("v2.3 初始化完成。"); }catch(err){ diagERR("初始化失敗："+(err&&err.message||err)); console.error(err); } }

  function main(){
    var $ = function(s){ return document.querySelector(s); };
    var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
    function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
    function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
    function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

    // ----- 經濟參數（提高整體金額） -----
    var START_SALARY = 400;   // 起點薪資
    var JAIL_FINE = 100;      // 保釋金
    var STATION_RENTS = [40,80,160,320]; // 車站租金升級
    var BASE_RENT_FACTOR = 0.18; // 地產基礎租金從 12% -> 18%

    var COLORS = {brown:"#8d5524",lightBlue:"#7ab6ff",pink:"#ff8dc7",orange:"#ffa14a",red:"#ff6b6b",yellow:"#ffd93d",green:"#28c76f",darkBlue:"#5470ff"};
    var HOUSE_COST = { // 建屋成本（每棟），按顏色群
      brown:100, lightBlue:100, pink:150, orange:150, red:200, yellow:200, green:250, darkBlue:300
    };
    var HOUSE_MULT = [1,3,5,7,9,12]; // 0~4 棟與 5（旅館）的租金倍率（相對 baseRent）

    // ----- 地圖 -----
    var tiles = [
      {idx:0,type:"START",label:"起點"},
      {idx:1,type:"PROPERTY",name:"老街",group:"brown",price:60},
      {idx:2,type:"CHEST",label:"命運"},
      {idx:3,type:"PROPERTY",name:"碼頭邊",group:"brown",price:60},
      {idx:4,type:"TAX",amount:300,label:"所得稅"},
      {idx:5,type:"STATION",name:"北站"},
      {idx:6,type:"PROPERTY",name:"松柏里",group:"lightBlue",price:100},
      {idx:7,type:"CHANCE",label:"機會"},
      {idx:8,type:"PROPERTY",name:"晴川街",group:"lightBlue",price:100},
      {idx:9,type:"PROPERTY",name:"望海巷",group:"lightBlue",price:120},
      {idx:10,type:"JAIL",label:"監獄／探監"},
      {idx:11,type:"PROPERTY",name:"春申坊",group:"pink",price:140},
      {idx:12,type:"UTILITY",name:"水務局"},
      {idx:13,type:"PROPERTY",name:"晴嶺道",group:"pink",price:140},
      {idx:14,type:"PROPERTY",name:"虹橋口",group:"pink",price:160},
      {idx:15,type:"STATION",name:"東站"},
      {idx:16,type:"PROPERTY",name:"琥珀道",group:"orange",price:180},
      {idx:17,type:"CHEST",label:"命運"},
      {idx:18,type:"PROPERTY",name:"桂花里",group:"orange",price:180},
      {idx:19,type:"PROPERTY",name:"柑園街",group:"orange",price:200},
      {idx:20,type:"FREE",label:"休息／免費停車"},
      {idx:21,type:"PROPERTY",name:"丹楓道",group:"red",price:220},
      {idx:22,type:"CHANCE",label:"機會"},
      {idx:23,type:"PROPERTY",name:"暮霞巷",group:"red",price:220},
      {idx:24,type:"PROPERTY",name:"赤城門",group:"red",price:240},
      {idx:25,type:"STATION",name:"南站"},
      {idx:26,type:"PROPERTY",name:"金河灣",group:"yellow",price:260},
      {idx:27,type:"PROPERTY",name:"日耀路",group:"yellow",price:260},
      {idx:28,type:"UTILITY",name:"電力局"},
      {idx:29,type:"PROPERTY",name:"曦光道",group:"yellow",price:280},
      {idx:30,type:"GOTOJAIL",label:"入獄"},
      {idx:31,type:"PROPERTY",name:"翠微里",group:"green",price:300},
      {idx:32,type:"PROPERTY",name:"青泉街",group:"green",price:300},
      {idx:33,type:"CHEST",label:"命運"},
      {idx:34,type:"PROPERTY",name:"森海巷",group:"green",price:320},
      {idx:35,type:"STATION",name:"西站"},
      {idx:36,type:"CHANCE",label:"機會"},
      {idx:37,type:"PROPERTY",name:"星光城",group:"darkBlue",price:350},
      {idx:38,type:"TAX",amount:150,label:"豪華稅"},
      {idx:39,type:"PROPERTY",name:"雲頂塔",group:"darkBlue",price:400}
    ];

    function baseRent(price){ return Math.round(price*BASE_RENT_FACTOR); }
    function getPrice(t){ if (t.type==="PROPERTY") return t.price; if (t.type==="STATION") return 200; if (t.type==="UTILITY") return 150; return 0; }
    function idxToCoord(i){ if (i<=10) return {r:10,c:i}; if (i<=20) return {r:10-(i-10),c:10}; if (i<=30) return {r:0,c:10-(i-20)}; return {r:i-30,c:0}; }

    // ----- 狀態 -----
    var state = {
      players: [], cur:0, dice:[0,0], doublesInRow:0,
      awaitingBuy:false, mustEnd:false, bonusNextGo:[], logSeq:0,
      houses:{} // { [idx]: 0..5 }
    };
    var PlayerColors = ["#e74c3c","#2980b9","#27ae60","#8e44ad"];

    function uuid(){ try{ if (window.crypto && typeof window.crypto.randomUUID==='function') return window.crypto.randomUUID(); }catch(e){} return 'p-'+Math.random().toString(36).slice(2); }
    function makePlayer(name,isAI,color){ return { id: uuid(), name:name, isAI:isAI, color:color, cash:3000, pos:0, inJail:false, jailTurns:0, outCard:0, properties:[], mortgaged:[], alive:true, rentBonusTemp:0 }; }
    function initPlayers(){
      state.players=[
        makePlayer("你",false,PlayerColors[0]),
        makePlayer("蒼嶺",true,PlayerColors[1]),
        makePlayer("星河",true,PlayerColors[2]),
        makePlayer("雲岫",true,PlayerColors[3])
      ];
      state.cur=0; state.dice=[0,0]; state.doublesInRow=0; state.awaitingBuy=false; state.mustEnd=false; state.bonusNextGo=[]; state.houses={};
      renderPlayers(); log("🎮 v2.3 開始：起始資金 $3000，房屋系統啟用。", false);
    }

    // ----- 棋盤與棋子 -----
    function buildBoard(){
      var board=document.getElementById('board'); board.innerHTML='<div id="toast" class="toast hidden"></div>';
      for (var r=0;r<11;r++){ for (var c=0;c<11;c++){ var cell=document.createElement('div'); cell.className='tile empty'; cell.style.gridRow=(r+1); cell.style.gridColumn=(c+1); board.appendChild(cell); } }
      for (var k=0;k<tiles.length;k++){
        var t=tiles[k]; var pos=idxToCoord(t.idx); var cell=document.createElement('div'); cell.className='tile'; cell.style.gridRow=(pos.r+1); cell.style.gridColumn=(pos.c+1);
        var cls=""; if (t.type==="PROPERTY") cls="property"; if (t.type==="STATION") cls="station"; if (t.type==="UTILITY") cls="utility"; if (t.type==="TAX") cls="tax"; if (t.type==="CHANCE") cls="chance"; if (t.type==="CHEST") cls="chest"; if (t.type==="GOTOJAIL") cls="gotojail"; if (t.type==="JAIL") cls="jail"; if (t.type==="START") cls="start"; if (t.type==="FREE") cls="free"; if ([0,10,20,30].indexOf(t.idx)>=0) cell.classList.add('corner'); if (cls) cell.classList.add(cls);
        var label=document.createElement('div'); label.className='label'; label.textContent=t.name||t.label||""; cell.appendChild(label);
        if (t.type==="PROPERTY"){ var colorbar=document.createElement('div'); colorbar.className='colorbar'; colorbar.style.background=COLORS[t.group]||"#ccc"; cell.prepend(colorbar); var price=document.createElement('div'); price.className='price'; var p=t.price; var r0=baseRent(p); price.textContent="$"+p+"｜租$"+r0; cell.appendChild(price); }
        if (t.type==="STATION"||t.type==="UTILITY"){ var price2=document.createElement('div'); price2.className='price'; price2.textContent="可購買"; cell.appendChild(price2); }
        var owner=document.createElement('div'); owner.className='owner'; owner.style.display='none'; owner.setAttribute('data-idx', t.idx); cell.appendChild(owner);
        // 房屋顯示
        var hs=document.createElement('div'); hs.className='house-stack'; hs.setAttribute('data-hidx', t.idx); cell.appendChild(hs);
        board.appendChild(cell);
      }
      renderTokens(); updateOwners(); renderHouses();
    }
    function renderTokens(){
      $$('.token').forEach(function(e){ e.remove(); });
      for (var i=0;i<state.players.length;i++){
        var p=state.players[i]; if (!p.alive) continue; var pos=idxToCoord(p.pos);
        var cell=document.querySelector('#board > .tile[style*="grid-row: '+(pos.r+1)+';"][style*="grid-column: '+(pos.c+1)+';"]');
        var tok=document.createElement('div'); tok.className='token'; tok.style.background=p.color; tok.setAttribute('data-p', String(i+1)); if (cell) cell.appendChild(tok);
      }
    }
    function updateOwners(){
      $$('.owner').forEach(function(el){ el.style.display='none'; });
      for (var pi=0;pi<state.players.length;pi++){ var pl=state.players[pi]; if (!pl.alive) continue; for (var j=0;j<pl.properties.length;j++){ var idx=pl.properties[j]; var pos=idxToCoord(idx); var cell=document.querySelector('#board > .tile[style*="grid-row: '+(pos.r+1)+';"][style*="grid-column: '+(pos.c+1)+';"] .owner'); if (cell){ cell.style.display='block'; cell.style.background=pl.color; } } }
    }
    function renderHouses(){
      $$('.house-stack').forEach(function(s){ s.innerHTML=''; });
      Object.keys(state.houses).forEach(function(k){
        var idx=Number(k), n=state.houses[k]|0; if (!n) return;
        var holder=document.querySelector('.house-stack[data-hidx="'+idx+'"]'); if (!holder) return;
        if (n===5){ var h=document.createElement('div'); h.className='hotel'; holder.appendChild(h); return; }
        for (var i=0;i<n;i++){ var x=document.createElement('div'); x.className='house'; holder.appendChild(x); }
      });
    }

    function renderPlayers(){
      var panel=document.getElementById('playersPanel'); var html=""; for (var i=0;i<state.players.length;i++){ var p=state.players[i]; if (!p.alive) continue; html+='<div class="row"><div class="swatch" style="background:'+p.color+'"></div><div class="name">'+(i===state.cur?"⭐ ":"")+p.name+(p.inJail?"（獄）":"")+(p.outCard>0?"🃏":"")+'</div><div class="cash">$'+p.cash+'</div></div>'; } panel.innerHTML=html; document.getElementById('currentPlayer').textContent = state.players[state.cur].name;
    }
    function toast(msg){ var t=document.getElementById('toast'); if (!t) return; t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toast._tid); toast._tid=setTimeout(function(){ t.classList.add('hidden'); }, 1500); }
    function log(msg, highlightMe){ if (highlightMe===void 0) highlightMe=false; var logEl=document.getElementById('log'); var div=document.createElement('div'); div.className='entry'+(highlightMe?' me':''); div.textContent=msg; logEl.prepend(div); toast(msg); }

    function endTurn(){ var p=state.players[state.cur]; p.rentBonusTemp=0; nextPlayer(); }
    function nextPlayer(){ do { state.cur=(state.cur+1)%state.players.length; } while(!state.players[state.cur].alive); state.dice=[0,0]; state.doublesInRow=0; state.awaitingBuy=false; state.mustEnd=false; renderPlayers(); $('#btnRoll').disabled = state.players[state.cur].isAI; $('#btnEnd').disabled = true; $('#btnBuy').disabled = true; $('#btnSkip').disabled = true; $('#dice1').textContent='-'; $('#dice2').textContent='-'; $('#turnInfo').textContent=''; if (checkWin()) return; if (state.players[state.cur].isAI) { aiTurn(); } else { if (state.players[state.cur].inJail) showJailOptions(state.players[state.cur]); } }
    function checkWin(){ var alive=state.players.filter(function(p){ return p.alive; }); if (alive.length===1){ showModal('🏆 '+alive[0].name+' 獲勝！（其他玩家皆已破產）'); $('#btnRoll').disabled=true; $('#btnEnd').disabled=true; return true; } return false; }

    function showModal(html, withCancel){ if (withCancel===void 0) withCancel=false; $('#modalBody').innerHTML=html; $('#modal').classList.remove('hidden'); $('#modalCancel').style.display = withCancel?'inline-flex':'none';
      return new Promise(function(resolve){ function ok(){ $('#modal').classList.add('hidden'); $('#modalOk').removeEventListener('click', ok); $('#modalCancel').removeEventListener('click', cancel); resolve(true); } function cancel(){ $('#modal').classList.add('hidden'); $('#modalOk').removeEventListener('click', ok); $('#modalCancel').removeEventListener('click', cancel); resolve(false); } $('#modalOk').addEventListener('click', ok, {once:true}); $('#modalCancel').addEventListener('click', cancel, {once:true}); });
    }

    // ---- 擲骰與移動（逐格動畫） ----
    function rollDice(){ var d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6); state.dice=[d1,d2]; $('#dice1').textContent=d1; $('#dice2').textContent=d2; return [d1,d2]; }
    async function onRoll(){ var p=state.players[state.cur]; if (p.inJail) return {again:false}; $('#btnRoll').disabled=true; var d=rollDice(), d1=d[0], d2=d[1]; var isDouble=d1===d2; if (isDouble){ state.doublesInRow++; if (state.doublesInRow>=3){ log('⚠️ '+p.name+' 連續第三次擲出雙骰，被送入獄。', !p.isAI); goToJail(p); $('#btnEnd').disabled=false; return {again:false}; } } else { state.doublesInRow=0; } await moveSteps(p, d1+d2); await resolveTile(p, d1+d2); if (isDouble && p.alive && !p.inJail){ $('#turnInfo').textContent='雙骰！你可再擲一次。'; $('#btnRoll').disabled=false; $('#btnEnd').disabled=true; return {again:true}; } else { $('#btnEnd').disabled=false; return {again:false}; } }
    async function moveSteps(p, steps){ for (var i=0;i<steps;i++){ p.pos=(p.pos+1)%40; if (p.pos===0){ var bonus=START_SALARY; var bi=state.bonusNextGo.indexOf(p.id); if (bi>=0){ bonus+=100; state.bonusNextGo.splice(bi,1); } p.cash+=bonus; renderPlayers(); log('💵 '+p.name+' 經過起點，領 $'+bonus, !p.isAI); } renderTokens(); await sleep(120); } }

    // ---- 所有權與群組 ----
    function ownerOf(idx){ for (var i=0;i<state.players.length;i++){ var pl=state.players[i]; if (!pl.alive) continue; if (pl.properties.indexOf(idx)>=0) return i; } return -1; }
    function groupSlots(groupId){ return tiles.filter(function(t){ return t.type==="PROPERTY" && t.group===groupId; }).map(function(t){ return t.idx; }); }
    function groupOwnedCount(ownerIdx, groupId){ var slots=groupSlots(groupId); var pl=state.players[ownerIdx]; var cnt=0; for (var k=0;k<slots.length;k++){ var idx=slots[k]; if (pl.properties.indexOf(idx)>=0 && pl.mortgaged.indexOf(idx)<0) cnt++; } return {cnt:cnt,total:slots.length}; }
    function hasMonopoly(ownerIdx, groupId){ var g=groupOwnedCount(ownerIdx, groupId); return g.cnt===g.total && g.total>0; }

    // ---- 建屋／賣屋邏輯 ----
    function houseCount(idx){ return state.houses[idx]|0; }
    function canBuildHere(p, idx){
      var t=tiles[idx]; if (t.type!=="PROPERTY") return false;
      if (p.properties.indexOf(idx)<0) return false;
      if (p.mortgaged.indexOf(idx)>=0) return false;
      if (!hasMonopoly(state.cur, t.group)) return false;
      var n=houseCount(idx); if (n>=5) return false;
      // 均衡建屋：差距不可超過 1
      var gs=groupSlots(t.group); var arr=gs.map(houseCount);
      return n<=Math.min.apply(null, arr)+1;
    }
    function canSellHouseHere(p, idx){
      var t=tiles[idx]; if (t.type!=="PROPERTY") return false;
      if (p.properties.indexOf(idx)<0) return false;
      var n=houseCount(idx); if (n<=0) return false;
      // 均衡賣屋（反向）：只能從該組最大值格先賣
      var gs=groupSlots(t.group); var arr=gs.map(houseCount); var max=Math.max.apply(null, arr);
      return n===max;
    }
    function buildCost(idx){ var g=tiles[idx].group; return HOUSE_COST[g]||150; }
    function sellValue(idx){ return Math.floor(buildCost(idx)*0.5); }

    // ---- 地格處理 ----
    async function resolveTile(p, diceTotal){
      var t=tiles[p.pos];
      if (t.type==="PROPERTY") await onLandProperty(p,t);
      else if (t.type==="STATION") await onLandStation(p,t);
      else if (t.type==="UTILITY") await onLandUtility(p,t,diceTotal);
      else if (t.type==="TAX") await payToBank(p,t.amount,'稅金');
      else if (t.type==="CHANCE") await drawCard(p, chanceDeck, '機會', diceTotal);
      else if (t.type==="CHEST") await drawCard(p, chestDeck, '命運', diceTotal);
      else if (t.type==="GOTOJAIL") goToJail(p);
      else if (t.type==="JAIL") log(p.name+' 只是來探監。', !p.isAI);
      else if (t.type==="FREE") log(p.name+' 於休息區放鬆片刻。', !p.isAI);
    }

    function rentForProperty(ownerIdx, t){
      var base = baseRent(t.price);
      var h = houseCount(t.idx);
      if (h>0) return base * HOUSE_MULT[clamp(h,0,5)];
      // 無房：若擁有整組，租金 *2
      var mono = hasMonopoly(ownerIdx, t.group);
      return base * (mono?2:1);
    }

    // ---- 觸地邏輯 ----
    async function onLandProperty(p,t){
      var idx=t.idx, ownerIdx=ownerOf(idx);
      if (ownerIdx<0){
        if (!p.isAI){
          var canBuy=p.cash>=t.price; $('#btnBuy').disabled=!canBuy; $('#btnSkip').disabled=false; state.awaitingBuy=true; $('#turnInfo').textContent=canBuy?('可用 $'+t.price+' 購買《'+t.name+'》'):'資金不足，無法購買。';
        } else {
          if (aiShouldBuyProperty(p,t)) buyProperty(p, idx, t.price); else log('🤔 '+p.name+' 放棄購買《'+t.name+'》', true);
        }
      } else if (ownerIdx===state.cur){
        log(p.name+' 來到自己的地《'+t.name+'》。', !p.isAI);
      } else {
        var owner=state.players[ownerIdx]; if (owner.mortgaged.indexOf(idx)>=0){ log('《'+t.name+'》已抵押，免租。', !p.isAI); return; }
        var rent=rentForProperty(ownerIdx, t) + (owner.rentBonusTemp||0);
        await payToPlayer(p, owner, rent, '租金：《'+t.name+'》');
      }
    }
    async function onLandStation(p,t){
      var idx=t.idx, ownerIdx=ownerOf(idx);
      if (ownerIdx<0){
        var price=200;
        if (!p.isAI){ $('#turnInfo').textContent='可用 $'+price+' 購買《'+t.name+'》'; state.awaitingBuy=true; $('#btnBuy').disabled=!(p.cash>=price); $('#btnSkip').disabled=false; }
        else { if (aiShouldBuyStation(p)) buyProperty(p, idx, price); else log('🤔 '+p.name+' 放棄購買《'+t.name+'》', true); }
      } else if (ownerIdx===state.cur){
        log(p.name+' 來到自己的《'+t.name+'》。', !p.isAI);
      } else {
        var owner=state.players[ownerIdx]; if (owner.mortgaged.indexOf(idx)>=0){ log('《'+t.name+'》已抵押，免租。', !p.isAI); return; }
        var ownerStations=[5,15,25,35].filter(function(s){ return owner.properties.indexOf(s)>=0 && owner.mortgaged.indexOf(s)<0; }).length;
        var rent=STATION_RENTS[clamp(ownerStations-1,0,3)] + (owner.rentBonusTemp||0);
        await payToPlayer(p, owner, rent, '車站租金：《'+t.name+'》');
      }
    }
    async function onLandUtility(p,t,diceTotal){
      var idx=t.idx, ownerIdx=ownerOf(idx);
      if (ownerIdx<0){
        var price=150;
        if (!p.isAI){ $('#turnInfo').textContent='可用 $'+price+' 購買《'+t.name+'》'; state.awaitingBuy=true; $('#btnBuy').disabled=!(p.cash>=price); $('#btnSkip').disabled=false; }
        else { if (aiShouldBuyUtility(p)) buyProperty(p, idx, price); else log('🤔 '+p.name+' 放棄購買《'+t.name+'》', true); }
      } else if (ownerIdx===state.cur){
        log(p.name+' 來到自己的《'+t.name+'》。', !p.isAI);
      } else {
        var owner=state.players[ownerIdx]; if (owner.mortgaged.indexOf(idx)>=0){ log('《'+t.name+'》已抵押，免租。', !p.isAI); return; }
        var both=[12,28].every(function(u){ return owner.properties.indexOf(u)>=0 && owner.mortgaged.indexOf(u)<0; });
        var rate=both?10:4; var rent=diceTotal*rate + (owner.rentBonusTemp||0);
        await payToPlayer(p, owner, rent, '事業費用：《'+t.name+'》 '+rate+'×點數');
      }
    }

    // ---- 付款與破產 ----
    async function payToBank(p, amount, reason){ if (amount<=0) return; log('🏦 '+p.name+' 支付銀行 $'+amount+'（'+reason+'）', !p.isAI); await ensureCash(p, amount); if (!p.alive) return; p.cash-=amount; renderPlayers(); }
    async function payToPlayer(payer,receiver,amount,reason){
      if (amount<=0) return; log('💸 '+payer.name+' 支付 $'+amount+' 給 '+receiver.name+'（'+reason+'）', !payer.isAI);
      await ensureCash(payer, amount, receiver); if (!payer.alive) return; payer.cash-=amount; receiver.cash+=amount; renderPlayers();
    }
    async function ensureCash(p, need, creditor){
      if (p.cash >= need) return;
      // 先賣屋（從高價群、房數多者開始；均衡規則反向）
      var propWithHouses = p.properties.filter(function(idx){ return (state.houses[idx]|0) > 0; });
      // sort by cost desc then house count desc
      propWithHouses.sort(function(a,b){
        var ca = buildCost(a), cb = buildCost(b);
        var ha = houseCount(a), hb = houseCount(b);
        if (cb!==ca) return cb-ca;
        return hb-ha;
      });
      for (var i=0;i<propWithHouses.length && p.cash<need;i++){
        var idx = propWithHouses[i];
        if (canSellHouseHere(p, idx)){
          state.houses[idx] = houseCount(idx)-1;
          var val = sellValue(idx);
          p.cash += val;
          renderHouses(); renderPlayers();
          log('🔧 '+p.name+' 出售一棟房（《'+tiles[idx].name+'》），回收 $'+val, !p.isAI);
          i = -1; // 重新排序，以符合均衡賣屋
          propWithHouses = p.properties.filter(function(x){ return (state.houses[x]|0) > 0; });
          propWithHouses.sort(function(a,b){
            var ca = buildCost(a), cb = buildCost(b);
            var ha = houseCount(a), hb = houseCount(b);
            if (cb!==ca) return cb-ca;
            return hb-ha;
          });
        }
      }
      if (p.cash >= need) return;
      // 再抵押
      var candidates = p.properties.filter(function(idx){ return p.mortgaged.indexOf(idx)<0 && (state.houses[idx]|0)===0; })
        .map(function(idx){ return {idx:idx, price:getPrice(tiles[idx])}; })
        .sort(function(a,b){ return a.price - b.price; });
      for (var j=0;j<candidates.length && p.cash<need;j++){
        doMortgage(p, candidates[j].idx);
        await sleep(60);
      }
      if (p.cash >= need) return;
      // 全部手段用盡：破產
      if (creditor){
        for (var k=0;k<p.properties.length;k++){
          var idx2 = p.properties[k];
          if (creditor.properties.indexOf(idx2)<0) creditor.properties.push(idx2);
          if (p.mortgaged.indexOf(idx2)>=0 && creditor.mortgaged.indexOf(idx2)<0) creditor.mortgaged.push(idx2);
          if (state.houses[idx2]){ // 房屋隨產移交
            state.houses[idx2] = state.houses[idx2]; // keep same
          }
        }
      } else {
        // 收歸銀行：清除房屋
        p.properties.forEach(function(x){ delete state.houses[x]; });
      }
      p.properties = []; p.mortgaged = []; p.cash = 0; p.alive = false;
      renderPlayers(); updateOwners(); renderHouses(); renderTokens();
      log('💥 '+p.name+' 無力支付，宣告破產'+(creditor?('，資產移交給 '+creditor.name):'，資產收歸銀行')+'。', !p.isAI);
    }

    function doMortgage(p, idx){ var t=tiles[idx]; if (p.properties.indexOf(idx)<0 || p.mortgaged.indexOf(idx)>=0) return; if (houseCount(idx)>0) return; var val=Math.floor(getPrice(t)*0.5); p.mortgaged.push(idx); p.cash+=val; renderPlayers(); log('🏦 '+p.name+' 抵押《'+(t.name||t.label)+'》，取得 $'+val, !p.isAI); }
    function doUnmortgage(p, idx){ var t=tiles[idx]; var mi=p.mortgaged.indexOf(idx); if (mi<0) return; var cost=Math.floor(getPrice(t)*0.5*1.1); if (p.cash<cost){ log('現金不足，無法贖回。', !p.isAI); return; } p.cash-=cost; p.mortgaged.splice(mi,1); renderPlayers(); log('💳 '+p.name+' 贖回《'+(t.name||t.label)+'》，支付 $'+cost, !p.isAI); }
    function goToJail(p){ p.inJail=true; p.jailTurns=0; p.pos=10; renderTokens(); $('#turnInfo').textContent=p.name+' 入獄。'; }

    // ---- 卡牌（保留原邏輯，金額沿用新參數） ----
    var chestDeck = shuffle([
      {t:"cash",v:+200,text:"城市補助，領 $200"},
      {t:"cash",v:+100,text:"退稅，領 $100"},
      {t:"cash",v:-100,text:"醫療費，付 $100"},
      {t:"cash",v:+150,text:"公司紅利，領 $150"},
      {t:"cash",v:-50,text:"罰款，付 $50"},
      {t:"moveTo",idx:0,text:"前進到起點並領薪"},
      {t:"jail",text:"直接入獄"},
      {t:"outCard",text:"獲得出獄卡"},
      {t:"collectFromEach",v:50,text:"顧問費：每位玩家付你 $50"},
      {t:"payToEach",v:25,text:"捐助：你付每位玩家 $25"},
      {t:"nearestUtility",text:"前進到最近的事業格（若有主付 10×點數；無主可買）"}
    ]);
    var chanceDeck = shuffle([
      {t:"moveTo",idx:0,text:"前進到起點並領薪"},
      {t:"nearestStation",text:"前進到最近的車站（若有主付 2×租金；無主可買）"},
      {t:"jail",text:"直接入獄"},
      {t:"outCard",text:"獲得出獄卡"},
      {t:"cash",v:+150,text:"抽中彩券，領 $150"},
      {t:"cash",v:-75,text:"收到罰單，付 $75"},
      {t:"back3",text:"回退 3 格"},
      {t:"payTax",v:200,text:"稅務稽核，支付 $200"},
      {t:"moveTo",idx:24,text:"前進到『赤城門』"},
      {t:"moveTo",idx:39,text:"前進到『雲頂塔』"},
      {t:"marketRush",text:"收租大月：本回合你收租 +$25",bonus:+25},
      {t:"bonusNextGo",text:"下次經過起點 +$100"}
    ]);
    async function drawCard(p, deck, name, diceTotal){
      var card=deck.shift(); deck.push(card); log('📜 '+p.name+' 抽到 '+name+' 卡：'+card.text, !p.isAI);
      switch(card.t){
        case "cash": if (card.v>=0){ p.cash+=card.v; renderPlayers(); } else { await payToBank(p, -card.v, name); } break;
        case "moveTo": await moveTo(p, card.idx, true); break;
        case "jail": goToJail(p); break;
        case "outCard": p.outCard+=1; renderPlayers(); break;
        case "collectFromEach": for (var i=0;i<state.players.length;i++){ var other=state.players[i]; if (other===p || !other.alive) continue; await payToPlayer(other, p, card.v, name+'卡'); } break;
        case "payToEach": for (var j=0;j<state.players.length;j++){ var o=state.players[j]; if (o===p || !o.alive) continue; await payToPlayer(p, o, card.v, name+'卡'); } break;
        case "nearestUtility": await moveToNearest(p, ["UTILITY"], diceTotal, true); break;
        case "nearestStation": await moveToNearest(p, ["STATION"], diceTotal, true, true); break;
        case "back3": await moveBack(p, 3); await resolveTile(p, diceTotal); break;
        case "payTax": await payToBank(p, card.v, name+'卡'); break;
        case "marketRush": p.rentBonusTemp += (card.bonus||25); $('#turnInfo').textContent='本回合收租 +$25'; break;
        case "bonusNextGo": if (state.bonusNextGo.indexOf(p.id)<0) state.bonusNextGo.push(p.id); break;
      }
    }
    async function moveTo(p, idx, passGoCredit){ while (p.pos!==idx){ p.pos=(p.pos+1)%40; if (p.pos===0 && passGoCredit){ var bonus=START_SALARY; var bi=state.bonusNextGo.indexOf(p.id); if (bi>=0){ bonus+=100; state.bonusNextGo.splice(bi,1); } p.cash+=bonus; renderPlayers(); log('💵 '+p.name+' 經過起點，領 $'+bonus, !p.isAI); } renderTokens(); await sleep(80); } }
    async function moveToNearest(p, types, diceTotal, thenResolve, doubleRentOnStation){
      var i=p.pos; while (true){ i=(i+1)%40; var t=tiles[i]; if (types.indexOf(t.type)>=0){ await moveTo(p, i, true);
        if (thenResolve){ if (t.type==="UTILITY") await onLandUtility(p, t, diceTotal); else if (t.type==="STATION"){ var ownerIdx=ownerOf(t.idx); if (doubleRentOnStation && ownerIdx>=0 && ownerIdx!==state.cur){ var owner=state.players[ownerIdx]; if (owner.mortgaged.indexOf(t.idx)<0){ var ownerStations=[5,15,25,35].filter(function(s){ return owner.properties.indexOf(s)>=0 && owner.mortgaged.indexOf(s)<0; }).length; var rent=STATION_RENTS[clamp(ownerStations-1,0,3)]; await payToPlayer(p, owner, rent*2, '雙倍車站租金（機會卡）《'+t.name+'》'); return; } } await onLandStation(p, t); } } return; } }
    async function moveBack(p, steps){ for (var i=0;i<steps;i++){ p.pos=(p.pos-1+40)%40; renderTokens(); await sleep(80); } }

    // ---- 監獄 ----
    function showJailOptions(p){
      if (p.isAI) return;
      var canPay=p.cash>=JAIL_FINE;
      var html='<p>你在獄中，可選擇：</p><ul><li>支付 $'+JAIL_FINE+' 立即出獄並擲骰</li><li>'+(p.outCard>0?'使用 1 張出獄卡':'嘗試擲出雙骰（最多 3 回合）')+'</li></ul><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><button id="jPay" '+(canPay?'':'disabled')+' class="ok">付保釋金</button>'+(p.outCard>0?'<button id="jCard" class="primary">使用出獄卡</button>':'')+'<button id="jTry" class="primary">嘗試擲骰</button></div>';
      showModal(html,false).then(function(){});
      var jPay=document.getElementById('jPay'); if (jPay) jPay.addEventListener('click', async function(){ await payToBank(p,JAIL_FINE,'保釋金'); if (!p.alive) return; p.inJail=false; p.jailTurns=0; document.getElementById('modal').classList.add('hidden'); await onRoll(); }, {once:true});
      var jCard=document.getElementById('jCard'); if (jCard) jCard.addEventListener('click', async function(){ if (p.outCard>0){ p.outCard--; p.inJail=false; p.jailTurns=0; renderPlayers(); document.getElementById('modal').classList.add('hidden'); await onRoll(); } }, {once:true});
      var jTry=document.getElementById('jTry'); if (jTry) jTry.addEventListener('click', async function(){ document.getElementById('modal').classList.add('hidden'); var d=rollDice(), d1=d[0], d2=d[1], dbl=d1===d2; if (dbl){ p.inJail=false; p.jailTurns=0; log(p.name+' 擲出雙骰，出獄並移動 '+(d1+d2)+' 步。', !p.isAI); await moveSteps(p, d1+d2); await resolveTile(p, d1+d2); document.getElementById('btnEnd').disabled=false; } else { p.jailTurns++; log(p.name+' 未擲出雙骰（第 '+p.jailTurns+'/3 回合）。', !p.isAI); if (p.jailTurns>=3){ await payToBank(p, JAIL_FINE, '保釋金'); if (!p.alive){ document.getElementById('btnEnd').disabled=false; return; } p.inJail=false; p.jailTurns=0; await onRoll(); } else { document.getElementById('btnEnd').disabled=false; } } }, {once:true});
    }

    // ---- 資產面板（建屋） ----
    function showAssets(){
      var wrap=document.getElementById('assetsBody'); var me=state.players[state.cur];
      var rows = [];
      me.properties.forEach(function(idx){
        var t=tiles[idx];
        var mort = me.mortgaged.indexOf(idx)>=0;
        var hc = houseCount(idx);
        var canB = canBuildHere(me, idx);
        var canS = canSellHouseHere(me, idx);
        var cost = buildCost(idx);
        rows.push('<tr><td>'+t.name+'</td><td>'+(t.group||'-')+'</td><td>'+(mort?'抵押':'正常')+'</td><td>'+hc+(hc===5?'（🏨）':'')+'</td><td>$'+cost+'</td><td><button data-op="build" data-idx="'+idx+'" '+(canB?'':'disabled')+'>＋建屋</button><button data-op="sell" data-idx="'+idx+'" '+(canS?'':'disabled')+'>－賣屋</button>'+(mort?'' : ' <button data-op="mortgage" data-idx="'+idx+'">抵押</button>')+(mort?(' <button data-op="unmortgage" data-idx="'+idx+'">贖回</button>'):'')+'</td></tr>');
      });
      var html = '<table class="asset-table"><thead><tr><th>地名</th><th>色組</th><th>狀態</th><th>房數</th><th>建屋費</th><th>操作</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
      wrap.innerHTML = html;
      wrap.querySelectorAll('button[data-op]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var op = btn.getAttribute('data-op'); var idx = Number(btn.getAttribute('data-idx'));
          if (op==='build'){ tryBuild(me, idx); }
          else if (op==='sell'){ trySellHouse(me, idx); }
          else if (op==='mortgage'){ doMortgage(me, idx); }
          else if (op==='unmortgage'){ doUnmortgage(me, idx); }
          showAssets(); renderPlayers(); updateOwners(); renderHouses();
        });
      });
      document.getElementById('assetsPanel').classList.remove('hidden');
    }
    function tryBuild(p, idx){
      if (!canBuildHere(p, idx)) return;
      var cost = buildCost(idx);
      if (p.cash < cost){ log('現金不足，無法建屋。', !p.isAI); return; }
      p.cash -= cost; state.houses[idx] = houseCount(idx)+1;
      renderPlayers(); renderHouses(); log('🏠 '+p.name+' 在《'+tiles[idx].name+'》建造 1 棟（現有 '+houseCount(idx)+'）', !p.isAI);
    }
    function trySellHouse(p, idx){
      if (!canSellHouseHere(p, idx)) return;
      state.houses[idx] = houseCount(idx)-1;
      var val = sellValue(idx); p.cash += val;
      renderPlayers(); renderHouses(); log('🔧 '+p.name+' 賣出 1 棟（《'+tiles[idx].name+'》），回收 $'+val, !p.isAI);
    }

    // ---- AI 策略（升級版本） ----
    function aiShouldBuyProperty(p, t){
      var reserve = 500;
      var willHave = p.cash - t.price;
      var same = tiles.filter(function(x){ return x.type==="PROPERTY" && x.group===t.group; });
      var owned = same.filter(function(x){ return p.properties.indexOf(x.idx)>=0 && p.mortgaged.indexOf(x.idx)<0; }).length;
      var total = same.length;
      if (owned+1 === total) return p.cash >= t.price; // 湊滿色組
      return willHave >= reserve;
    }
    function aiShouldBuyStation(p){ return p.cash >= 600 || [5,15,25,35].some(function(s){ return p.properties.indexOf(s)>=0; }); }
    function aiShouldBuyUtility(p){ return p.cash >= 400 || [12,28].some(function(u){ return p.properties.indexOf(u)>=0; }); }

    async function aiTurn(){
      var p=state.players[state.cur];
      await sleep(400);
      // 監獄邏輯沿用
      if (p.inJail){
        if (p.jailTurns<2){
          var d=rollDice(), d1=d[0], d2=d[1], dbl=d1===d2;
          if (dbl){ p.inJail=false; p.jailTurns=0; log(p.name+' 擲出雙骰出獄，移動 '+(d1+d2)+' 步。', true); await moveSteps(p, d1+d2); await resolveTile(p, d1+d2); }
          else { p.jailTurns++; log(p.name+' 嘗試失敗（第 '+p.jailTurns+'/3 回合）', true); }
        } else {
          await ensureCash(p, JAIL_FINE);
          if (!p.alive){ endTurn(); return; }
          await payToBank(p, JAIL_FINE, "保釋金");
          if (!p.alive){ endTurn(); return; }
          p.inJail=false; p.jailTurns=0;
          var res = await onRoll();
          if (res && res.again){ await sleep(400); await onRoll(); }
          await aiUnmortgageIfRich(p);
          aiAutoBuild(p);
          endTurn(); return;
        }
        await aiUnmortgageIfRich(p);
        aiAutoBuild(p);
        endTurn(); return;
      }
      // 普通回合
      var r = await onRoll();
      if (r && r.again){ await sleep(400); r = await onRoll(); if (r && r.again){ await sleep(400); await onRoll(); } }
      await aiUnmortgageIfRich(p);
      aiAutoBuild(p);
      endTurn();
    }
    async function aiUnmortgageIfRich(p){
      var reserve = 600;
      var list = p.mortgaged.slice().sort(function(a,b){ return getPrice(tiles[a]) - getPrice(tiles[b]); });
      for (var i=0;i<list.length;i++){
        var idx=list[i]; var cost=Math.floor(getPrice(tiles[idx])*0.5*1.1);
        if (p.cash - cost >= reserve) doUnmortgage(p, idx);
      }
    }
    function aiAutoBuild(p){
      // 若持有整組且現金>1000，優先把該組平均建到 2 棟；之後再衝 3~4，最後旅館。
      if (p.cash < 1000) return;
      var groups = {};
      p.properties.forEach(function(idx){ var g=tiles[idx].group; if (!g) return; groups[g]=groups[g]||[]; groups[g].push(idx); });
      Object.keys(groups).forEach(function(g){
        var slots = groups[g];
        if (!slots.every(function(idx){ return p.properties.indexOf(idx)>=0 && p.mortgaged.indexOf(idx)<0; })) return;
        var target = Math.min(4, Math.floor((p.cash-800)/buildCost(slots[0]))>=slots.length ? 2 : 1);
        // 先均衡建到 target
        for (var level=1; level<=target; level++){
          for (var i=0;i<slots.length;i++){
            var idx=slots[i];
            if (p.cash < buildCost(idx)) return;
            if (canBuildHere(p, idx) && houseCount(idx) < level){ tryBuild(p, idx); }
          }
        }
        // 有錢繼續往上或旅館
        for (var round=0; round<10; round++){
          var progressed=false;
          for (var i=0;i<slots.length;i++){
            var idx=slots[i]; if (p.cash < buildCost(idx)) return;
            if (canBuildHere(p, idx) && houseCount(idx) < 5){ tryBuild(p, idx); progressed=true; }
          }
          if (!progressed) break;
        }
      });
    }

    // ---- 事件綁定與存檔 ----
    document.getElementById('btnRoll').addEventListener('click', onRoll);
    document.getElementById('btnEnd').addEventListener('click', endTurn);
    document.getElementById('btnBuy').addEventListener('click', function(){ if (!state.awaitingBuy) return; var p=state.players[state.cur]; var t=tiles[p.pos]; var price=(t.type==="PROPERTY")?t.price:(t.type==="STATION"?200:150); buyProperty(p, t.idx, price); state.awaitingBuy=false; $('#btnBuy').disabled=true; $('#btnSkip').disabled=true; $('#btnEnd').disabled=false; });
    document.getElementById('btnSkip').addEventListener('click', function(){ state.awaitingBuy=false; $('#btnBuy').disabled=true; $('#btnSkip').disabled=true; $('#btnEnd').disabled=false; });
    document.getElementById('btnReset').addEventListener('click', function(){ if (confirm('確定要重新開始？')){ initPlayers(); buildBoard(); renderTokens(); $('#btnRoll').disabled=false; $('#btnEnd').disabled=true; $('#btnBuy').disabled=true; $('#btnSkip').disabled=true; $('#dice1').textContent='-'; $('#dice2').textContent='-'; $('#turnInfo').textContent=''; $('#log').innerHTML=''; } });
    document.getElementById('btnAssets').addEventListener('click', showAssets);
    document.getElementById('btnCloseAssets').addEventListener('click', function(){ document.getElementById('assetsPanel').classList.add('hidden'); });

    function buyProperty(p, idx, priceOverride){ var t=tiles[idx]; var price=priceOverride!=null?priceOverride:(t.type==="PROPERTY"?t.price:(t.type==="STATION"?200:150)); if (p.cash<price){ log('資金不足，無法購買。', !p.isAI); return; } p.cash-=price; p.properties.push(idx); updateOwners(); renderPlayers(); log('📝 '+p.name+' 以 $'+price+' 購得《'+(t.name||t.label)+'》', !p.isAI); }

    document.getElementById('btnSave').addEventListener('click', function(){ try{ var save = JSON.stringify(state); localStorage.setItem("tycoon_save_v23", save); log("💾 已存檔（v23）。", false); }catch(e){ diagERR("存檔失敗："+(e&&e.message||e)); } });
    document.getElementById('btnLoad').addEventListener('click', function(){ try{ var s = localStorage.getItem("tycoon_save_v23"); if (!s) { alert("沒有 v23 存檔。"); return; } var obj = JSON.parse(s); state.cur = obj.cur|0; state.dice = obj.dice||[0,0]; state.doublesInRow = obj.doublesInRow|0; state.awaitingBuy = false; state.mustEnd = false; state.players = (obj.players||[]).map(function(p){ return { id: p.id||uuid(), name: p.name, isAI: !!p.isAI, color: p.color, cash: p.cash|0, pos: p.pos|0, inJail: !!p.inJail, jailTurns: p.jailTurns|0, outCard: p.outCard|0, properties: p.properties||[], mortgaged: p.mortgaged||[], alive: p.alive!==false, rentBonusTemp: p.rentBonusTemp|0 }; }); state.bonusNextGo = obj.bonusNextGo||[]; state.houses = obj.houses||{}; renderPlayers(); buildBoard(); renderTokens(); document.getElementById('btnRoll').disabled = state.players[state.cur].isAI; document.getElementById('btnEnd').disabled = true; log("📂 已讀取 v23 存檔。", false); }catch(e){ diagERR("讀檔失敗："+(e&&e.message||e)); } });

    // 起始
    initPlayers();
    buildBoard();
    renderTokens();
    document.getElementById('btnEnd').disabled = true;
  }
})();