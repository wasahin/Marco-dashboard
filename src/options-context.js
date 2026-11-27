(() => {
  'use strict';
  const add = (p,t,s) => {const e=document.createElement(t); e.textContent=s; p.append(e); return e;};
  const mount = async () => {
    const grid=document.querySelector('.dashboard-grid');
    const place=(re,id)=>{
      const title=[...(grid?.querySelectorAll('.card-title')||[])].find(e=>re.test(e.textContent));
      const card=title?.closest('.card')||grid;
      const section=document.createElement('section'); section.id=id; section.className='card';
      if(card) card.after(section); else (document.querySelector('.container')||document.body).append(section);
      return section;
    };
    const options=place(/市場情緒|sentiment/i,'options-activity');
    const flows=place(/資金流向|\bflow\b/i,'spx-hedge-scenarios');
    add(options,'h2','期權成交：Put 量同 Put/Call');
    add(options,'em','成交比率唔等於淨買入，亦唔代表交易商要買定沽。');
    add(options,'p','Cboe 全產品；唔係全美合計，亦唔係截圖原始系列。比率＝Put 成交張數 ÷ Call 成交張數；保留高於 1.50 嘅有效數值。');
    const source=add(options,'a','Cboe 每日統計'); source.href='https://www.cboe.com/markets/us/options/market-statistics/daily/';
    add(options,'p','人工核實收市快照；未接駁每日自動更新。');
    add(flows,'h2','SPX 對沖情景');
    add(flows,'em','未取得可核實嘅交易商有方向淨倉，暫不估算買賣額。');
    add(flows,'p','以下係同一週末前最後一個美股交易日收市嘅壓力測試，唔係預測。方向只適用於假設交易商淨沽、接近到期而仍價外嘅 Put 倉位，唔代表整本帳簿。');
    const list=add(flows,'ul','');
    add(list,'li','時間流逝｜SPX、隱含波幅不變：價外 Put 嘅對沖淡倉可能縮細。');
    add(list,'li','平靜反彈｜SPX +1%，隱含波幅 −2 個波幅點：可能增加對沖回補。');
    add(list,'li','再度下跌｜SPX −1%，隱含波幅 +3 個波幅點：靠近行使價時可能轉為加淡倉。');
    add(flows,'p','系統性資金（CTA／波幅控制／風險平價）：未取得可比較嘅 SPX 等值估算。影片 US$30–50B 屬未核實外部評論，唔計入合計。');
    add(flows,'p','合計：未能比較。兩邊須用相同預測期限、標的及名義金額單位。');
    try {
      const res=await fetch('data/options-context.json',{cache:'no-store'}); if(!res.ok) throw Error();
      const {rows}=await res.json();
      const data=rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isSafeInteger(r.put)&&r.put>=0&&Number.isSafeInteger(r.call)&&r.call>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-60);
      const last=data.at(-1); if(!last) throw Error();
      const ratio=r=>r.put/r.call;
      add(options,'p',`${last.date}（美股交易日）｜Put ${last.put.toLocaleString('en-US')} 張｜Put/Call ${ratio(last).toFixed(2)}`);
      const cutoff=new Date(Date.parse(last.date)-7*86400000).toISOString().slice(0,10);
      const prev=data.find(r=>r.date===cutoff);
      add(options,'p',prev?`較 ${prev.date}：Put 張數變化 ${(last.put-prev.put).toLocaleString('en-US')}；比率變化 ${(ratio(last)-ratio(prev)).toFixed(2)}`:'按週比較：未有七日前同口徑讀數。');
      const draw=(name,values,line)=>{
        const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
        svg.setAttribute('viewBox','0 0 600 130'); svg.style.width='100%'; svg.setAttribute('role','img'); svg.setAttribute('aria-label',name);
        const max=Math.max(...values,line?1:0,0.01)*1.08, step=580/values.length, y=v=>116-104*v/max;
        const shape=(tag,attrs)=>{const e=document.createElementNS(ns,tag); for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); svg.append(e);};
        add(options,'h3',name);
        if(line) {
          shape('line',{x1:10,x2:590,y1:y(1),y2:y(1),stroke:'currentColor','stroke-dasharray':'5 5'});
          if(values.length>1) shape('polyline',{points:values.map((v,i)=>`${10+step*(i+0.5)},${y(v)}`).join(' '),fill:'none',stroke:'#fb923c','stroke-width':3});
          values.forEach((v,i)=>shape('circle',{cx:10+step*(i+0.5),cy:y(v),r:4,fill:'#fb923c'}));
        } else values.forEach((v,i)=>{const w=Math.min(36,step*0.7); shape('rect',{x:10+step*(i+0.5)-w/2,y:y(v),width:w,height:116-y(v),fill:'#3b82f6'});});
        options.append(svg);
      };
      draw('Put 成交量（張）',data.map(r=>r.put),false);
      draw('Put/Call（虛線＝1.00）',data.map(ratio),true);
      add(options,'small',`${data[0].date} 至 ${last.date}｜${data.length} 個已核實交易日${data.length===1?'；暫未有歷史走勢。':''}`);
      const details=add(options,'details',''); add(details,'summary','逐日讀數');
      for(const r of data) add(details,'p',`${r.date}｜Put ${r.put.toLocaleString('en-US')} 張｜Call ${r.call.toLocaleString('en-US')} 張｜比率 ${ratio(r).toFixed(2)}`);
    } catch {add(options,'p','未能載入已核實數據；唔以零代替。');}
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
