// Localhost server + dashboard for `metriq trace`.
//
// Serves the SAME payload the web /usage dashboard uses (built from
// src/core/usage), but from the developer's own machine where the real Claude
// Code / Codex logs actually live. Bound to 127.0.0.1 and guarded by a
// per-session token so no other local process can read the data.

import http from "node:http";

export function createTraceServer({ getData, token }) {
  return http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    if ((url.searchParams.get("t") || req.headers["x-trace-token"]) !== token) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("Forbidden — invalid or missing session token.");
      return;
    }

    if (url.pathname === "/api/data") {
      const days = parseInt(url.searchParams.get("days") || "30", 10);
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(getData(days)));
      return;
    }

    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(dashboardHTML(token));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  });
}

export function dashboardHTML(token) {
  // In-page script avoids backticks so it can sit inside this template literal.
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>metriq trace</title>
<style>
  :root{
    --bg:#080b08;--card:#0f140f;--card2:#141a14;--border:#232c22;
    --t1:#f1f4ef;--t2:#a9b3a4;--t3:#727c6d;--accent:#4be277;
    --high:#e66767;--med:#fab219;--info:#3987e5;
    --s1:#3987e5;--s2:#199e70;--s3:#c98500;--s4:#9085e9;--s5:#d55181;--s6:#d95926;
    --mono:ui-monospace,"Cascadia Code","SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  }
  @media (prefers-color-scheme: light){:root{
    --bg:#f7f8f6;--card:#fff;--card2:#eef1ec;--border:#d9ded4;
    --t1:#10160f;--t2:#4c554a;--t3:#79826f;--accent:#12a150;
    --high:#d03b3b;--med:#d98400;--info:#2a78d6;
    --s1:#2a78d6;--s2:#1baf7a;--s3:#c98500;--s4:#4a3aa7;--s5:#d55181;--s6:#d95926;}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--t1);font-family:var(--sans);line-height:1.5}
  .wrap{max-width:1080px;margin:0 auto;padding:22px}
  .mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
  header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px}
  .brand{display:flex;align-items:center;gap:9px;font-weight:750;letter-spacing:-.02em}
  .mark{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:var(--accent);color:var(--bg);font-family:var(--mono);font-weight:800}
  .live{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent);padding:3px 9px;border-radius:99px}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:p 2s infinite}
  @keyframes p{0%,100%{opacity:1}50%{opacity:.35}}
  select{font-family:var(--mono);font-size:12px;background:var(--card);color:var(--t1);border:1px solid var(--border);border-radius:7px;padding:5px 8px}
  .meta{color:var(--t3);font-family:var(--mono);font-size:12px;margin:2px 0 18px}
  .grid{display:grid;gap:14px}
  .tiles{grid-template-columns:repeat(4,1fr)}
  @media(max-width:760px){.tiles{grid-template-columns:repeat(2,1fr)}}
  .card{background:var(--card);border:1px solid var(--border);border-radius:13px;padding:15px}
  .lab{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)}
  .val{font-family:var(--mono);font-size:26px;font-weight:640;letter-spacing:-.02em;margin-top:7px;line-height:1}
  .val small{font-size:14px;color:var(--t3)}
  .sub{font-size:12px;color:var(--t2);margin-top:7px}
  .cols{grid-template-columns:1.3fr 1fr;margin-top:14px}
  @media(max-width:760px){.cols{grid-template-columns:1fr}}
  h3{margin:0 0 12px;font-size:14px}
  .bars{display:flex;align-items:flex-end;gap:4px;height:150px;padding-top:8px}
  .bars .b{flex:1;background:var(--s2);border-radius:4px 4px 0 0;min-height:2px}
  .bars .b:hover{background:var(--accent)}
  .donut{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  .ring{width:140px;height:140px;border-radius:50%;flex:0 0 140px;position:relative}
  .ring::after{content:"";position:absolute;inset:24px;border-radius:50%;background:var(--card)}
  .ring .ctr{position:absolute;inset:0;display:grid;place-content:center;text-align:center;z-index:1}
  .ring .ctr b{font-family:var(--mono);font-size:20px}
  .ring .ctr span{font-family:var(--mono);font-size:10px;color:var(--t3);display:block}
  .leg{display:flex;flex-direction:column;gap:8px;flex:1;min-width:140px}
  .leg .li{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--t2)}
  .leg .sw{width:10px;height:10px;border-radius:3px;flex:0 0 10px}
  .leg .li .n{color:var(--t1);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .leg .li .v{font-family:var(--mono);color:var(--t1)}
  .ins{display:flex;flex-direction:column;gap:10px}
  .ins .i{border-left:3px solid var(--t3);padding:2px 0 2px 12px}
  .ins .i.high{border-color:var(--high)}.ins .i.medium{border-color:var(--med)}.ins .i.info{border-color:var(--info)}
  .ins .i h4{margin:0;font-size:13.5px}
  .ins .i p{margin:3px 0 0;font-size:12.5px;color:var(--t2)}
  .ins .i .act{color:var(--t1)}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--border)}
  td{padding:9px 8px;border-bottom:1px solid var(--border);color:var(--t2)}
  tr:last-child td{border-bottom:0}
  td.n{font-family:var(--mono);text-align:right}
  td.m{color:var(--t1)}
  .scroll{overflow-x:auto}
  .empty{padding:40px;text-align:center;color:var(--t2)}
  .foot{color:var(--t3);font-family:var(--mono);font-size:11px;margin-top:18px}
</style></head>
<body><div class="wrap">
  <header>
    <span class="brand"><span class="mark">◇</span> metriq trace</span>
    <span class="live"><span class="dot"></span> LIVE</span>
    <span style="flex:1"></span>
    <select id="days"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option></select>
  </header>
  <div id="meta" class="meta"></div>
  <div id="root"></div>
  <div class="foot">metriq trace · localhost only · reads Claude Code + Codex logs on this machine · Ctrl-C to stop</div>
</div>
<script>
var TOKEN=${JSON.stringify(token)};
var DAYS=30;
var COLORS=["--s1","--s2","--s3","--s4","--s5","--s6"];
function cssv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
function fmtTok(n){return n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?(n/1e3).toFixed(1)+"k":String(Math.round(n))}
function usd(n){return "$"+(n||0).toFixed(2)}
function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})}
function tile(l,v,s){return '<div class="card"><div class="lab">'+l+'</div><div class="val">'+v+'</div><div class="sub">'+s+'</div></div>'}

function render(d){
  var meta=document.getElementById("meta"), root=document.getElementById("root");
  if(!d.available){
    meta.textContent="no local agent logs found";
    root.innerHTML='<div class="card empty">No Claude Code or Codex logs found on this machine yet.<br>Use an AI coding agent, then this dashboard fills in automatically.</div>';
    return;
  }
  var t=d.totals, reqs=(d.models||[]).reduce(function(a,m){return a+m.requests},0);
  meta.textContent="sources: "+(d.sources||[]).join(", ")+" · last "+d.days+" days · "+(d.sessions||[]).length+" sessions · updated "+new Date().toLocaleTimeString();

  var tiles='<div class="grid tiles">'+
    tile("Total tokens",fmtTok(t.totalTokens),reqs+" requests · "+(d.models||[]).length+" models")+
    tile("Total cost",usd(t.costUSD),"API-equivalent value")+
    tile("Saved by caching",usd(t.cacheSavingsUSD),fmtTok(t.cacheReadTokens)+" tokens from cache")+
    tile("Output tokens",fmtTok(t.outputTokens),fmtTok(t.inputTokens)+" input")+
    '</div>';

  // daily bars (cost)
  var daily=d.daily||[], dmax=Math.max.apply(null,daily.map(function(x){return x.costUSD}).concat([0.0001]));
  var bars=daily.map(function(x){return '<div class="b" title="'+x.date+" · "+usd(x.costUSD)+" · "+fmtTok(x.totalTokens)+' tok" style="height:'+(x.costUSD/dmax*100)+'%"></div>'}).join("");

  // model donut (cost)
  var models=d.models||[], mtot=models.reduce(function(a,m){return a+m.costUSD},0)||1, acc=0, stops=[];
  models.forEach(function(m,i){var c=cssv(COLORS[i%COLORS.length]);var f=acc/mtot*100;acc+=m.costUSD;stops.push(c+" "+f+"% "+(acc/mtot*100)+"%")});
  var donut='<div class="donut"><div class="ring" style="background:'+(stops.length?"conic-gradient("+stops.join(",")+")":"var(--card2)")+'">'+
    '<div class="ctr"><b>'+usd(t.costUSD)+'</b><span>total</span></div></div><div class="leg">'+
    models.map(function(m,i){return '<div class="li"><span class="sw" style="background:'+cssv(COLORS[i%COLORS.length])+'"></span><span class="n">'+esc(m.label)+'</span><span class="v">'+usd(m.costUSD)+'</span></div>'}).join("")+'</div></div>';

  // insights
  var ins=d.insights||[];
  var insHTML=ins.length?ins.map(function(i){return '<div class="i '+i.severity+'"><h4>'+esc(i.title)+'</h4><p>'+esc(i.evidence)+'</p><p class="act">→ '+esc(i.action)+'</p></div>'}).join(""):'<p class="sub">No issues flagged — usage looks healthy.</p>';

  // sessions
  var ss=(d.sessions||[]).slice(0,10);
  var rows=ss.map(function(s){return '<tr><td class="m">'+esc(s.project)+'</td><td>'+esc((s.models||[]).map(function(m){return m.split("-").slice(0,2).join("-")}).join(", "))+'</td><td class="n">'+s.requests+'</td><td class="n">'+fmtTok(s.totalTokens)+'</td><td class="n">'+usd(s.costUSD)+'</td></tr>'}).join("")||'<tr><td colspan="5" class="sub">no sessions in range</td></tr>';

  root.innerHTML=tiles+
    '<div class="grid cols"><div class="card"><h3>Cost per day</h3><div class="bars">'+bars+'</div></div>'+
    '<div class="card"><h3>Cost by model</h3>'+donut+'</div></div>'+
    '<div class="grid cols"><div class="card"><h3>Insights &amp; recommendations</h3><div class="ins">'+insHTML+'</div></div>'+
    '<div class="card"><h3>Recent sessions</h3><div class="scroll"><table><thead><tr><th>Project</th><th>Model</th><th class="n">Reqs</th><th class="n">Tokens</th><th class="n">Cost</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></div>';
}

function poll(){fetch("/api/data?days="+DAYS+"&t="+TOKEN).then(function(r){return r.json()}).then(render).catch(function(){})}
document.getElementById("days").addEventListener("change",function(e){DAYS=parseInt(e.target.value,10);poll()});
poll();setInterval(poll,3000);
</script></body></html>`;
}
