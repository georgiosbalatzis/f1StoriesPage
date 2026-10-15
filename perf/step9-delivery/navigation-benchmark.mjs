import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(path.join(process.cwd(),'package.json'));
const puppeteer=require('puppeteer-core');
if(!process.argv[2]||!process.argv[3])throw new Error('Usage: node replay.mjs BASELINE_DIST CANDIDATE_DIST [OUTPUT_DIR] [main|inline|matrix|main-theme|inline-theme] [INLINE_CSS_HELPER] [ROUNDS=3]');
let root=path.resolve(process.argv[2]);
const baselineRoot=root;const candidateRoot=path.resolve(process.argv[3]);let activeVariant='baseline';
const outputDir=path.resolve(process.argv[4]||'/tmp/f1-step9-navigation');fs.mkdirSync(outputDir,{recursive:true});
const requestedMode=process.argv[5]||'main';const experimentalTheme=requestedMode.endsWith('-theme');const mode=requestedMode.replace(/-theme$/,'');const label=requestedMode;
const {inlineHeadStylesheets}=mode==='inline'?await import(new URL('file://'+path.resolve(process.argv[6]))):{inlineHeadStylesheets:null};
const rounds=Number(process.argv[7]||3);
const {execFileSync}=await import('node:child_process');
if(!fs.existsSync(path.join(outputDir,'key.pem')))execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(outputDir,'key.pem'),'-out',path.join(outputDir,'cert.pem'),'-subj','/CN=localhost','-days','1'],{stdio:'ignore'});
const fixturePublicKey=execFileSync('openssl',['x509','-in',path.join(outputDir,'cert.pem'),'-pubkey','-noout']);
const fixtureSpki=crypto.createHash('sha256').update(execFileSync('openssl',['pkey','-pubin','-outform','DER'],{input:fixturePublicKey})).digest('base64');
const profiles={fast:{latency:150,downloadThroughput:1.6e6/8,uploadThroughput:750e3/8},slow:{latency:300,downloadThroughput:500e3/8,uploadThroughput:250e3/8}};
const mime={'.css':'text/css','.js':'text/javascript','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png','.xml':'text/xml'};
let maxAge=600;
const files=new Map(); const requests=[];
const server=http2.createSecureServer({key:fs.readFileSync(path.join(outputDir,'key.pem')),cert:fs.readFileSync(path.join(outputDir,'cert.pem')),allowHTTP1:true},(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'https://localhost').pathname);
 if(pathname==='/seed'){res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});res.end('<title>seed</title>');return;}
 const target=path.join(root,pathname.endsWith('/')?pathname+'index.html':pathname);
 if(!target.startsWith(root)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
 let f=files.get(target);if(!f){let data=fs.readFileSync(target);if(inlineHeadStylesheets&&target.endsWith('.html'))data=Buffer.from(inlineHeadStylesheets(data.toString(),path.relative(root,target),rel=>fs.readFileSync(path.join(root,rel),'utf8')));if(experimentalTheme&&activeVariant==='candidate'&&target.endsWith('.html')){let html=data.toString();const code=fs.readFileSync(path.join(root,'scripts/theme-init.min.js'),'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m,'').trim()+'\n';const hash=crypto.createHash('sha256').update(code).digest('base64');const tag=/<script\b[^>]*\bsrc=["']\/scripts\/theme-init(?:\.min)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/i;if(tag.test(html)){html=html.replace(tag,`<script>${code}</script>`).replace(/script-src 'self'/,`script-src 'self' 'sha256-${hash}'`);data=Buffer.from(html);}}const gzip=/\.(css|js|json|html|svg|xml|txt)$/.test(target);f={data:gzip?zlib.gzipSync(data):data,gzip,etag:'"'+crypto.createHash('md5').update(data).digest('hex')+'"'};files.set(target,f);}
 const headers={'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':`max-age=${maxAge}`,'etag':f.etag,'vary':'Accept-Encoding'};
 if(f.gzip)headers['content-encoding']='gzip';
 const status=req.headers['if-none-match']===f.etag?304:200;
 requests.push({url:req.url,status,bytes:status===304?0:f.data.length,protocol:req.httpVersion,time:Date.now()});
 res.writeHead(status,headers);res.end(status===304?undefined:f.data);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`https://localhost:${server.address().port}`;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || require('chrome-launcher').Launcher.getFirstInstallation(),headless:true,args:[`--ignore-certificate-errors-spki-list=${fixtureSpki}`,'--no-first-run','--disable-background-networking','--disable-extensions','--disable-sync','--disable-component-update']});
const rows=[];
const ids=JSON.parse(fs.readFileSync(path.join(root,'blog-module/blog-index-data.json'))).p.slice(0,2).map(p=>p[0]);
const article=ids.map(id=>`/blog-module/blog-entries/${id}/article.html`);
const routeSequence=mode==='matrix'?[['home','/'],['home-article',article[0]],['article-article',article[1]],['article-edition','/blog-module/blog/index.html'],['home-repeat','/'],['home-standings','/standings/'],['standings-article',article[0]]]:mode==='inline'?[['home','/'],['direct-article',article[0]]]:[['home','/'],['home-article',article[0]],['article-article',article[1]]];
try { for(let round=0;round<rounds;round++)for(const [profile,conditions] of Object.entries(profiles))for(const variant of (round%2?['candidate','baseline']:['baseline','candidate'])){ root=variant==='candidate'?candidateRoot:baselineRoot;activeVariant=variant; files.clear();
 const context=await browser.createBrowserContext();const page=await context.newPage();await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:1});
 const cdp=await page.createCDPSession();const priorities=[];cdp.on('Network.requestWillBeSent',e=>priorities.push({url:e.request.url,type:e.type,initialPriority:e.request.initialPriority,time:e.timestamp}));cdp.on('Network.resourceChangedPriority',e=>priorities.push({requestId:e.requestId,priority:e.newPriority,time:e.timestamp}));await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,...conditions});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await cdp.send('Network.setBlockedURLs',{urls:['*://api.jolpi.ca/*','*://api.openf1.org/*','*://anchor.fm/*','*://www.googletagmanager.com/*','*://www.google-analytics.com/*','*://region1.google-analytics.com/*','*://f1stories-gr.disqus.com/*','*://*.disquscdn.com/*']});
 await page.evaluateOnNewDocument(()=>{try{localStorage.setItem('f1stories-cookie-consent-v1',JSON.stringify({ts:0,essential:true,analytics:false}));}catch{}window.__navstats={lcp:0,cls:0,longtasks:[],pageshow:[]};new PerformanceObserver(l=>l.getEntries().forEach(e=>(window.__navstats.lcp=e.startTime,window.__navstats.lcpElement={tag:e.element?.tagName,url:e.url,size:e.size}))).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__navstats.cls+=e.value;})).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__navstats.longtasks.push(e.duration))).observe({type:'longtask',buffered:true});addEventListener('pageshow',e=>window.__navstats.pageshow.push({persisted:e.persisted,time:performance.now()}));});
 for(const scenario of ['cold','warm','expired']){
  maxAge=scenario==='expired'?0:600;
  if(scenario==='cold'||scenario==='expired'){await cdp.send('Network.clearBrowserCache');await page.goto(origin+'/seed');}
  if(scenario==='expired'){for(const [,route] of routeSequence)await page.goto(origin+route,{waitUntil:'load',timeout:60000});}
  for(const [transition,route] of routeSequence){
   if(scenario==='cold'&&transition==='direct-article'){await cdp.send('Network.clearBrowserCache');await page.goto(origin+'/seed');}
   const reqStart=requests.length;const priorityStart=priorities.length;const start=Date.now();await page.goto(origin+route,{waitUntil:'load',timeout:60000});await new Promise(r=>setTimeout(r,400));
   const metrics=await page.evaluate(()=>({nav:performance.getEntriesByType('navigation')[0].toJSON(),paint:performance.getEntriesByType('paint').map(e=>e.toJSON()),stats:window.__navstats,resources:performance.getEntriesByType('resource').map(e=>({url:e.name,start:e.startTime,duration:e.duration,transfer:e.transferSize,encoded:e.encodedBodySize,protocol:e.nextHopProtocol,initiator:e.initiatorType}))}));
   const row={label,variant,round,profile,scenario,transition,route,elapsed:Date.now()-start,metrics,priorities:priorities.slice(priorityStart),requests:requests.slice(reqStart)};rows.push(row);fs.writeFileSync(path.join(outputDir,`${label}.json`),JSON.stringify(rows,null,2));
   console.log(JSON.stringify({variant,round,profile,scenario,transition,fcp:metrics.paint.find(e=>e.name==='first-contentful-paint')?.startTime,lcp:metrics.stats.lcp,bytes:row.requests.reduce((s,r)=>s+r.bytes,0),requests:row.requests.length,status304:row.requests.filter(r=>r.status===304).length}));
  }
 }
 // Native back/forward; CDP does not reload page, capture the persisted pageshow signal.
 await page.goBack({waitUntil:'load',timeout:30000});await new Promise(r=>setTimeout(r,300));const back=await page.evaluate(()=>({url:location.href,stats:window.__navstats,reason:performance.getEntriesByType('navigation')[0]?.notRestoredReasons}));rows.push({label,variant,round,profile,scenario:'history',back});
 await context.close();
}
}catch(error){fs.writeFileSync(path.join(outputDir,`${label}-error.txt`),error.stack||String(error));throw error;}finally{await browser.close();server.close();}
fs.writeFileSync(path.join(outputDir,`${label}.json`),JSON.stringify(rows,null,2));
