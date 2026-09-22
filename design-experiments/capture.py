"""Browser capture through the installed Chrome DevTools CLI.
Usage: python3 design-experiments/capture.py initial|final [page-id]
"""
import subprocess,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
phase=sys.argv[1] if len(sys.argv)>1 else 'final';pageid=sys.argv[2] if len(sys.argv)>2 else '1'
out=ROOT/'screenshots'/phase;out.mkdir(parents=True,exist_ok=True)
def cli(*args):
 r=subprocess.run(['chrome-devtools',*map(str,args)],capture_output=True,text=True,timeout=45)
 if r.returncode: raise RuntimeError(r.stderr+r.stdout)
 return r.stdout
checks=[]
for c in 'abc':
 for page,file in [('homepage','index.html'),('article','article.html'),('data-hub','data.html')]:
  cli('navigate_page',pageid,'--url',f'http://127.0.0.1:4186/concept-{c}/{file}','--timeout',12000)
  for label,w,h in [('desktop',1440,900),('mobile',390,844),('tablet',768,900)]:
   cli('emulate',pageid,'--viewport',f'{w}x{h}')
   audit=cli('evaluate_script','''async () => {await document.fonts.ready; for(const i of document.images){i.loading='eager'} await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);return {title:document.title,scrollY:window.scrollY,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fonts:document.fonts.status,brokenImages:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 || e.getBoundingClientRect().left < -1).filter(e=>getComputedStyle(e).position!=='fixed').slice(0,10).map(e=>e.tagName+'.'+e.className),h1:document.querySelector('h1')?.innerText}}''','--pageId',pageid)
   checks.append({'concept':c,'page':page,'viewport':label,'result':audit})
   if label!='tablet':
    base=f'{c}-{page}-{label}'
    cli('take_screenshot',pageid,'--filePath',str(out/(base+'-viewport.png')))
    cli('take_screenshot',pageid,'--fullPage','true','--filePath',str(out/(base+'.png')))
  print(f'{phase}: {c} {page}',flush=True)
(ROOT/f'{phase}-browser-audit.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
