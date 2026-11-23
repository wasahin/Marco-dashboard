(() => {
  'use strict';
  const copy = {
    sentiment: ['市場情緒', '投資者偏樂觀、偏審慎，定係訊號不一？', '分開睇 Fear & Greed、VIX 同 AAII；綜合分數唔代表每項指標方向一致。'],
    flow: ['資金流向', '邊度錄得淨流入，邊度錄得淨流出？', '美股整體同科技／AI 分開睇。Gamma 係期權影響估算，唔係實際資金流。']
  };
  function mount() {
    const style = document.createElement('style');
    style.textContent = '.readability-intro{margin:0 0 16px;line-height:1.55;color:var(--text-secondary)}.readability-intro small{display:block;margin-top:5px;color:var(--text-muted)}#positioning-percentiles .pp-card strong{display:block;margin-bottom:4px}#positioning-percentiles .pp-badge{margin:0 0 4px}';
    document.head.append(style);
    function intro(parent, before, text, note) {
      const p = document.createElement('p');
      p.className = 'readability-intro';
      p.textContent = text;
      if (note) {
        const small = document.createElement('small');
        small.textContent = note;
        p.append(small);
      }
      parent.insertBefore(p, before);
    }
    for (const [key, [title, subtitle, note]] of Object.entries(copy)) {
      const id = 'summary' + key[0].toUpperCase() + key.slice(1);
      const item = document.getElementById(id)?.closest('.summary-item');
      const label = item?.querySelector('.summary-label');
      if (label) label.textContent = title + ' · ' + (key === 'flow' ? 'Flow' : 'Sentiment');
      const heading = [...document.querySelectorAll('.dashboard-grid .card-title')].find(el => new RegExp('\\b' + key + '\\b', 'i').test(el.textContent));
      const header = heading?.closest('.card-header');
      if (!header) continue;
      heading.textContent = title;
      intro(header.parentElement, header.nextSibling, subtitle, note);
      if (key === 'flow') {
        const gamma = [...header.parentElement.querySelectorAll('.metric-label')].find(el => /gamma/i.test(el.textContent));
        if (gamma) gamma.textContent = '期權影響 · Gamma（唔係資金流）';
      }
    }
    function positioning() {
      const section = document.getElementById('positioning-percentiles');
      const heading = section?.querySelector('h2');
      if (!heading) return false;
      heading.textContent = '資金倉位一覽';
      intro(section, heading.nextSibling, '每條柱同該指標自己嘅歷史比較；越近 100，代表讀數越接近自身歷史高位。');
      const cards = section.querySelector('.pp-cards');
      const notice = section.querySelector('.pp-notice');
      if (cards && notice) section.insertBefore(cards, notice);
      const titles = ['股票倉位模型偏低', '半導體高過自身歷史中位', '總槓桿高，唔等於睇好'];
      section.querySelectorAll('.pp-card').forEach((card, i) => {
        if (!titles[i]) return;
        const title = document.createElement('strong');
        title.textContent = titles[i];
        card.prepend(title);
      });
      const summaries = section.querySelectorAll('details > summary');
      if (summaries[0]) summaries[0].textContent = '有倉位數據但未有分位／其他缺失';
      if (summaries[1]) summaries[1].textContent = '數據點樣計？分類、口徑及來源';
      const chart = section.querySelector('#pp-chart');
      if (chart) {
        const promoteTypes = () => chart.querySelectorAll('.pp-row > div:first-child').forEach(cell => {
          const badge = cell.querySelector('.pp-badge');
          if (!badge || cell.firstChild === badge) return;
          const br = badge.previousSibling;
          if (br?.nodeName === 'BR') br.remove();
          cell.prepend(badge, document.createElement('br'));
        });
        new MutationObserver(promoteTypes).observe(chart, {childList: true});
        promoteTypes();
      }
      return true;
    }
    if (!positioning()) {
      const observer = new MutationObserver(() => { if (positioning()) observer.disconnect(); });
      observer.observe(document.body, {childList: true, subtree: true});
      setTimeout(() => observer.disconnect(), 15000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
