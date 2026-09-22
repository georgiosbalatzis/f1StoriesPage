/* Read-only checks against actual production allowlist and fixed content. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.dirname(root);
const source=fs.readFileSync(path.join(repo,'scripts/build/public-artifact.mjs'),'utf8');
const sets=source.slice(source.indexOf('const ROOT_FILES'),source.indexOf('const BLOG_ENTRY_PUBLIC_REFS'));
const predicates=source.slice(source.indexOf('function shouldCopyBlogEntry'),source.indexOf('function stripSecurityMeta'));
const context={path,fs,REPO_ROOT:repo,BLOG_ENTRY_PUBLIC_REFS:new Set(),PUBLIC_IMAGE_REFS:new Set(),isOptimizedImage:p=>/\.(avif|webp)$/.test(p)};
vm.createContext(context);vm.runInContext(sets+'\n'+predicates+'\nthis.canShip=shouldCopy;',context);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=[...walk(root),path.join(repo,'DESIGN_CONCEPTS.md'),path.join(repo,'DESIGN_COMPARISON.md')].filter(fs.existsSync);
for(const f of files)assert.equal(context.canShip(path.relative(repo,f)),false,`Exploration must not ship: ${f}`);
assert.equal(context.canShip('index.html'),true,'Real homepage stays public');
const content=JSON.parse(fs.readFileSync(path.join(root,'content.json'),'utf8'));
const normalize=s=>s.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
for(const c of 'abc'){
 const article=fs.readFileSync(path.join(root,`concept-${c}/article.html`),'utf8');
 for(const p of content.paragraphs)assert(normalize(article).includes(normalize(p)),`Missing paragraph in ${c}`);
 const home=fs.readFileSync(path.join(root,`concept-${c}/index.html`),'utf8');
 for(const record of content.articles)assert(home.includes(record.title) || record===content.articles[0]&&home.includes('Ο οδηγός που<br>πάντα πρόσφερε.'),`Missing story ${record.slug} in ${c}`);
 const data=fs.readFileSync(path.join(root,`concept-${c}/data.html`),'utf8');
 assert.equal((data.match(/<tr>/g)||[]).length,35,'22 drivers + 11 constructors + 2 headers');
 assert(data.includes('Στιγμιότυπο 22 Αυγούστου 2026'));
 for(const page of ['index.html','article.html','data.html']){
  const html=fs.readFileSync(path.join(root,`concept-${c}/${page}`),'utf8');
  assert.equal((html.match(/<h1>/g)||[]).length,1,'One primary heading');
  for(const m of html.matchAll(/(?:src|href)="(\/source\/[^"?#]+)"/g))assert(fs.existsSync(path.join(repo,m[1].slice(8))),`Missing asset ${m[1]}`);
  assert(!/serviceWorker|analytics|styles\.min\.css|home\.min\.css/.test(html));
 }
}
const browserPath=path.join(root,'final-browser-audit.json');
if(fs.existsSync(browserPath)){
 const checks=JSON.parse(fs.readFileSync(browserPath));
 for(const check of checks){const value=JSON.parse(check.result.match(/```json\s*([\s\S]*?)\s*```/)[1]);assert.equal(value.scrollY,0,'Viewport captures must start at scroll origin');assert.equal(value.width,value.scrollWidth,`${check.concept} ${check.page} ${check.viewport} overflow`);assert.deepEqual(value.brokenImages,[]);assert.deepEqual(value.overflow,[]);assert.equal(value.fonts,'loaded');}
 assert.equal(checks.length,27);
}
const result={passed:true,excludedExplorationFiles:files.length,productionHomepageStillAllowed:true,articleParagraphs:content.paragraphs.length,conceptPages:9,driverRows:22,constructorRows:11,browserViewports:fs.existsSync(browserPath)?27:0};
fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
