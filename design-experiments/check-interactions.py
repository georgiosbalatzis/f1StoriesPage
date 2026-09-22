"""Real keyboard/pointer browser checks using Chrome DevTools CLI. Local-only."""
import subprocess,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PAGE='1'
def cli(*args):
 r=subprocess.run(['chrome-devtools',*map(str,args)],capture_output=True,text=True,timeout=45)
 if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 return r.stdout
def ev(js):
 s=cli('evaluate_script',js,'--pageId',PAGE,'--waitForStableDom','false')
 m=re.search(r'```json\s*(.*?)\s*```',s,re.S)
 if not m:raise RuntimeError(s)
 return json.loads(m[1])
def focus(sel):ev('() => {document.querySelector('+json.dumps(sel)+').focus();return true}')
def visit(path):cli('navigate_page',PAGE,'--url','http://127.0.0.1:4186'+path,'--timeout',12000)
results=[]
for c in 'abc':
 visit(f'/concept-{c}/index.html');cli('emulate',PAGE,'--viewport','390x844')
 snap=cli('take_snapshot',PAGE);uid=re.search(r'uid=(\S+) button "Μενού',snap)[1];cli('click',PAGE,uid)
 assert ev('() => document.querySelector(".menu-toggle").getAttribute("aria-expanded")')=='true'
 cli('press_key',PAGE,'Tab');assert ev('() => Boolean(document.activeElement.closest("#main-nav"))')
 cli('press_key',PAGE,'Escape');assert ev('() => document.activeElement.matches(".menu-toggle") && document.querySelector(".menu-toggle").getAttribute("aria-expanded")==="false"')
 cli('press_key',PAGE,'Enter');assert ev('() => document.querySelector(".menu-toggle").getAttribute("aria-expanded")')=='true'
 cli('take_screenshot',PAGE,'--filePath',str(ROOT/'screenshots/final'/f'{c}-menu-mobile.png'));cli('press_key',PAGE,'Escape')
 focus('[data-video]');cli('press_key',PAGE,'Enter')
 player=ev('() => {const f=document.querySelector(".player iframe");return {src:f.src,title:f.title,width:f.getBoundingClientRect().width,height:f.getBoundingClientRect().height}}')
 assert 'youtube-nocookie.com/embed/l0vNNK6FO3g?autoplay=0' in player['src'] and player['width']>=350 and player['height']>=190
 visit(f'/concept-{c}/article.html');assert ev('() => document.querySelector(".reading-index").open')==False
 focus('.reading-index summary');cli('press_key',PAGE,'Enter');assert ev('() => document.querySelector(".reading-index").open')==True
 visit(f'/concept-{c}/data.html');focus('[data-report="constructors"]');cli('press_key',PAGE,'Enter')
 report=ev('() => ({driversHidden:document.querySelector("#report-drivers").hidden,constructorsHidden:document.querySelector("#report-constructors").hidden,rows:document.querySelectorAll("#report-constructors tbody tr").length,selected:document.querySelector("[data-report=constructors]").getAttribute("aria-pressed"),width:innerWidth,scroll:document.documentElement.scrollWidth})')
 assert report['driversHidden'] and not report['constructorsHidden'] and report['rows']==11 and report['selected']=='true' and report['width']==report['scroll']
 cli('take_screenshot',PAGE,'--filePath',str(ROOT/'screenshots/final'/f'{c}-constructors-mobile.png'))
 focus('[data-report="drivers"]');cli('press_key',PAGE,'Enter');assert ev('() => !document.querySelector("#report-drivers").hidden')
 results.append({'concept':c,'menuPointerAndKeyboard':True,'escapeFocusRestored':True,'navInTabOrder':True,'articleDisclosure':True,'player':player,'constructorReport':report,'returnToDrivers':True})
 print(c,'interactions passed',flush=True)
visit('/');cli('emulate',PAGE,'--viewport','1440x900');focus('[data-page="article"]');cli('press_key',PAGE,'Enter');focus('[data-viewport="mobile"]');cli('press_key',PAGE,'Enter')
review=ev('async () => {await Promise.all([...document.images].map(i=>i.decode()));return {images:[...document.querySelectorAll(".screenshot-link img")].map(i=>i.src),openLinks:[...document.querySelectorAll(".open-live")].map(a=>a.pathname),status:document.querySelector("#selection-status").textContent,width:innerWidth,scroll:document.documentElement.scrollWidth}}')
assert all('-article-mobile-viewport.png' in s for s in review['images']) and all('article.html' in s for s in review['openLinks'])
cli('take_screenshot',PAGE,'--fullPage','true','--filePath',str(ROOT/'screenshots/final/review-mobile-comparison.png'))
cli('emulate',PAGE,'--viewport','390x844');assert ev('() => innerWidth === document.documentElement.scrollWidth')
visit('/preview.html?concept=c&page=article&width=390')
frame=ev('() => ({width:document.querySelector("iframe").contentWindow.innerWidth,pathname:document.querySelector("iframe").contentWindow.location.pathname})');assert frame['width']==390 and 'concept-c/article.html' in frame['pathname']
results.append({'reviewControls':review,'reviewAt390NoOverflow':True,'workingFrame':frame})
(ROOT/'interaction-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
visit('/');cli('emulate',PAGE,'--viewport','1440x900');ev('async () => {await Promise.all([...document.images].map(i=>i.decode()));return true}')
cli('take_screenshot',PAGE,'--fullPage','true','--filePath',str(ROOT/'screenshots/final/DESIGN_REVIEW.png'))
print('Review controls and working frame passed',flush=True)
