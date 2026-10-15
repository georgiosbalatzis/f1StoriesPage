import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(path.join(process.cwd(),'package.json'));
const puppeteer=require('puppeteer-core');
if(!process.argv[2]||!process.argv[3])throw new Error('Usage: node history-qa.mjs BASELINE_DIST CANDIDATE_DIST [OUTPUT_DIR]');
let root=path.resolve(process.argv[2]);
const baselineRoot=root;const candidateRoot=path.resolve(process.argv[3]);
const outputDir=path.resolve(process.argv[4]||'/tmp/f1-step9-navigation');fs.mkdirSync(outputDir,{recursive:true});
const {execFileSync}=await import('node:child_process');
if(!fs.existsSync(path.join(outputDir,'key.pem')))execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(outputDir,'key.pem'),'-out',path.join(outputDir,'cert.pem'),'-subj','/CN=localhost','-days','1'],{stdio:'ignore'});
const fixturePublicKey=execFileSync('openssl',['x509','-in',path.join(outputDir,'cert.pem'),'-pubkey','-noout']);
const fixtureSpki=crypto.createHash('sha256').update(execFileSync('openssl',['pkey','-pubin','-outform','DER'],{input:fixturePublicKey})).digest('base64');
const mime={'.css':'text/css','.js':'text/javascript','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png','.xml':'text/xml'};
let maxAge=600;
const files=new Map(); const requests=[];
const server=http2.createSecureServer({key:fs.readFileSync(path.join(outputDir,'key.pem')),cert:fs.readFileSync(path.join(outputDir,'cert.pem')),allowHTTP1:true},(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'https://localhost').pathname);
 if(pathname==='/seed'){res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});res.end('<title>seed</title>');return;}
 const target=path.join(root,pathname.endsWith('/')?pathname+'index.html':pathname);
 if(!target.startsWith(root)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
 let f=files.get(target);
 if(!f){
  const data=fs.readFileSync(target),gzip=/\.(css|js|json|html|svg|xml|txt)$/.test(target);
  f={data:gzip?zlib.gzipSync(data):data,gzip,etag:'\"'+crypto.createHash('md5').update(data).digest('hex')+'\"'};
  files.set(target,f);
 }
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
const article=`/blog-module/blog-entries/${ids[0]}/article.html`;
const sequences={editorial:['/',article,'/blog-module/blog/index.html'],standings:['/','/standings/',article]};
try {
for(const variant of ['baseline','candidate'])for(const width of [390,768,1440])for(const theme of ['light','dark']){
 root=variant==='candidate'?candidateRoot:baselineRoot;files.clear();
 const context=await browser.createBrowserContext();
 for(const [sequence,routes] of Object.entries(sequences)){
  const page=await context.newPage();await page.setViewport({width,height:900,isMobile:width===390,deviceScaleFactor:1});
  const cdp=await page.createCDPSession();await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['*://api.jolpi.ca/*','*://api.openf1.org/*','*://anchor.fm/*','*://www.googletagmanager.com/*','*://www.google-analytics.com/*','*://region1.google-analytics.com/*','*://f1stories-gr.disqus.com/*','*://*.disquscdn.com/*']});
  await page.evaluateOnNewDocument(theme=>{
   localStorage.setItem('f1stories-theme',theme);
   localStorage.setItem('f1stories-cookie-consent-v1',JSON.stringify({ts:0,essential:true,analytics:false}));
   window.__historySignals=[];window.__historyToken=crypto.randomUUID();
   addEventListener('pageshow',event=>window.__historySignals.push({persisted:event.persisted,url:location.href}));
  },theme);
  await page.goto(origin+'/seed',{waitUntil:'load'});
  const cacheStart=requests.length;
  await page.evaluate(async()=>{for(let i=0;i<2;i++)await fetch('/standings/standings-cache.json',{cache:'no-cache'}).then(response=>response.json());});
  const conditionalRequests=requests.slice(cacheStart);
  const freshStart=requests.length;
  await page.evaluate(()=>fetch('/standings/standings-cache.json').then(response=>response.json()));
  const cacheCalibration={conditionalRequests,freshRequests:requests.slice(freshStart),pass:conditionalRequests.some(request=>request.status===304)&&requests.length===freshStart};
  const snapshots=[];
  const read=()=>page.evaluate(()=>({url:location.href,title:document.title,token:window.__historyToken,theme:document.documentElement.getAttribute('data-theme')==='light'?'light':'dark',signals:window.__historySignals,protocol:performance.getEntriesByType('navigation')[0]?.nextHopProtocol,notRestoredReasons:performance.getEntriesByType('navigation')[0]?.notRestoredReasons}));
  for(const route of routes){await page.goto(origin+route,{waitUntil:'load',timeout:30000});await new Promise(r=>setTimeout(r,100));snapshots.push(await read());}
  const checks=[];
  for(const [direction,index] of [['back',1],['back',0],['forward',1],['forward',2]]){
   const start=requests.length;
   await (direction==='back'?page.goBack({waitUntil:'load',timeout:30000}):page.goForward({waitUntil:'load',timeout:30000}));
   await new Promise(r=>setTimeout(r,100));
   const state=await read();const added=requests.slice(start);
   const check={direction,index,state,requests:added,bodyBytes:added.reduce((total,request)=>total+request.bytes,0)};
   check.pass=state.url===snapshots[index].url&&state.token===snapshots[index].token&&state.theme===theme&&state.signals.at(-1)?.persisted===true&&state.notRestoredReasons===null&&check.bodyBytes===0;
   checks.push(check);
  }
  const row={variant,width,theme,sequence,cacheCalibration,snapshots,checks,pass:cacheCalibration.pass&&checks.every(check=>check.pass)};rows.push(row);
  fs.writeFileSync(path.join(outputDir,'history.json'),JSON.stringify(rows,null,2));
  console.log(JSON.stringify({variant,width,theme,sequence,pass:row.pass,checks:checks.map(check=>({direction:check.direction,persisted:check.state.signals.at(-1)?.persisted,bodyBytes:check.bodyBytes,tokenMatches:check.state.token===snapshots[check.index].token,theme:check.state.theme}))}));
  await page.close();
 }
 await context.close();
}
} catch(error){fs.writeFileSync(path.join(outputDir,'history-error.txt'),error.stack||String(error));throw error;}finally{await browser.close();server.close();}
if(rows.some(row=>!row.pass))process.exitCode=1;
