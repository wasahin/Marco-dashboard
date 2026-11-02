const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','data','overview.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dateNY=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const pct=(a,b)=>a>0&&Number.isFinite(b)?(b/a-1)*100:null;
async function history(ticker){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker)+'?interval=1d&range=6mo',{headers:{'User-Agent':'macro-dashboard/1.0'},signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const raw=await response.json(),r=raw.chart?.result?.[0];
      if(!r?.timestamp)throw Error('No daily bars');
      const today=dateNY(new Date()),hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date()));
      const rows=r.timestamp.map((t,i)=>({date:dateNY(new Date(t*1000)),close:r.indicators.quote[0].close[i]})).filter(x=>Number.isFinite(x.close)&&x.close>0&&(x.date<today||(x.date===today&&hour>=17)));
      if(rows.length<24)throw Error('Insufficient completed sessions');return rows;
    }catch(e){if(attempt===2)throw e;await sleep(3000*2**attempt+Math.random()*1000);}
  }
}
async function main(){
  if(typeof fetch!=='function')throw Error('Node 18+ required');
  const d=JSON.parse(fs.readFileSync(file,'utf8'));const errors=[],h={};
  const symbols=[...new Set(['SPY','VOO','QQQ','IWM','DIA','RSP',...d.sectors.map(x=>x.ticker),...d.themes.map(x=>x.ticker)])];
  for(const s of symbols){try{h[s]=await history(s);}catch(e){errors.push(s+': '+e.message);}await sleep(3100);}
  const spy=h.SPY;if(!spy)throw Error('SPY unavailable: snapshot not changed');
  const lastFriday=[...spy].reverse().find(x=>new Date(x.date+'T12:00:00Z').getUTCDay()===5);if(!lastFriday)throw Error('No completed Friday');
  const end=lastFriday.date,weekTarget=new Date(end+'T12:00:00Z');weekTarget.setUTCDate(weekTarget.getUTCDate()-7);
  const monthTarget=new Date(end+'T12:00:00Z'),day=monthTarget.getUTCDate();monthTarget.setUTCDate(1);monthTarget.setUTCMonth(monthTarget.getUTCMonth()-1);const max=new Date(Date.UTC(monthTarget.getUTCFullYear(),monthTarget.getUTCMonth()+1,0)).getUTCDate();monthTarget.setUTCDate(Math.min(day,max));
  const before=target=>[...spy].reverse().find(x=>x.date<=target)?.date;
  const week=before(weekTarget.toISOString().slice(0,10)),month=before(monthTarget.toISOString().slice(0,10));
  if(!week||!month)throw Error('Missing baseline');
  function closes(s){const rows=h[s];return [month,week,end].map(date=>rows?.find(x=>x.date===date)?.close??null);}
  const required=symbols.filter(s=>!closes(s).every(Number.isFinite));
  if(required.length){console.error('Keeping old snapshot to avoid mixed observation windows:',required,errors);process.exitCode=1;return;}
  const base=closes('SPY'),bm=pct(base[0],base[2]);
  for(const x of [...d.sectors,...d.benchmarks]){const c=closes(x.ticker);x.w=pct(c[1],c[2]);x.m=pct(c[0],c[2]);x.rm=x.m-bm;x.source='yahoo';if(x.aum!=null){delete x.aum;}}
  for(const x of d.themes){x.closes=closes(x.ticker);x.source='yahoo';}
  d.themeBaseline={ticker:'SPY',closes:base,source:'yahoo'};
  d.marketHealth.equalWeight={ticker:'RSP',closes:closes('RSP'),source:'yahoo'};
  d.priceAsOf=end;d.period={weekStart:week,monthStart:month,end};d.preparedAt=new Date().toISOString().slice(0,10);
  d.sources.yahoo={name:'Yahoo Finance chart daily close',url:'https://finance.yahoo.com/',observedAt:end,quality:'undocumented endpoint; quote close, not verified total return; latest complete Friday, not WTD'};
  d.refresh={mode:'manual price refresh; macro/news require separate review',lastAttempt:new Date().toISOString(),errors};
  const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2)+'\n');fs.renameSync(tmp,file);console.log('Updated overview through '+end+'; review diff before commit. No GitHub write performed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
