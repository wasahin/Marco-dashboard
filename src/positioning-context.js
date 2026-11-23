(() => {
  'use strict';
  const add = (parent, tag, text) => {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  };
  const link = (parent, text, url) => { add(parent, 'a', text).href = url; };
  const report = 'https://www.chaincatcher.com/en/article/2307062';
  const fmt = value => value === '5Y' ? '過去 5 年' : value?.replace(/^since (\d{4})$/, '自 $1 年') || '比較期未披露';
  function mount() {
    const heading = [...document.querySelectorAll('.dashboard-grid .card-title')].find(el => /資金流向|\bflow\b/i.test(el.textContent));
    const host = heading?.closest('.card') || document.querySelector('.container') || document.body;
    const retail = add(host, 'section', '');
    retail.className = 'metric-item';
    add(retail, 'h3', '散戶資金流 · 美國上市股票及 ETF');
    add(retail, 'p', '週買入：未取得｜週賣出：未取得｜週淨買賣：未取得');
    add(retail, 'em', '未取得可核實嘅散戶專屬週讀數；唔用整體基金申購贖回代替。');
    const source = add(retail, 'p', '口徑：');
    link(source, 'VandaTrack 散戶交易估算', 'https://vanda.com/solutions/data/vandatrack');
    function attach() {
      const root = document.getElementById('positioning-percentiles');
      const chart = root?.querySelector('#pp-chart');
      if (!chart) return false;
      const style = add(document.head, 'style', '#positioning-percentiles .pp-card strong{font-style:italic;font-weight:normal}#positioning-percentiles .pp-row>span{overflow-wrap:anywhere}');
      style.id = 'positioning-context-style';
      function render() {
        for (const row of chart.querySelectorAll('.pp-row:not([data-context])')) {
          row.dataset.context = '1';
          const [label, body, rank] = row.children;
          const lookback = label.textContent.match(/回溯：([^；]*?)(?:觀察|$)/)?.[1]?.trim();
          add(rank, 'small', '').append(add(document.createDocumentFragment(), 'em', fmt(lookback === '未披露' ? null : lookback)));
          const weekly = [...body.querySelectorAll('small')].find(el => el.textContent.includes('上週分位變化'));
          if (weekly?.lastChild?.nodeType === Node.TEXT_NODE) weekly.lastChild.remove();
          const gross = label.textContent.includes('整體Prime Book總槓桿');
          add(body, 'small', gross ? '倉位週變化：+3.8 個百分點至 315.9% NAV（11/19；上期精確日期未披露）' : '倉位週變化：未取得同口徑數據');
          add(body, 'small', '分位週變化：未取得同口徑數據');
          add(body, 'small', '變動原因：未確認；唔由倉位變化反推交易。');
          add(body, 'small', gross ? '未來一週：整體客戶帳簿並無可核實淨買賣額。' : '未來一週：未取得同系列買賣額估算。');
          if (gross) link(add(body, 'small', ''), '週變化來源', report);
        }
      }
      new MutationObserver(render).observe(chart, {childList:true});
      render();
      const outlook = add(root, 'details', '');
      add(outlook, 'summary', '交易原因同前瞻買賣額點睇？');
      add(outlook, 'p', '有交易拆分先區分加多、沽多、加空或回補；系統性買賣同交易商 Delta 對沖另列，唔單靠分位歸因。');
      add(outlook, 'p', 'CTA 群組前瞻：未取得可核實、同一預測窗口嘅升市／橫行／跌市金額。群組淨敞口唔係單一基金落單額；期貨名義額唔係股票現貨成交額。');
      return true;
    }
    if (!attach()) {
      const observer = new MutationObserver(() => { if (attach()) observer.disconnect(); });
      observer.observe(document.body, {subtree:true, childList:true});
      setTimeout(() => observer.disconnect(), 15000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
