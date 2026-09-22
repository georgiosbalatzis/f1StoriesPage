import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'screenshots/final');
for(const page of ['homepage','article','data-hub'])for(const viewport of ['desktop','mobile']){
 const width=viewport==='mobile'?390:720;
 const imgs=await Promise.all(['a','b','c'].map(c=>sharp(path.join(dir,`${c}-${page}-${viewport}-viewport.png`)).resize({width}).png().toBuffer()));
 const height=(await sharp(imgs[0]).metadata()).height;
 await sharp({create:{width:width*3+32,height:height+36,channels:3,background:'#e1e2de'}}).composite(imgs.map((b,i)=>({input:b,top:36,left:i*(width+16)}))).png().toFile(path.join(dir,`comparison-${page}-${viewport}.png`));
}
console.log('Six side-by-side comparisons written (A, B, C from left to right).');
