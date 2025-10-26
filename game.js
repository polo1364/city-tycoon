// 城市資本戰 Web 版 v2（多檔案＋行動優化＋AI 強化）
"use strict";
(function(){
  var diagEl = document.getElementById('diag');
  function diagOK(msg){ if (diagEl){ diagEl.className=''; diagEl.textContent='✅ '+msg; } }
  function diagERR(msg){ if (diagEl){ diagEl.className='err'; diagEl.textContent='🚨 '+msg; } }

  window.addEventListener('error', function(e){ diagERR('JS 錯誤：'+(e.message||e)); });
  window.addEventListener('unhandledrejection', function(e){ diagERR('Promise 錯誤：'+(e.reason&&e.reason.message||e.reason)); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function boot(){ try{ main(); diagOK("JS 初始化成功。如果按鈕灰掉，代表目前輪到 AI。"); }catch(err){ diagERR("初始化失敗："+(err&&err.message||err)); console.error(err); } }

  function main(){
    var $ = function(s){ return document.querySelector(s); };
    var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
    function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
    function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
    function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

    var COLORS = {brown:"#8d5524",lightBlue:"#7ab6ff",pink:"#ff8dc7",orange:"#ffa14a",red:"#ff6b6b",yellow:"#ffd93d",green:"#28c76f",darkBlue:"#5470ff"};
    var STATION_RENTS = [25,50,100,200];
    var START_SALARY = 200;
    var JAIL_FINE = 50;

    var tiles = [
      {idx:0,type:"START",label:"起點"},
      {idx:1,type:"PROPERTY",name:"老街",group:"brown",price:60},
      {idx:2,type:"CHEST",label:"命運"},
      {idx:3,type:"PROPERTY",name:"碼頭邊",group:"brown",price:60},
      {idx:4,type:"TAX",amount:200,label:"所得稅"},
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
      {idx:38,type:"TAX",amount:100,label:"豪華稅"},
      {idx:39,type:"PROPERTY",name:"雲頂塔",group:"darkBlue",price:400}
    ];

    function baseRent(price){ return Math.round(price*0.12); }

    var chestDeck = shuffle([
      {t:"cash",v:+200,text:"城市補助，領 $200"},
      {t:"cash",v:+100,text:"退稅，領 $100"},
      {t:"cash",v:-100,text:"醫療費，付 $100"},
      {t:"cash",v:+150,text:"公司紅利，領 $150"},
      {t:"cash",v:-50,text:"罰款，付 $50"},
      {t:"moveTo",idx:0,text:"前進到起點並領薪"},
      {t:"jail",text:"直接入獄"},
      {t:"outCard",text:"獲得出獄卡"},
      {t:"repair",house:25,hotel:100,text:"維修費（本版未實作房屋）"},
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

    function idxToCoord(i){
      if (i<=10) return {r:10,c:i};
      if (i<=20) return {r:10-(i-10),c:10};
      if (i<=30) return {r:0,c:10-(i-20)};
      return {r:i-30,c:0};
    }

    var state = {
      players: [], cur:0, dice:[0,0], doublesInRow:0,
      awaitingBuy:false, mustEnd:false, bonusNextGo:[], logSeq:0
    };
    var PlayerColors = ["#e74c3c","#2980b9","#27ae60","#8e44ad","#f39c12","#16a085"];

    function uuid(){
      try{ if (window.crypto && typeof window.crypto.randomUUID==='function') return window.crypto.randomUUID(); }catch(e){}
      return 'p-'+Math.random().toString(36).slice(2);
    }

    function makePlayer(name,isAI,color){
      return { id: uuid(), name:name, isAI:isAI, color:color, cash:1500, pos:0, inJail:false, jailTurns:0, outCard:0, properties:[], mortgaged:[], alive:true, rentBonusTemp:0 };
    }
    function initPlayers(){
      state.players=[
        makePlayer("你",false,PlayerColors[0]),
        makePlayer("蒼嶺",true,PlayerColors[1]),
        makePlayer("星河",true,PlayerColors[2]),
        makePlayer("雲岫",true,PlayerColors[3])
      ];
      state.cur=0; state.dice=[0,0]; state.doublesInRow=0; state.awaitingBuy=false; state.mustEnd=false; state.bonusNextGo=[];
      renderPlayers(); log("🎮 遊戲開始！4 位玩家就緒。", false);
    }

    function buildBoard(){
      var board=document.getElementById('board'); board.innerHTML='<div id="toast" class="toast hidden"></div>';
      for (var r=0;r<11;r++){ for (var c=0;c<11;c++){ var cell=document.createElement('div'); cell.className='tile empty'; cell.style.gridRow=(r+1); cell.style.gridColumn=(c+1); board.appendChild(cell); } }
      for (var k=0;k<tiles.length;k++){
        var t=tiles[k]; var pos=idxToCoord(t.idx); var cell=document.createElement('div'); cell.className='tile'; cell.style.gridRow=(pos.r+1); cell.style.gridColumn=(pos.c+1);
        var cls=""; if (t.type==="PROPERTY") cls="property"; if (t.type==="STATION") cls="station"; if (t.type==="UTILITY") cls="utility"; if (t.type==="TAX") cls="tax"; if (t.type==="CHANCE") cls="chance"; if (t.type==="CHEST") cls="chest"; if (t.type==="GOTOJAIL") cls="gotojail"; if (t.type==="JAIL") cls="jail"; if (t.type==="START") cls="start"; if (t.type==="FREE") cls="free"; if ([0,10,20,30].indexOf(t.idx)>=0) cell.classList.add('corner'); if (cls) cell.classList.add(cls);
        var label=document.createElement('div'); label.className='label'; label.textContent=t.name||t.label||""; cell.appendChild(label);
        if (t.type==="PROPERTY"){ var colorbar=document.createElement('div'); colorbar.className='colorbar'; colorbar.style.background=COLORS[t.group]||"#ccc"; cell.prepend(colorbar); var price=document.createElement('div'); price.className='price'; var p=t.price; var r0=Math.round(p*0.12); price.textContent="$"+p+"｜租$"+r0; cell.appendChild(price); }
        if (t.type==="STATION"||t.type==="UTILITY"){ var price2=document.createElement('div'); price2.className='price'; price2.textContent="可購買"; cell.appendChild(price2); }
        var owner=document.createElement('div'); owner.className='owner'; owner.style.display='none'; owner.setAttribute('data-idx', t.idx); cell.appendChild(owner);
        board.appendChild(cell);
      }
      renderTokens(); updateOwners();
    }
    function renderTokens(){
      var olds=$$('.token'); olds.forEach(function(e){ e.remove(); });
      for (var i=0;i<state.players.length;i++){ var p=state.players[i]; if (!p.alive) continue; var pos=idxToCoord(p.pos); var cell=document.querySelector('#board > .tile[style*="grid-row: '+(pos.r+1)+';"][style*="grid-column: '+(pos.c+1)+';"]'); var tok=document.createElement('div'); tok.className='token'; tok.style.background=p.color; tok.setAttribute('data-p', String(i+1)); if (cell) cell.appendChild(tok); }
    }
    function updateOwners(){
      $$('.owner').forEach(function(el){ el.style.display='none'; });
      for (var pi=0;pi<state.players.length;pi++){ var pl=state.players[pi]; for (var j=0;j<pl.properties.length;j++){ var idx=pl.properties[j]; var pos=idxToCoord(idx); var cell=document.querySelector('#board > .tile[style*="grid-row: '+(pos.r+1)+';"][style*="grid-column: '+(pos.c+1)+';"] .owner'); if (cell){ cell.style.display='block'; cell.style.background=pl.color; } } }
    }
    function renderPlayers(){
      var panel=document.getElementById('playersPanel'); var html=""; for (var i=0;i<state.players.length;i++){ var p=state.players[i]; if (!p.alive) continue; html+='<div class="row"><div class="swatch" style="background:'+p.color+'"></div><div class="name">'+(i===state.cur?"⭐ ":"")+p.name+(p.inJail?"（獄）":"")+(p.outCard>0?"🃏":"")+'</div><div class="cash">$'+p.cash+'</div></div>'; } panel.innerHTML=html; document.getElementById('currentPlayer').textContent = state.players[state.cur].name;
    }
    function toast(msg){
      var t=document.getElementById('toast'); if (!t) return;
      t.textContent=msg; t.classList.remove('hidden');
      clearTimeout(toast._tid); toast._tid=setTimeout(function(){ t.classList.add('hidden'); }, 1500);
    }
    function log(msg, highlightMe){
      if (highlightMe===void 0) highlightMe=false;
      var logEl=document.getElementById('log'); var div=document.createElement('div'); div.className='entry'+(highlightMe?' me':''); div.textContent=msg; logEl.prepend(div);
      toast(msg);
    }

    function endTurn(){
      var p=state.players[state.cur];
      p.rentBonusTemp=0;
      nextPlayer();
    }

    function nextPlayer(){
      do { state.cur=(state.cur+1)%state.players.length; } while(!state.players[state.cur].alive);
      state.dice=[0,0]; state.doublesInRow=0; state.awaitingBuy=false; state.mustEnd=false; renderPlayers();
      document.getElementById('btnRoll').disabled = state.players[state.cur].isAI;
      document.getElementById('btnEnd').disabled = true; document.getElementById('btnBuy').disabled = true; document.getElementById('btnSkip').disabled = true;
      document.getElementById('dice1').textContent='-'; document.getElementById('dice2').textContent='-'; document.getElementById('turnInfo').textContent='';
      if (checkWin()) return;
      if (state.players[state.cur].isAI) { aiTurn(); } else { if (state.players[state.cur].inJail) showJailOptions(state.players[state.cur]); }
    }
    function checkWin(){
      var alive=state.players.filter(function(p){ return p.alive; });
      if (alive.length===1){ showModal('🏆 '+alive[0].name+' 獲勝！（其他玩家皆已破產）'); document.getElementById('btnRoll').disabled=true; document.getElementById('btnEnd').disabled=true; return true; }
      return false;
    }
    function showModal(html, withCancel){
      if (withCancel===void 0) withCancel=false;
      document.getElementById('modalBody').innerHTML=html; document.getElementById('modal').classList.remove('hidden'); document.getElementById('modalCancel').style.display = withCancel?'inline-flex':'none';
      return new Promise(function(resolve){
        function ok(){ document.getElementById('modal').classList.add('hidden'); document.getElementById('modalOk').removeEventListener('click', ok); document.getElementById('modalCancel').removeEventListener('click', cancel); resolve(true); }
        function cancel(){ document.getElementById('modal').classList.add('hidden'); document.getElementById('modalOk').removeEventListener('click', ok); document.getElementById('modalCancel').removeEventListener('click', cancel); resolve(false); }
        document.getElementById('modalOk').addEventListener('click', ok, {once:true}); document.getElementById('modalCancel').addEventListener('click', cancel, {once:true});
      });
    }
    function showAssets(){
      var wrap=document.getElementById('assetsBody'); var me=state.players[state.cur]; var html='<table class="asset-table"><thead><tr><th>#</th><th>地名</th><th>類型</th><th>狀態</th><th>操作</th></tr></thead><tbody>'; var i=1;
      var owned=me.properties.map(function(idx){ return tiles[idx]; });
      for (var k=0;k<owned.length;k++){ var t=owned[k]; var mort=me.mortgaged.indexOf(t.idx)>=0; var typeTxt=(t.type==="PROPERTY"?"地產":(t.type==="STATION"?"車站":"事業"));
        html+='<tr><td>'+ (i++) +'</td><td>'+ (t.name||t.label) +'</td><td>'+typeTxt+'</td><td>'+(mort?'已抵押':'正常')+'</td><td>'+(mort?('<button data-op="unmortgage" data-idx="'+t.idx+'">贖回</button>'):('<button data-op="mortgage" data-idx="'+t.idx+'">抵押</button>'))+'</td></tr>';
      }
      html+='</tbody></table>'; wrap.innerHTML=html;
      Array.prototype.forEach.call(wrap.querySelectorAll('button[data-op]'), function(btn){
        btn.addEventListener('click', function(){
          var idx=Number(btn.getAttribute('data-idx'));
          if (btn.getAttribute('data-op')==='mortgage') doMortgage(me, idx); else doUnmortgage(me, idx);
          showAssets(); renderPlayers(); updateOwners();
        });
      });
      document.getElementById('assetsPanel').classList.remove('hidden');
    }

    function rollDice(){ var d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6); state.dice=[d1,d2]; document.getElementById('dice1').textContent=d1; document.getElementById('dice2').textContent=d2; return [d1,d2]; }
    async function onRoll(){
      var p=state.players[state.cur]; if (p.inJail) return {again:false};
      document.getElementById('btnRoll').disabled=true;
      var d=rollDice(), d1=d[0], d2=d[1]; var isDouble=d1===d2;
      if (isDouble){ state.doublesInRow++; if (state.doublesInRow>=3){ log('⚠️ '+p.name+' 連續第三次擲出雙骰，被送入獄。', !p.isAI); goToJail(p); document.getElementById('btnEnd').disabled=false; return {again:false}; } } else { state.doublesInRow=0; }
      await moveSteps(p, d1+d2); await resolveTile(p, d1+d2);
      if (isDouble && p.alive && !p.inJail){ document.getElementById('turnInfo').textContent='雙骰！你可再擲一次。'; document.getElementById('btnRoll').disabled=false; document.getElementById('btnEnd').disabled=true; return {again:true}; }
      else { document.getElementById('btnEnd').disabled=false; return {again:false}; }
    }
    async function moveSteps(p, steps){
      for (var i=0;i<steps;i++){ p.pos=(p.pos+1)%40; if (p.pos===0){ var bonus=START_SALARY; var bi=state.bonusNextGo.indexOf(p.id); if (bi>=0){ bonus+=100; state.bonusNextGo.splice(bi,1); } p.cash+=bonus; renderPlayers(); log('💵 '+p.name+' 經過起點，領 $'+bonus, !p.isAI); } renderTokens(); await sleep(120); }
    }

    function ownerOf(idx){ for (var i=0;i<state.players.length;i++){ var pl=state.players[i]; if (!pl.alive) continue; if (pl.properties.indexOf(idx)>=0) return i; } return -1; }
    function groupOwnedCount(ownerIdx, groupId){
      var groupSlots=tiles.filter(function(t){ return t.type==="PROPERTY" && t.group===groupId; }).map(function(t){ return t.idx; });
      var pl=state.players[ownerIdx]; var cnt=0; for (var k=0;k<groupSlots.length;k++){ var idx=groupSlots[k]; if (pl.properties.indexOf(idx)>=0 && pl.mortgaged.indexOf(idx)<0) cnt++; } return {cnt:cnt,total:groupSlots.length};
    }

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

    // --- AI 購買策略: 現金預留 200；若能湊成一色組則盡量買。 ---
    function aiShouldBuyProperty(p, t){
      var reserve = 200;
      var willHave = p.cash - t.price;
      // 若買下即可全套（無抵押且全擁有） => 一律買
      var same = tiles.filter(function(x){ return x.type==="PROPERTY" && x.group===t.group; });
      var owned = same.filter(function(x){ return p.properties.indexOf(x.idx)>=0 && p.mortgaged.indexOf(x.idx)<0; }).length;
      var total = same.length;
      if (owned+1 === total) return p.cash >= t.price; // 湊套必買（只要買得起）
      // 一般情況：保留現金
      return willHave >= reserve;
    }
    function aiShouldBuyStation(p){ return p.cash >= 350 || [5,15,25,35].some(function(s){ return p.properties.indexOf(s)>=0; }); }
    function aiShouldBuyUtility(p){ return p.cash >= 250 || [12,28].some(function(u){ return p.properties.indexOf(u)>=0; }); }

    async function onLandProperty(p,t){
      var idx=t.idx, base=baseRent(t.price), ownerIdx=ownerOf(idx);
      if (ownerIdx<0){
        if (!p.isAI){
          var canBuy=p.cash>=t.price; document.getElementById('btnBuy').disabled=!canBuy; document.getElementById('btnSkip').disabled=false; state.awaitingBuy=true; document.getElementById('turnInfo').textContent=canBuy?('可用 $'+t.price+' 購買《'+t.name+'》'):'資金不足，無法購買。';
        } else {
          if (aiShouldBuyProperty(p,t)) buyProperty(p, idx, t.price); else log('🤔 '+p.name+' 放棄購買《'+t.name+'》', true);
        }
      } else if (ownerIdx===state.cur){
        log(p.name+' 來到自己的地《'+t.name+'》。', !p.isAI);
      } else {
        var owner=state.players[ownerIdx]; if (owner.mortgaged.indexOf(idx)>=0){ log('《'+t.name+'》已抵押，免租。', !p.isAI); return; }
        var gc=groupOwnedCount(ownerIdx, t.group); var rent=base * (gc.cnt===gc.total?2:1); rent += (owner.rentBonusTemp||0);
        await payToPlayer(p, owner, rent, '租金：《'+t.name+'》');
      }
    }
    async function onLandStation(p,t){
      var idx=t.idx, ownerIdx=ownerOf(idx);
      if (ownerIdx<0){
        var price=200;
        if (!p.isAI){ document.getElementById('turnInfo').textContent='可用 $'+price+' 購買《'+t.name+'》'; state.awaitingBuy=true; document.getElementById('btnBuy').disabled=!(p.cash>=price); document.getElementById('btnSkip').disabled=false; }
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
        if (!p.isAI){ document.getElementById('turnInfo').textContent='可用 $'+price+' 購買《'+t.name+'》'; state.awaitingBuy=true; document.getElementById('btnBuy').disabled=!(p.cash>=price); document.getElementById('btnSkip').disabled=false; }
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

    function buyProperty(p, idx, priceOverride){
      var t=tiles[idx]; var price=priceOverride!=null?priceOverride:(t.type==="PROPERTY"?t.price:(t.type==="STATION"?200:150));
      if (p.cash<price){ log('資金不足，無法購買。', !p.isAI); return; }
      p.cash-=price; p.properties.push(idx); updateOwners(); renderPlayers(); log('📝 '+p.name+' 以 $'+price+' 購得《'+(t.name||t.label)+'》', !p.isAI);
    }
    async function payToBank(p, amount, reason){ if (amount<=0) return; log('🏦 '+p.name+' 支付銀行 $'+amount+'（'+reason+'）', !p.isAI); await ensureCash(p, amount); if (!p.alive) return; p.cash-=amount; renderPlayers(); }
    async function payToPlayer(payer,receiver,amount,reason){
      if (amount<=0) return; log('💸 '+payer.name+' 支付 $'+amount+' 給 '+receiver.name+'（'+reason+'）', !payer.isAI);
      await ensureCash(payer, amount, receiver); if (!payer.alive) return; payer.cash-=amount; receiver.cash+=amount; renderPlayers();
    }
    function getPrice(t){ if (t.type==="PROPERTY") return t.price; if (t.type==="STATION") return 200; if (t.type==="UTILITY") return 150; return 0; }
    function doMortgage(p, idx){
      var t=tiles[idx]; if (p.properties.indexOf(idx)<0 || p.mortgaged.indexOf(idx)>=0) return; var val=Math.floor(getPrice(t)*0.5);
      p.mortgaged.push(idx); p.cash+=val; renderPlayers(); log('🏦 '+p.name+' 抵押《'+(t.name||t.label)+'》，取得 $'+val, !p.isAI);
    }
    function doUnmortgage(p, idx){
      var t=tiles[idx]; var mi=p.mortgaged.indexOf(idx); if (mi<0) return; var cost=Math.floor(getPrice(t)*0.5*1.1); if (p.cash<cost){ log('現金不足，無法贖回。', !p.isAI); return; }
      p.cash-=cost; p.mortgaged.splice(mi,1); renderPlayers(); log('💳 '+p.name+' 贖回《'+(t.name||t.label)+'》，支付 $'+cost, !p.isAI);
    }
    function goToJail(p){ p.inJail=true; p.jailTurns=0; p.pos=10; renderTokens(); document.getElementById('turnInfo').textContent=p.name+' 入獄。'; }

    async function drawCard(p, deck, name, diceTotal){
      var card=deck.shift(); deck.push(card); log('📜 '+p.name+' 抽到 '+name+' 卡：'+card.text, !p.isAI);
      switch(card.t){
        case "cash": if (card.v>=0){ p.cash+=card.v; renderPlayers(); } else { await payToBank(p, -card.v, name); } break;
        case "moveTo": await moveTo(p, card.idx, true); break;
        case "jail": goToJail(p); break;
        case "outCard": p.outCard+=1; renderPlayers(); break;
        case "repair": break;
        case "collectFromEach": for (var i=0;i<state.players.length;i++){ var other=state.players[i]; if (other===p || !other.alive) continue; await payToPlayer(other, p, card.v, name+'卡'); } break;
        case "payToEach": for (var j=0;j<state.players.length;j++){ var o=state.players[j]; if (o===p || !o.alive) continue; await payToPlayer(p, o, card.v, name+'卡'); } break;
        case "nearestUtility": await moveToNearest(p, ["UTILITY"], diceTotal, true); break;
        case "nearestStation": await moveToNearest(p, ["STATION"], diceTotal, true, true); break;
        case "back3": await moveBack(p, 3); await resolveTile(p, diceTotal); break;
        case "payTax": await payToBank(p, card.v, name+'卡'); break;
        case "marketRush": p.rentBonusTemp += (card.bonus||25); document.getElementById('turnInfo').textContent='本回合收租 +$25'; break;
        case "bonusNextGo": if (state.bonusNextGo.indexOf(p.id)<0) state.bonusNextGo.push(p.id); break;
      }
    }
    async function moveTo(p, idx, passGoCredit){
      while (p.pos!==idx){ p.pos=(p.pos+1)%40; if (p.pos===0 && passGoCredit){ var bonus=START_SALARY; var bi=state.bonusNextGo.indexOf(p.id); if (bi>=0){ bonus+=100; state.bonusNextGo.splice(bi,1); } p.cash+=bonus; renderPlayers(); log('💵 '+p.name+' 經過起點，領 $'+bonus, !p.isAI); } renderTokens(); await sleep(80); }
    }
    async function moveToNearest(p, types, diceTotal, thenResolve, doubleRentOnStation){
      var i=p.pos;
      while (true){
        i=(i+1)%40; var t=tiles[i]; if (types.indexOf(t.type)>=0){
          await moveTo(p, i, true);
          if (thenResolve){
            if (t.type==="UTILITY") await onLandUtility(p, t, diceTotal);
            else if (t.type==="STATION"){
              var ownerIdx=ownerOf(t.idx);
              if (doubleRentOnStation && ownerIdx>=0 && ownerIdx!==state.cur){
                var owner=state.players[ownerIdx]; if (owner.mortgaged.indexOf(t.idx)<0){
                  var ownerStations=[5,15,25,35].filter(function(s){ return owner.properties.indexOf(s)>=0 && owner.mortgaged.indexOf(s)<0; }).length;
                  var rent=STATION_RENTS[clamp(ownerStations-1,0,3)];
                  await payToPlayer(p, owner, rent*2, '雙倍車站租金（機會卡）《'+t.name+'》'); return;
                }
              }
              await onLandStation(p, t);
            }
          }
          return;
        }
      }
    }
    async function moveBack(p, steps){ for (var i=0;i<steps;i++){ p.pos=(p.pos-1+40)%40; renderTokens(); await sleep(80); } }

    function showJailOptions(p){
      if (p.isAI) return;
      var canPay=p.cash>=JAIL_FINE;
      var html='<p>你在獄中，可選擇：</p><ul><li>支付 $'+JAIL_FINE+' 立即出獄並擲骰</li><li>'+(p.outCard>0?'使用 1 張出獄卡':'嘗試擲出雙骰（最多 3 回合）')+'</li></ul><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><button id="jPay" '+(canPay?'':'disabled')+' class="ok">付保釋金</button>'+(p.outCard>0?'<button id="jCard" class="primary">使用出獄卡</button>':'')+'<button id="jTry" class="primary">嘗試擲骰</button></div>';
      showModal(html,false).then(function(){});
      var jPay=document.getElementById('jPay'); if (jPay) jPay.addEventListener('click', async function(){ await payToBank(p,JAIL_FINE,'保釋金'); if (!p.alive) return; p.inJail=false; p.jailTurns=0; document.getElementById('modal').classList.add('hidden'); await onRoll(); }, {once:true});
      var jCard=document.getElementById('jCard'); if (jCard) jCard.addEventListener('click', async function(){ if (p.outCard>0){ p.outCard--; p.inJail=false; p.jailTurns=0; renderPlayers(); document.getElementById('modal').classList.add('hidden'); await onRoll(); } }, {once:true});
      var jTry=document.getElementById('jTry'); if (jTry) jTry.addEventListener('click', async function(){ document.getElementById('modal').classList.add('hidden'); var d=rollDice(), d1=d[0], d2=d[1], dbl=d1===d2; if (dbl){ p.inJail=false; p.jailTurns=0; log(p.name+' 擲出雙骰，出獄並移動 '+(d1+d2)+' 步。', !p.isAI); await moveSteps(p, d1+d2); await resolveTile(p, d1+d2); document.getElementById('btnEnd').disabled=false; } else { p.jailTurns++; log(p.name+' 未擲出雙骰（第 '+p.jailTurns+'/3 回合）。', !p.isAI); if (p.jailTurns>=3){ await payToBank(p, JAIL_FINE, '保釋金'); if (!p.alive){ document.getElementById('btnEnd').disabled=false; return; } p.inJail=false; p.jailTurns=0; await onRoll(); } else { document.getElementById('btnEnd').disabled=false; } } }, {once:true});
    }

    // --- 強化 AI 流程：自動二擲、結束回合、富餘現金自動贖回 ---
    async function aiTurn(){
      var p=state.players[state.cur];
      await sleep(400);
      // 在獄中：前兩回合嘗試擲骰，第三回合保釋
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
          endTurn(); return;
        }
        await aiUnmortgageIfRich(p);
        endTurn(); return;
      }
      // 一般回合：擲骰（若雙骰自動再擲）
      var r = await onRoll();
      if (r && r.again){ await sleep(400); r = await onRoll(); if (r && r.again){ await sleep(400); await onRoll(); } }
      await aiUnmortgageIfRich(p);
      endTurn();
    }

    async function aiUnmortgageIfRich(p){
      // 若現金 > 500，按贖回成本由低到高贖回，直到保留 300
      var reserve = 300;
      var list = p.mortgaged.slice().sort(function(a,b){ return getPrice(tiles[a]) - getPrice(tiles[b]); });
      for (var i=0;i<list.length;i++){
        var idx=list[i]; var cost=Math.floor(getPrice(tiles[idx])*0.5*1.1);
        if (p.cash - cost >= reserve) doUnmortgage(p, idx);
      }
    }

    // 事件綁定
    document.getElementById('btnRoll').addEventListener('click', onRoll);
    document.getElementById('btnEnd').addEventListener('click', endTurn);
    document.getElementById('btnBuy').addEventListener('click', function(){ if (!state.awaitingBuy) return; var p=state.players[state.cur]; var t=tiles[p.pos]; var price=(t.type==="PROPERTY")?t.price:(t.type==="STATION"?200:150); buyProperty(p, t.idx, price); state.awaitingBuy=false; document.getElementById('btnBuy').disabled=true; document.getElementById('btnSkip').disabled=true; document.getElementById('btnEnd').disabled=false; });
    document.getElementById('btnSkip').addEventListener('click', function(){ state.awaitingBuy=false; document.getElementById('btnBuy').disabled=true; document.getElementById('btnSkip').disabled=true; document.getElementById('btnEnd').disabled=false; });
    document.getElementById('btnReset').addEventListener('click', function(){ if (confirm('確定要重新開始？')){ initPlayers(); buildBoard(); renderTokens(); document.getElementById('btnRoll').disabled=false; document.getElementById('btnEnd').disabled=true; document.getElementById('btnBuy').disabled=true; document.getElementById('btnSkip').disabled=true; document.getElementById('dice1').textContent='-'; document.getElementById('dice2').textContent='-'; document.getElementById('turnInfo').textContent=''; document.getElementById('log').innerHTML=''; } });
    document.getElementById('btnAssets').addEventListener('click', showAssets);
    document.getElementById('btnCloseAssets').addEventListener('click', function(){ document.getElementById('assetsPanel').classList.add('hidden'); });

    // 存讀檔
    document.getElementById('btnSave').addEventListener('click', function(){
      try{
        var save = JSON.stringify(state);
        localStorage.setItem("tycoon_save", save);
        log("💾 已存檔（本機瀏覽器）。", false);
      }catch(e){ diagERR("存檔失敗："+(e&&e.message||e)); }
    });
    document.getElementById('btnLoad').addEventListener('click', function(){
      try{
        var s = localStorage.getItem("tycoon_save");
        if (!s) { alert("沒有存檔。"); return; }
        var obj = JSON.parse(s);
        state.cur = obj.cur|0;
        state.dice = obj.dice||[0,0];
        state.doublesInRow = obj.doublesInRow|0;
        state.awaitingBuy = false;
        state.mustEnd = false;
        state.players = (obj.players||[]).map(function(p){
          return { id: p.id||uuid(), name: p.name, isAI: !!p.isAI, color: p.color, cash: p.cash|0, pos: p.pos|0, inJail: !!p.inJail, jailTurns: p.jailTurns|0, outCard: p.outCard|0, properties: p.properties||[], mortgaged: p.mortgaged||[], alive: p.alive!==false, rentBonusTemp: p.rentBonusTemp|0 };
        });
        state.bonusNextGo = obj.bonusNextGo||[];
        renderPlayers(); buildBoard(); renderTokens();
        document.getElementById('btnRoll').disabled = state.players[state.cur].isAI;
        document.getElementById('btnEnd').disabled = true;
        log("📂 已讀檔。", false);
      }catch(e){ diagERR("讀檔失敗："+(e&&e.message||e)); }
    });

    // 初始化
    initPlayers();
    buildBoard();
    renderTokens();
    document.getElementById('btnEnd').disabled = true;
  }
})();