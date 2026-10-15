import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');
import fs from 'node:fs';
const root=process.argv[2] || '/tmp/f1-step9-network';
fs.mkdirSync(root, { recursive: true });
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || Launcher.getFirstInstallation(),args:['--disable-background-networking','--disable-component-update']});
const context=await browser.newContext();
const page=await context.newPage();
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
const target='https://f1-stories.gr/styles.min.css?step9-cache-expiry='+Date.now();
const events=[];
for(const type of ['requestWillBeSent','responseReceived','responseReceivedExtraInfo','requestServedFromCache','loadingFinished']) cdp.on('Network.'+type,e=>{events.push({type,time:Date.now(),...e});});
await page.goto('https://f1-stories.gr/robots.txt');
const start=Date.now();
async function probe(label,cache){const result=await page.evaluate(async({target,cache})=>{const start=performance.now();const r=await fetch(target,cache?{cache}:{});const text=await r.text();return {status:r.status,headers:Object.fromEntries(r.headers),duration:performance.now()-start,bytes:text.length,resource:performance.getEntriesByName(target).at(-1)?.toJSON()};},{target,cache});fs.writeFileSync(root+'/expiry-'+label+'.json',JSON.stringify({label,elapsed:Date.now()-start,target,...result},null,2));fs.writeFileSync(root+'/browser-expiry-events.json',JSON.stringify(events,null,2));console.log(label,JSON.stringify(result));}
await probe('cold');await probe('fresh');await probe('forced-revalidation','no-cache');
while(Date.now()-start<610000){await new Promise(r=>setTimeout(r,30000));console.log('elapsed',Math.round((Date.now()-start)/1000));}
await probe('expired');await probe('restored-fresh');
await browser.close();
