/* Nasher plate compositor. Original illustration files stay unchanged.
   SVG viewports reuse their digit artwork rather than approximating the font. */
(function(){let serial=0;const NS='http://www.w3.org/2000/svg';
function node(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n}
const boxes=[[473,330,91,169],[587,330,102,169],[698,330,105,169],[807,330,106,169],[925,330,113,169]];
function glyph(d,x,y,w,h,filter){const i='1234567890'.indexOf(d),box=d==='6'?[469,330,106,169]:boxes[i%5];const g=node('svg',{x,y,width:w,height:h,viewBox:box.join(' '),preserveAspectRatio:'none'});const im=node('image',{href:'assets/plates/variant1_ex'+(i<5?'1':'2')+'.png',width:1080,height:1080});if(filter)im.setAttribute('filter',filter);g.append(im);return g}
// Dubai uses the supplied reference artwork via SVG viewports; source PNGs are unchanged.
function dubai(target,code,number,variant){
 if(!/^([A-Z])\1?$/.test(code)||!/^[1-9][0-9]{0,4}$/.test(number)||Number(variant)!==1){target.replaceChildren();return;}
 const svg=node('svg',{viewBox:'0 0 720 166',role:'img','aria-label':'Dubai '+code+' / '+number,class:'generated-plate'});
 svg.append(node('title',{},'Dubai — '+code+' / '+number));
 const base=node('svg',{x:0,y:0,width:720,height:166,viewBox:'0 75 720 166'});base.append(node('image',{href:'assets/plates/dubai-1.png',width:720,height:258}));svg.append(base);
 svg.append(node('rect',{x:318,y:20,width:302,height:123,fill:'#d9dde6'}));
 const boxes=[[323,101,51,113],[380,101,52,113],[437,101,51,113],[492,101,53,113],[550,101,53,113]];
 const total=number.length*49+(number.length-1)*8,start=462-total/2;
 [...number].forEach((d,i)=>{const even='24680',odd='13579',k=even.includes(d)?even.indexOf(d):odd.indexOf(d),g=node('svg',{x:start+i*57,y:26,width:49,height:113,viewBox:boxes[k].join(' '),preserveAspectRatio:'none'});g.append(node('image',{href:'assets/plates/dubai-'+(even.includes(d)?1:2)+'.png',width:720,height:258}));svg.append(g)});
 svg.append(node('rect',{x:43,y:78,width:119,height:69,fill:'#d9dde6'}));
 drawDubaiCode(svg,code);
 target.replaceChildren(svg);
}
function drawDubaiCode(svg,code){
 // Reference letter artwork where supplied; remaining letters use a close font match.
 const letters={A:[7,75,152,57,68],C:[1,75,152,57,68],D:[5,54,152,50,70],G:[6,48,152,55,68],I:[2,89,152,26,68],M:[3,73,152,58,68],W:[4,66,152,71,68]};
 const ref=letters[code[0]];
 if(ref){const [file,x,y,width,height]=ref,displayWidth=Math.min(width,116/code.length),total=code.length*displayWidth;[...code].forEach((c,i)=>{const glyph=node('svg',{x:102-total/2+i*displayWidth,y:77,width:displayWidth,height,viewBox:[x,y,width,height].join(' '),preserveAspectRatio:'none'});glyph.append(node('image',{href:'assets/plates/dubai-'+file+'.png',width:720,height:file===5?262:258}));svg.append(glyph)});return;}

 // Layered SVG relief: recessed shadow, bright upper-left edge, metallic rim,
 // and black face. Keep edges sharp: no Gaussian blur over the letter faces.
 // Geometry remains a close font match for unprovided letters.
 const attrs={x:102,y:code[0]==='Q'?135:140,'text-anchor':'middle','font-family':'Arial, sans-serif','font-size':code[0]==='Q'?74:82,'font-weight':'700','textLength':code.length===1?45:90,'lengthAdjust':'spacingAndGlyphs','stroke-linejoin':'round','paint-order':'stroke fill'};
 const effectId='dubaiRelief'+(++serial),defs=node('defs');
 const face=node('linearGradient',{id:effectId+'Face',x1:'0%',y1:'0%',x2:'65%',y2:'100%'});
 for(const [offset,color]of[['0%','#292a2b'],['18%','#101112'],['45%','#020202'],['80%','#080808'],['100%','#18191a']])face.append(node('stop',{offset,'stop-color':color}));
 defs.append(face);svg.append(defs);
 const relief=node('g',{'aria-hidden':'true'});
 relief.append(node('text',{...attrs,transform:'translate(1.7 1.8)',fill:'#85878a',stroke:'#85878a','stroke-width':3.5},code));
 relief.append(node('text',{...attrs,transform:'translate(-1.15 -1.35)',fill:'#efefed',stroke:'#efefed','stroke-width':2.7},code));
 relief.append(node('text',{...attrs,fill:'#050505',stroke:'#96989c','stroke-width':2},code));
 relief.append(node('text',{...attrs,fill:'url(#'+effectId+'Face)'},code));
 svg.append(relief);
}
// Sharjah: original artwork, one layout, blank code area for the none sentinel.
function sharjah(target,code,number,variant){
 if(!['none','1','2','3','4','5','6','7','8','9'].includes(code)||!/^[1-9][0-9]{0,4}$/.test(number)||Number(variant)!==1){target.replaceChildren();return;}
 const label='Sharjah '+(code==='none'?'No code':code)+' / '+number,svg=node('svg',{viewBox:'0 0 720 164',role:'img','aria-label':label,class:'generated-plate'});
 svg.append(node('title',{},label));
 const base=node('svg',{x:0,y:0,width:720,height:164,viewBox:'0 195 720 164'});base.append(node('image',{href:'assets/plates/sharjah-1.png',width:720,height:720}));svg.append(base);
 svg.append(node('rect',{x:426,y:33,width:224,height:94,fill:'#d9dde6'}),node('rect',{x:99,y:49,width:39,height:70,fill:'#d9dde6'}));
 const boxes=[[435,231,33,89],[476,231,40,89],[519,231,39,89],[562,231,39,89],[606,231,39,89],[429,231,43,89],[474,231,40,89],[516,231,45,89],[558,231,42,89],[604,231,43,89]];
 function digit(d,x,y,width,height){const k='1234567890'.indexOf(d),g=node('svg',{x,y,width,height,viewBox:boxes[k].join(' '),preserveAspectRatio:'none'});g.append(node('image',{href:'assets/plates/sharjah-'+(k<5?1:2)+'.png',width:720,height:720}));return g;}
 const total=number.length*43,start=538-total/2;
 [...number].forEach((d,i)=>svg.append(digit(d,start+i*43+(43-boxes['1234567890'.indexOf(d)][2])/2,36,boxes['1234567890'.indexOf(d)][2],89)));
 if(code!=='none')svg.append(digit(code,101,51,34,66));
 target.replaceChildren(svg);
}
// Only the upper horizontal plate is sampled from each reference.
function fujairah(target, code, number, variant) {
 if (!/^[A-Z]$/.test(code) || !/^[1-9][0-9]{0,4}$/.test(number) || ![1,2].includes(Number(variant))) {
  target.replaceChildren(); return;
 }
 const svg = node('svg', {viewBox:'0 0 1080 250',role:'img','aria-label':'Fujairah '+code+' / '+number,class:'generated-plate'});
 function sample(file, source, x, y) {
  const [left,top,width,height] = source;
  const id = 'fujCrop'+(++serial);
  const clip = node('clipPath',{id});
  clip.append(node('rect',{x,y,width,height}));
  const defs = node('defs');
  defs.append(clip);
  svg.append(defs,node('image',{x:x-left,y:y-top,width:1080,height:250,
   href:'assets/plates/FUJ-'+file+'.png','clip-path':'url(#'+id+')'}));
 }
 sample(Number(variant)===1?'BLK-1':'RED-1',[0,0,1080,250],0,0);
 const fill='#d9dde6';
 svg.append(node('rect',{x:70,y:40,width:115,height:158,fill}),node('rect',{x:520,y:40,width:490,height:166,fill}));
 const letters={A:'RED-1',B:'RED-2',C:'RED-3',D:'BLK-1',E:'BLK-2',G:'BLK-3'};
 if (letters[code]) sample(letters[code],[92,60,72,123],92,60);
 else {
  const letter=node('g',{transform:'translate(127 122) scale(1.2 1.6) translate(-102 -109)'});
  const id='fujLetter'+(++serial), defs=node('defs'), clip=node('clipPath',{id});
  clip.append(node('rect',{x:64,y:75,width:76,height:74}));
  defs.append(clip);svg.append(defs);
  letter.setAttribute('clip-path','url(#'+id+')');
  drawDubaiCode(letter,code);
  svg.append(letter);
 }
 const slotWidth=77.5, start=753-number.length*slotWidth/2;
 Array.from(number).forEach((digit,index)=>{
  const position='1234567890'.indexOf(digit);
  const left=Math.round(559+(position%5)*slotWidth);
  sample(position<5?'RED-1':'RED-2',[left,47,77,154],Math.round(start+index*slotWidth),47);
 });
 target.replaceChildren(svg);
}
// Sprite regions retain the lettering, highlights and shadows of the long plates.
const longPlateStyles = {
 umm_al_quwain: {name:'Umm Al Quwain',asset:'uaq-long',letters:'ABCD',tileWidth:105,letterX:77,center:131,digitsX:510,variants:[1,2]},
 ras_al_khaimah: {name:'Ras Al Khaimah',asset:'rak-long',letters:'ABCDIKVXY',tileWidth:118,letterX:302,center:361,digitsX:470,variants:[1]}
};
function atlasPlate(target, code, number, variant, style) {
 if (!/^[A-Z]$/.test(code) || !/^[1-9][0-9]{0,4}$/.test(number) || !style.variants.includes(Number(variant))) {
  target.replaceChildren(); return;
 }
 const svg=node('svg',{viewBox:'0 0 1080 250',role:'img','aria-label':style.name+' '+code+' / '+number,class:'generated-plate'});
 const defs=node('defs'), atlasId='uaqAtlas'+(++serial);
 defs.append(node('image',{id:atlasId,href:'assets/plates/'+style.asset+'.png',width:1080,height:620}));
 svg.append(defs);
 function region(left,top,width,height,x,y) {
  const id='uaqCrop'+(++serial), clip=node('clipPath',{id});
  clip.append(node('rect',{x,y,width,height}));
  defs.append(clip);
  const group=node('g',{'clip-path':'url(#'+id+')'});
  group.append(node('use',{href:'#'+atlasId,x:x-left,y:y-top}));
  svg.append(group);
 }
 region(0,0,1080,250,0,0);
 if (Number(variant)===2) region(520,250,154,126,272,60);
 const index=style.letters.indexOf(code);
 if (index>=0) region(index*style.tileWidth,250,style.tileWidth,182,style.letterX,30);
 else {
  const letter=node('g',{transform:'translate('+style.center+' 122) scale(1.60 2.42) translate(-102 -109)'});
  const id='uaqLetter'+(++serial), clip=node('clipPath',{id});
  const refWidth={G:55,I:26,M:58,W:71}[code];
  clip.append(node('rect',refWidth ? {x:102-refWidth/2,y:77,width:refWidth,height:68} : {x:64,y:75,width:76,height:74}));
  defs.append(clip);
  letter.setAttribute('clip-path','url(#'+id+')');
  drawDubaiCode(letter,code);
  svg.append(letter);
 }
 const start=style.digitsX+(5-number.length)*85/2;
 Array.from(number).forEach((digit,i)=>region('1234567890'.indexOf(digit)*85,435,85,182,start+i*85,30));
 target.replaceChildren(svg);
}
window.NasherPlate={render(target,code,number,variant=1,emirate="abu_dhabi"){code=String(code);number=String(number);if(Object.hasOwn(longPlateStyles,emirate)){atlasPlate(target,code,number,variant,longPlateStyles[emirate]);return;}if(emirate==="fujairah"){fujairah(target,code,number,variant);return;}if(emirate==="sharjah"){sharjah(target,code,number,variant);return;}if(emirate==="dubai"){dubai(target,code,number,variant);return;}if(!/^[1-9][0-9]*$/.test(code)||code.length>10||!/^[1-9][0-9]{0,4}$/.test(number)||![1,2].includes(Number(variant))){target.replaceChildren();return}variant=Number(variant);const white='whiteCode'+(++serial),svg=node('svg',{viewBox:'0 0 1080 240',role:'img','aria-label':'Abu Dhabi '+code+' / '+number,class:'generated-plate'});svg.append(node('title',{},'Abu Dhabi — '+code+' / '+number));const defs=node('defs');const f=node('filter',{id:white,'color-interpolation-filters':'sRGB',x:'-2%',y:'-2%',width:'104%',height:'104%'});f.append(node('feColorMatrix',{type:'matrix',values:'0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1.1 -1.1 -1.1 0 2.8'}));defs.append(f);svg.append(defs);
const base=node('svg',{viewBox:'0 298 1080 240',x:0,y:0,width:1080,height:240});base.append(node('image',{href:`assets/plates/variant${variant}_ex1.png`,width:1080,height:1080}));svg.append(base);
svg.append(node('rect',{x:465,y:28,width:578,height:179,fill:'#d9dde6'}));
const digitW=96,gap=16,total=number.length*digitW+(number.length-1)*gap,start=465+(578-total)/2;
[...number].forEach((d,i)=>svg.append(glyph(d,start+i*(digitW+gap),34,digitW,164)));
const red=variant===2;svg.append(node('rect',{x:red?28:30,y:29,width:red?153:139,height:red?176:100,fill:red?'#ca1a1c':'#d9dde6'}));const singleRed=red&&code.length===1;const codeW=Math.min(red?(singleRed?65:55):50,(red?145:130)/code.length-5),codeH=red?(singleRed?133:115):80,cTotal=code.length*codeW+(code.length-1)*5,cStart=(red?104.5:99.5)-cTotal/2;
[...code].forEach((d,i)=>svg.append(glyph(d,cStart+i*(codeW+5),red?(singleRed?53:62):34,codeW,codeH,red?'url(#'+white+')':null)));
target.replaceChildren(svg);
}};
// Build privately, embed every reference, then show only the finished PNG.
// Source assets remain public web resources; this is presentation, not access control.
const compose=window.NasherPlate.render,requests=new WeakMap(),assets=new Map(),finished=new Map();let cacheBytes=0;
function remember(key,src){if(src.length>1600000)return;if(finished.has(key))cacheBytes-=finished.get(key).length;finished.delete(key);finished.set(key,src);cacheBytes+=src.length;while(cacheBytes>12000000||finished.size>40){const first=finished.keys().next().value;cacheBytes-=finished.get(first).length;finished.delete(first)}}
function embeddedAsset(href){
 if(!assets.has(href)){
  const pending=fetch(href).then(response=>{if(!response.ok)throw new Error('Plate asset unavailable');return response.blob()}).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Plate asset unreadable'));reader.readAsDataURL(blob)})).catch(error=>{assets.delete(href);throw error});
  assets.set(href,pending);
 }
 return assets.get(href);
}
function decodeImage(source){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Plate rendering failed'));img.src=source})}
window.NasherPlate.render=function(target,code,number,variant=1,emirate='abu_dhabi'){
 const key=JSON.stringify([emirate,String(code),String(number),Number(variant)]);const request={},scratch=document.createElement('div');requests.set(target,request);
 compose(scratch,code,number,variant,emirate);
 const svg=scratch.firstElementChild;target.replaceChildren();
 if(!svg){target.removeAttribute('aria-busy');return Promise.resolve()}
 const label=svg.getAttribute('aria-label');
 const width=['abu_dhabi','fujairah','umm_al_quwain','ras_al_khaimah'].includes(emirate)?1080:720,height=['umm_al_quwain','fujairah','ras_al_khaimah'].includes(emirate)?250:emirate==='sharjah'?164:emirate==='dubai'?166:240;
 if(finished.has(key)){const output=new Image();output.src=finished.get(key);output.className='generated-plate';output.alt=label;output.width=width*2;output.height=height*2;target.replaceChildren(output);target.removeAttribute('aria-busy');return Promise.resolve();}
 const placeholder=document.createElement('div');placeholder.style.aspectRatio=width+'/'+height;placeholder.setAttribute('aria-label',label);target.append(placeholder);target.setAttribute('aria-busy','true');
 return (async()=>{
  try{
   await Promise.all([...svg.querySelectorAll('image')].map(async image=>image.setAttribute('href',await embeddedAsset(image.getAttribute('href')))));
   if(requests.get(target)!==request)return;
   svg.setAttribute('width',width);svg.setAttribute('height',height);
   const serialized=new XMLSerializer().serializeToString(svg);
   const source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(serialized);
   const rendered=await decodeImage(source);
   if(requests.get(target)!==request)return;
   const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
   const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(rendered,0,0,canvas.width,canvas.height);
   const output=await decodeImage(canvas.toDataURL('image/png'));
   if(requests.get(target)!==request)return;
   output.className='generated-plate';output.alt=label;output.width=canvas.width;output.height=canvas.height;
   remember(key,output.src);target.replaceChildren(output);
  }catch(error){
   if(requests.get(target)!==request)return;
   const message=document.createElement('p');message.textContent=document.documentElement.lang==='ar'?'تعذر عرض رسم اللوحة. أعد تحميل الصفحة للمحاولة.':'Could not render the plate. Reload the page to retry.';message.setAttribute('role','status');target.replaceChildren(message);
  }finally{if(requests.get(target)===request)target.removeAttribute('aria-busy')}
 // Defer only listing artwork outside the initial viewport. Preview and detail stay immediate.
const immediate=window.NasherPlate.render,pending=new WeakMap(),observed=new Set();
const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);observed.delete(e.target);const args=pending.get(e.target);pending.delete(e.target);if(args)immediate(e.target,...args);}},{rootMargin:'180px'}):null;
window.NasherPlate.render=function(target,...args){if(observer&&target.classList.contains('card-art')){pending.set(target,args);target.style.aspectRatio='4.4';observer.observe(target);observed.add(target);queueMicrotask(()=>{for(const old of observed)if(!old.isConnected){observer.unobserve(old);observed.delete(old);pending.delete(old);}});return Promise.resolve();}return immediate(target,...args);};
})();
};
// Defer only listing artwork outside the initial viewport. Preview and detail stay immediate.
const immediate=window.NasherPlate.render,pending=new WeakMap(),observed=new Set();
const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);observed.delete(e.target);const args=pending.get(e.target);pending.delete(e.target);if(args)immediate(e.target,...args);}},{rootMargin:'180px'}):null;
window.NasherPlate.render=function(target,...args){if(observer&&target.classList.contains('card-art')){pending.set(target,args);target.style.aspectRatio='4.4';observer.observe(target);observed.add(target);queueMicrotask(()=>{for(const old of observed)if(!old.isConnected){observer.unobserve(old);observed.delete(old);pending.delete(old);}});return Promise.resolve();}return immediate(target,...args);};
})();
