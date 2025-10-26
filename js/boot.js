// v2.3.4 boot (no inline): creates diag bar and loads ./js/game-v23.js
(function(){
  var diag = document.getElementById('diag');
  function ok(m){ diag.className=''; diag.style.background='#16a34a'; diag.style.color='#fff'; diag.textContent='✅ '+m; }
  function err(m){ diag.className=''; diag.style.background='#b91c1c'; diag.style.color='#fff'; diag.textContent='🚨 '+m; }
  // Fallback styles for diag
  diag.style.position='fixed'; diag.style.left='0'; diag.style.right='0';
  diag.style.bottom='0'; diag.style.padding='6px 10px'; diag.style.fontSize='12px'; diag.style.zIndex='10';

  // Load game script
  var s = document.createElement('script');
  s.src = './js/game-v23.js?v=234';
  s.defer = true;
  s.onload = function(){
    setTimeout(function(){
      if (window.__TYCOON_V23_READY__) ok('腳本載入成功（./js/game-v23.js）');
      else err('腳本已載入，但未就緒。請開啟主控台檢查錯誤。');
    }, 800);
  };
  s.onerror = function(){
    err('無法載入 ./js/game-v23.js（檔案缺失或大小寫不符）。請確認檔案存在，且路徑正確。');
  };
  document.body.appendChild(s);
})();