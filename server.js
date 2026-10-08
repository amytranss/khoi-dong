// TĂNG TỐC – MẠCH ĐIỆN ĐƠN GIẢN | chạy: node server.js (không cần cài thêm gói nào)
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const PORT=process.env.PORT||3000,DUR=60000,KEY='MẠCH ĐIỆN',games={};
const norm=s=>s.replace(/[đĐ]/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const now=()=>Date.now();
const el=g=>Math.min(DUR,g.status==='running'?g.acc+now()-g.run:g.acc);
const log=(g,msg,t)=>g.log.push({t:t==null?null:t,msg,at:now()});
function view(g,c){const rv=g.revealed,t=c.role==='t';
  return{code:g.code,dur:DUR,teams:g.teams,status:g.status,elapsed:el(g),now:now(),revealed:rv,key:rv?KEY:null,
  joined:[...new Set([...g.clients].filter(x=>x.team).map(x=>x.team))],
  answers:g.answers.filter(a=>t||a.team===c.team).map(a=>({team:a.team,text:a.text,t:a.t,ok:rv?a.ok:undefined})),
  log:t?g.log:[]}}
const push=g=>{for(const c of g.clients)c.res.write('data:'+JSON.stringify(view(g,c))+'\n\n')};
function arm(g){clearTimeout(g.tm);if(g.status==='running')g.tm=setTimeout(()=>{if(g.status==='running'){g.acc=DUR;g.status='ended';log(g,'⏰ Hết giờ',DUR);push(g)}},DUR-el(g)+30)}
const A={
  start(g){if(g.status==='idle'||g.status==='paused'){const f=g.status==='idle';g.status='running';g.run=now();log(g,f?'▶ START':'▶ Tiếp tục',el(g));arm(g)}},
  pause(g){if(g.status==='running'){g.acc=el(g);g.status='paused';clearTimeout(g.tm);log(g,'⏸ Tạm dừng',g.acc)}},
  reset(g){clearTimeout(g.tm);Object.assign(g,{status:'idle',acc:0,answers:[],revealed:false});log(g,'🔄 RESET GAME')},
  reveal(g){if(g.status!=='ended'){g.acc=el(g);g.status='ended';clearTimeout(g.tm)}g.revealed=true;log(g,'⚡ SHOW ANSWER: '+KEY)},
  teams(g,b){if(g.status!=='idle'||!Array.isArray(b.names))return;
    g.teams=b.names.slice(0,12).map((n,i)=>({id:'t'+(i+1),name:String(n).trim().slice(0,20)||'NHÓM '+(i+1)}))}
};
const ips=()=>Object.values(os.networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).map(i=>i.address);
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8'};
const send=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname;
  if(p==='/api/events'){
    const g=games[u.searchParams.get('code')];if(!g){res.writeHead(404);return res.end()}
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    const c={res,role:u.searchParams.get('role')==='t'?'t':'s',team:u.searchParams.get('team')||''};
    g.clients.add(c);push(g);
    const hb=setInterval(()=>res.write(':\n\n'),20000);
    req.on('close',()=>{clearInterval(hb);g.clients.delete(c);push(g)});return;
  }
  if(p==='/api/info')return send(res,200,{ips:ips(),port:PORT});
  if(req.method==='POST'&&p.startsWith('/api/')){
    let raw='';req.on('data',d=>{raw+=d;if(raw.length>5e3)req.destroy()});
    return req.on('end',()=>{let b={};try{b=JSON.parse(raw||'{}')}catch(e){}
      if(p==='/api/new'){let c;do c=String(1000+Math.floor(Math.random()*9000));while(games[c]);
        const g=games[c]={code:c,teams:[1,2,3,4].map(i=>({id:'t'+i,name:'NHÓM '+i})),status:'idle',acc:0,run:0,answers:[],log:[],revealed:false,clients:new Set()};
        log(g,'🎮 Tạo phòng '+c);return send(res,200,{code:c})}
      const g=games[b.code];if(!g)return send(res,404,{error:'Không tìm thấy mã phòng'});
      if(p==='/api/act'){if(!A[b.action])return send(res,400,{});A[b.action](g,b);push(g);return send(res,200,{ok:1})}
      if(p==='/api/submit'){
        const tm=g.teams.find(t=>t.id===b.team),text=String(b.text||'').trim().slice(0,60);
        if(!tm||!text)return send(res,400,{error:'Thiếu dữ liệu'});
        if(g.status!=='running'||el(g)>=DUR)return send(res,409,{error:'Đã hết giờ hoặc chưa bắt đầu'});
        if(g.answers.some(a=>a.team===tm.id))return send(res,409,{error:'Nhóm đã gửi đáp án rồi'});
        const t=el(g);g.answers.push({team:tm.id,text,t,ok:norm(text)===norm(KEY)});
        log(g,`${tm.name} gửi: "${text}"`,t);push(g);return send(res,200,{ok:1,t});}
      send(res,404,{});});
  }
  const f=p==='/'?'index.html':p==='/s'?'s.html':p.slice(1);
  const fp=path.join(__dirname,'public',path.basename(f));
  fs.readFile(fp,(e,d)=>{if(e){res.writeHead(404);return res.end('404')}res.writeHead(200,{'Content-Type':types[path.extname(fp)]||'text/plain'});res.end(d)});
}).listen(PORT,'0.0.0.0',()=>{console.log('\n⚡ TĂNG TỐC đang chạy!\n  Giáo viên: http://localhost:'+PORT);
  ips().forEach(i=>console.log('  Học sinh (iPad): http://'+i+':'+PORT+'/s'))});
