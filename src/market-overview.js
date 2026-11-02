(() => {
  'use strict';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v,u='%') => Number.isFinite(v) ? `${v>0?'+':''}${v.toFixed(2)}${u}` : 'unavailable';
  const ret = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&a>0 ? (b/a-1)*100 : null;
  const diff = (a,b) => Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
  const table = (heads,rows) => `<div class="mo-scroll"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const link = (url,text) => {try {const u=new URL(url); if(u.protocol==='https:') return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;}catch{} return esc(text);};
  const source = (d,k) => {const s=d.sources[k];return s?link(s.url,s.name):esc(k||'unavailable');};
  const age = date => {const t=Date.parse(date); return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):null;};
  function section(root,title,body){const el=document.createElement('section');el.className='mo-card';el.innerHTML=`<h2>${esc(title)}</h2>${body}`;root.append(el);}
  async function mount(){
    if(document.getElementById('market-overview'))return;
    const host=document.querySelector('.container')||document.body;
    const root=document.createElement('div');root.id='market-overview';
    const footer=host.querySelector('footer');host.insertBefore(root,footer||null);
    const style=document.createElement('style');style.textContent='#market-overview{color:var(--text-primary,#eee);margin:32px 0;font-size:14px}#market-overview .mo-card{background:var(--card-bg,#222);border:var(--card-border,1px solid #666);border-radius:14px;padding:24px;margin:20px 0}#market-overview h2{font-size:1.3rem;margin-bottom:14px}#market-overview p{margin:10px 0;line-height:1.7}#market-overview small{display:block;opacity:.75}#market-overview .mo-scroll{overflow-x:auto}#market-overview table{width:100%;border-collapse:collapse;font-size:13px}#market-overview th,#market-overview td{text-align:left;padding:10px;border-bottom:1px solid #8884;min-width:85px;vertical-align:top}#market-overview a{color:inherit;text-decoration:underline}#market-overview details{padding:12px 0;border-bottom:1px solid #8884}#market-overview dt{font-weight:600;margin-top:10px}#market-overview dd{margin:4px 0 0;line-height:1.6}';document.head.append(style);
    try{
      const res=await fetch('data/overview.json',{cache:'no-store'});if(!res.ok)throw Error(`HTTP ${res.status}`);const d=await res.json();if(d.schemaVersion!==1)throw Error('Unsupported overview schema');
      section(root,'Market Overview · 市場總覽',`<p>價格截至 ${esc(d.priceAsOf)}；準備日期 ${esc(d.preparedAt)}。觀察日期距今 ${esc(age(d.priceAsOf))} 日；週末 / 假期不自動等於來源失效。</p><p>不使用私人 watchlist，不更改上方原有風險總分。來源日期不同，整體資料完整度：PARTIAL。</p><small>${esc(d.priceBasis)} 最新更新錯誤：${esc((d.refresh.errors||[]).join('; ')||'無已記錄錯誤；不代表全部來源即時')}</small>`);
      const sectors=[...d.sectors].filter(x=>Number.isFinite(x.w)).sort((a,b)=>b.w-a.w), b=d.benchmarks.find(x=>x.ticker==='VOO')||{};
      const best=sectors.slice(0,3),worst=sectors.slice(-3).reverse();
      const positive=sectors.filter(x=>x.w>0).length,beat=sectors.filter(x=>Number.isFinite(b.w)&&x.w>b.w).length;
      const names=xs=>xs.map(x=>`${esc(x.name)} (${esc(x.ticker)}) ${num(x.w)}`).join('；');
      section(root,'Sector Performance · 每週板塊表現',`<p>${esc(d.period.weekStart)} → ${esc(d.period.end)}；1M 基準 ${esc(d.period.monthStart)}。${positive}/${sectors.length} 板塊上升，${beat}/${sectors.length} 跑贏 VOO。</p><p>Best 3：${names(best)}。</p><p>Bottom 3：${names(worst)}。Bottom 不代表負回報；板塊強弱亦不證明資金淨流入。</p><p>${Number.isFinite(b.w)&&b.w<0&&positive>sectors.length/2?'大市下跌但多數板塊上升：較接近分化 / 輪動，不宜直接視為全面拋售。':'比較週、月相對強弱，單週排名不足以證明新領導趨勢。'} 領先板塊仍需均線及伸延確認；落後板塊需檢查大型成分股集中度。</p>${table(['Rank','Sector / ETF','1W','1M','1W vs VOO (pp)','1M vs SPY (pp)','AUM $m','Source'],sectors.map((x,i)=>[i+1,esc(x.name+' / '+x.ticker),num(x.w),num(x.m),num(diff(x.w,b.w),' pp'),num(x.rm,' pp'),Number.isFinite(x.aum)?esc(x.aum)+' (日期未核實)':'unavailable',source(d,x.source)]))}<small>AUM 是存量，不是 flow；初始值來自用戶表格。${d.sectors.length-sectors.length} 個板塊缺少有效週回報。</small>`);
      const baseline=d.themeBaseline.closes, bw=ret(baseline[1],baseline[2]),bm=ret(baseline[0],baseline[2]);
      section(root,'Leadership & Entry Quality · 主題領導力',`<p>緊接板塊表現。相對回報以 SPY 作 SPX 代理；週月均領先不等於即時可買。欠均線 / 波幅資料時，Entry condition 保持未確認。</p>${table(['Theme / Proxy','1W','1M','1W vs SPY (pp)','1M vs SPY (pp)','Leadership','Event sensitivity','Trading fit / Entry'],d.themes.map(x=>{const w=ret(x.closes[1],x.closes[2]),m=ret(x.closes[0],x.closes[2]),rw=diff(w,bw),rm=diff(m,bm);const label=rw===null||rm===null?'未確認':rw>0&&rm>0?'週月領先':rw>0?'短期改善；月度未領先':rm>0?'短期轉弱':'週月落後';return [esc(x.name+' / '+x.ticker),num(w),num(m),num(rw,' pp'),num(rm,' pp'),label,esc(x.events),esc(x.fit)+' / Entry 未確認'];}))}`);
      const e=d.marketHealth.equalWeight,ew=ret(e.closes[1],e.closes[2]),em=ret(e.closes[0],e.closes[2]);
      section(root,'Market Momentum & Breadth · 無私人 watchlist',table(['Indicator','1W','1M'],[[esc(e.ticker+' vs SPY'),num(diff(ew,bw),' pp'),num(diff(em,bm),' pp')],...d.benchmarks.map(x=>[esc(x.ticker),num(x.w),num(x.m)]),['S&P 500 above 50DMA',num(d.marketHealth.above50DMA),''],['S&P 500 above 200DMA',num(d.marketHealth.above200DMA),''],['Momentum factor',num(d.marketHealth.momentumFactor),'']])+`<p>${esc(d.marketHealth.note)}</p>`);
      section(root,'Cross-Asset Confirmation · 跨資產確認',table(['Asset','Value','1W change','As of / quality','Source'],d.crossAssets.map(x=>[esc(x.name),Number.isFinite(x.value)?esc(x.value+' '+x.unit):'unavailable',num(x.weekChange,' '+(x.changeUnit||'')),esc(x.observedAt||x.reason||'未核實'),source(d,x.source)]))+`<p>利率下降、美元轉弱都不自動等於利好股票。與事件假設比較支持 / 矛盾；未有一致觀察窗口時不生成因果結論。</p>`);
      section(root,'Important Events & Market Reaction · 事件追蹤',`<p>歷史事件與今日新聞分開；以下不冒充即時熱訊。資料待核實不當零。觀察窗口未到用 pending；已到但欠價格用 unavailable。</p>`+d.events.map(x=>`<details><summary>${esc(x.eventDate+' · '+x.title)}</summary><small>${link(x.url,x.source)} · 發布 ${esc(x.publishedAt)}</small><dl><dt>Event</dt><dd>${esc(x.event)}</dd><dt>Hypothesis · 分析假設</dt><dd>${esc(x.hypothesis)}</dd><dt>Initial reaction</dt><dd>${esc(x.initial)}</dd><dt>Follow-through +1 / +5 sessions</dt><dd>${num(x.follow1)} / ${num(x.follow5)} · ${esc(x.followStatus)}</dd><dt>Invalidation · 未驗證條件</dt><dd>${esc(x.invalidation)}</dd></dl></details>`).join(''));
      section(root,'Sources & Refresh · 更新口徑',`<p>npm run update-overview 更新價格模組；新聞、宏觀收益率及未整合 breadth 仍需核實更新。原 Refresh Market Data 按鈕不更新此模組，亦未新增排程。</p>`+Object.entries(d.sources).map(([k,v])=>`<p>${esc(k)}：${source(d,k)} · ${esc(v.observedAt)} · ${esc(v.quality)}</p>`).join(''));
    }catch(err){root.textContent='市場總覽載入失敗：'+err.message+'。原 dashboard 保持不變。';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
