(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (v, unit = '%') => Number.isFinite(v) ? v.toFixed(1) + unit : 'unavailable';
  const pp = v => Number.isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(1) + ' pp' : 'unavailable';
  const link = (url, label) => {
    try { const u = new URL(url); if (u.protocol === 'https:') return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`; } catch {}
    return esc(label);
  };
  async function mount() {
    if (document.getElementById('hedge-fund-exposure')) return;
    const panel = document.createElement('section');
    panel.id = 'hedge-fund-exposure';
    panel.style.cssText = 'grid-column:1/-1;background:var(--card-bg,#222);border:var(--card-border,1px solid #888);color:var(--text-primary,#eee);border-radius:14px;padding:24px;margin:20px 0;font-size:14px;line-height:1.7';
    const heading = [...document.querySelectorAll('.card-title')].find(x => /positioning|倉位/i.test(x.textContent));
    const card = heading?.closest('.card');
    if (card?.parentElement) card.insertAdjacentElement('afterend', panel);
    else {
      const host = document.querySelector('.container') || document.body;
      const footer = host.querySelector('footer');
      host.insertBefore(panel, footer || null);
    }
    try {
      const response = await fetch('data/hedge-fund-exposure.json', {cache:'no-store'});
      if (!response.ok) throw Error('HTTP ' + response.status);
      const d = await response.json();
      if (d.schemaVersion !== 1) throw Error('Unsupported schema');
      const row = (name, m) => `<tr><td>${esc(name)}</td><td>${fmt(m.value)}</td><td>${fmt(m.previous)}*</td><td>${pp(m.weeklyChangePP)}</td></tr>`;
      const global = d.context.globalPrimeBookNet, beta = d.context.betaAdjusted;
      panel.innerHTML = `<h2 style="font-size:1.3rem;margin-bottom:12px">Positioning · Hedge Fund Gross / Net Exposure</h2>
        <p>${esc(d.scope)} · 資料截至 ${esc(d.observedAt)}；上週 ${esc(d.previousObservedAt)}；核實日 ${esc(d.reviewedAt)}。</p>
        <div style="overflow-x:auto;margin:14px 0"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th>指標</th><th>本週</th><th>上週*</th><th>按週變化</th></tr></thead><tbody>${row('Gross leverage / 總敞口',d.gross)}${row('Net exposure / 淨敞口',d.net)}</tbody></table></div>
        <p>* 上週值由最新值及報道週變化反推，唔係另一份原始週報獨立確認。單位：${esc(d.unit)}。</p>
        <p>${esc(d.comment)}</p>
        <p style="opacity:.85">來源差異：另一篇報道 net 為 ${fmt(d.conflict.alternateNet)}，相差 ${pp(d.conflict.differencePP)}；原因未釐清，主值保留 ${fmt(d.net.value)}，不平均。</p>
        <details><summary>樣本、定義、來源及限制</summary>
          <p>Gross = (long + |short|) / NAV；Net = (long - |short|) / NAV，為一般股票多空名義敞口定義，並非企業負債比率。未取得原始報告方法，不能保證涵蓋所有衍生工具或等同 beta 調整後風險。</p>
          <p>${esc(d.quality)} ${esc(d.context.chart)}</p>
          <p>另一口徑：整體 prime book 十月 net ${fmt(global.value)}，九月約 ${fmt(global.previous)}（反推），月變化 ${pp(global.changePP)}；呢個係月度、唔係本週比較，亦唔可同美國樣本串成同一數列。${link(global.sourceUrl,'月度報道')}</p>
          <p>Beta-adjusted 另列：gross ${fmt(beta.gross)} (${pp(beta.grossWeeklyChangePP)})、net ${fmt(beta.net)} (${pp(beta.netWeeklyChangePP)})。${esc(beta.quality)}</p>
          ${d.sources.map(s => `<p>${link(s.url,s.name)} · ${esc(s.publishedAt)}</p>`).join('')}
          <p>${esc(d.scoring)} 呢個面板為人工核實快照，原刷新按鈕及 update-overview 腳本唔會自動更新此數列。</p>
        </details>`;
    } catch (error) { panel.textContent = 'Hedge fund exposure 載入失敗：' + error.message + '；不影響原有風險計分。'; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
