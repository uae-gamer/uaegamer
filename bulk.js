'use strict';
window.NasherBulk=(()=>{
 let api,rows=[],busy=false,requestId=null,requestPayload=null,draftKey,stopped=false;
 const $=id=>document.getElementById(id);
 const words={
  en:{title:'Post multiple plates',single:'Post one plate',hint:'Each plate uses one ad slot. Review the previews, then publish the whole batch. Your saved call number is required.',
   add:'Add plate',publish:'Publish all plates',remove:'Remove row',emirate:'Emirate',code:'Code',number:'Plate number',variant:'Design',price:'Price (AED)',por:'Price on request',negotiable:'Negotiable',whatsapp:'Use my WhatsApp number',allowance:'Remaining ad slots',row:'Row',
   confirm:'Publish all these plates now?',success:'Published ads',profile:'Publish your seller profile and save a call number before posting.',
   failed:'Could not confirm publication. Keep these rows and retry to check the same submission.',invalid:'Review the highlighted fields.',duplicate:'A plate is repeated in this batch.',limit:'This batch exceeds your remaining ad allowance.',
   unavailable:'Choose an enabled code',black:'Black logo',red:'Red logo',blue:'Light blue logo',logo:'Abu Dhabi logo',redPanel:'Red panel',standard:'Standard',none:'No code',
   allOrNothing:'Every row must be valid. If one row fails, the whole batch is rolled back.',storage:'This browser could not save the batch for later. Keep this page open until publication is confirmed.'},
  ar:{title:'نشر عدة لوحات',single:'نشر لوحة واحدة',hint:'تستهلك كل لوحة خانة إعلان. راجع المعاينات ثم انشر المجموعة كاملة. رقم المكالمات المحفوظ إلزامي.',
   add:'إضافة لوحة',publish:'نشر جميع اللوحات',remove:'إزالة الصف',emirate:'الإمارة',code:'الرمز',number:'رقم اللوحة',variant:'التصميم',price:'السعر بالدرهم',por:'السعر عند الطلب',negotiable:'قابل للتفاوض',whatsapp:'استخدام رقم واتساب المحفوظ',allowance:'خانات الإعلانات المتبقية',row:'الصف',
   confirm:'هل تريد نشر جميع هذه اللوحات الآن؟',success:'الإعلانات المنشورة',profile:'انشر ملف البائع واحفظ رقم مكالمات قبل النشر.',
   failed:'تعذر تأكيد النشر. احتفظ بهذه الصفوف وأعد المحاولة للتحقق من الطلب نفسه.',invalid:'راجع الحقول المحددة.',duplicate:'هناك لوحة مكررة في هذه المجموعة.',limit:'تتجاوز المجموعة الحد المتبقي للإعلانات.',
   unavailable:'اختر رمزاً مفعّلاً',black:'شعار أسود',red:'شعار أحمر',blue:'شعار أزرق فاتح',logo:'شعار أبوظبي',redPanel:'الشريط الأحمر',standard:'قياسي',none:'بدون رمز',
   allOrNothing:'يجب أن تكون جميع الصفوف صحيحة. إذا فشل صف تُلغى المجموعة كاملة.',storage:'تعذر حفظ المجموعة في هذا المتصفح. أبقِ الصفحة مفتوحة حتى تأكيد النشر.'}
 };
 let remaining=0,whatsapp=false;
 const t=k=>words[api?.language()||'ar'][k]||k;
 const make=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
 function message(text){$('bulk-message').textContent=text;}
 function blank(){const code=api.codes.find(c=>c.enabled);return {emirate:code?.emirate||'',code:code?.code||'',number:'',variant:1,price:'',por:false,negotiable:false,whatsapp};}
 function save(){
  try{localStorage.setItem(draftKey,JSON.stringify({rows,requestId,requestPayload}));return true;}
  catch{message(t('storage'));return false;}
 }
 function loadDraft(){
  try {
   const v=JSON.parse(localStorage.getItem(draftKey)||'null');
   if(v&&Array.isArray(v.rows)&&v.rows.length){rows=v.rows;requestId=v.requestId;requestPayload=v.requestPayload;}
  }catch{}
 }
 function variants(emirate){
  if(emirate==='abu_dhabi')return [[1,t('logo')],[2,t('redPanel')]];
  if(emirate==='fujairah')return [[1,t('black')],[2,t('red')]];
  if(emirate==='umm_al_quwain')return [[1,t('black')],[2,t('blue')]];
  return [[1,t('standard')]];
 }
 function select(label,options,value,change){
  const wrap=make('label'),s=make('select');wrap.append(make('span',label),s);
  s.required=true;
  for(const [key,name] of options)s.add(new Option(name,key));
  s.value=String(value);
  if(s.selectedIndex<0){s.add(new Option(t('unavailable'),''),0);s.value='';}
  s.onchange=()=>change(s.value);
  return wrap;
 }
 function input(label,type,value,change){
  const wrap=make('label'),field=make('input');field.type=type;
  if(type==='checkbox'){field.checked=value;wrap.className='choice';wrap.append(field,make('span',label));field.onchange=()=>change(field.checked);}
  else{field.value=value??'';wrap.append(make('span',label),field);field.oninput=()=>change(field.value);}
  return {wrap,field};
 }
 function changed(){requestId=null;requestPayload=null;save();}
 function render(){
  if(!api||stopped)return;
  $('bulk-title').textContent=t('title');$('bulk-hint').textContent=t('hint');
  $('bulk-atomic').textContent=t('allOrNothing');$('bulk-add').textContent=t('add');
  $('bulk-submit').textContent=t('publish');$('bulk-single').textContent=t('single');
  $('bulk-allowance').textContent=t('allowance')+' '+remaining;
  $('bulk-rows').replaceChildren();
  rows.forEach((row,index)=>{
   const section=make('details','', 'bulk-row'),legend=make('summary',t('row')+' '+(index+1)+' · '+api.emirateName(row.emirate)+' '+row.code+' / '+(row.number||'—'));section.open=true;
   const grid=make('div','', 'bulk-grid'),preview=make('div','', 'bulk-preview');
   const refreshPreview=()=>{legend.textContent=t('row')+' '+(index+1)+' · '+api.emirateName(row.emirate)+' '+row.code+' / '+(row.number||'—');NasherPlate.render(preview,row.code,row.number||'12345',row.variant,row.emirate);};
   const emirates=[...new Set(api.codes.filter(c=>c.enabled).map(c=>c.emirate))];
   grid.append(select(t('emirate'),emirates.map(e=>[e,api.emirateName(e)]),row.emirate,value=>{
    row.emirate=value;row.code=api.codes.find(c=>c.emirate===value&&c.enabled)?.code||'';row.variant=1;changed();render();
   }),select(t('code'),api.codes.filter(c=>c.emirate===row.emirate&&c.enabled).map(c=>[c.code,c.code==='none'?t('none'):c.code]),row.code,value=>{row.code=value;changed();refreshPreview();}));
   const number=input(t('number'),'text',row.number,value=>{row.number=value;changed();refreshPreview();});
   number.field.required=true;number.field.pattern='[1-9][0-9]{0,4}';number.field.maxLength=5;number.field.inputMode='numeric';number.field.dir='ltr';
   grid.append(number.wrap,select(t('variant'),variants(row.emirate),row.variant,value=>{row.variant=Number(value);changed();refreshPreview();}));
   const price=input(t('price'),'number',row.price,value=>{row.price=value;changed();});
   price.field.min='0.01';price.field.max='9999999999.99';price.field.step='0.01';price.field.required=!row.por;price.field.disabled=!!row.por;
   grid.append(price.wrap,input(t('por'),'checkbox',row.por,value=>{row.por=value;if(value)row.negotiable=false;changed();render();}).wrap);
   const neg=input(t('negotiable'),'checkbox',row.negotiable,value=>{row.negotiable=value;changed();});neg.field.disabled=!!row.por;
   const wa=input(t('whatsapp'),'checkbox',row.whatsapp,value=>{row.whatsapp=value;changed();});wa.field.disabled=!whatsapp;
   if(!whatsapp)row.whatsapp=false;
   grid.append(neg.wrap,wa.wrap);
   const remove=make('button',t('remove'));remove.type='button';remove.onclick=()=>{rows.splice(index,1);changed();render();};
   const similar=make('button',api.language()==='ar'?'إضافة لوحة مشابهة':'Add similar plate');similar.type='button';similar.disabled=rows.length>=remaining;similar.onclick=()=>{if(rows.length>=remaining)return;rows.push({...row,number:''});changed();render();};section.append(legend,grid,preview,remove,similar);$('bulk-rows').append(section);refreshPreview();
  });
  $('bulk-add').disabled=busy||rows.length>=remaining;
  $('bulk-submit').disabled=busy||!rows.length;
 }
 function payload(){return rows.map(r=>({...r,variant:Number(r.variant),price:r.por?null:Number(r.price),por:!!r.por,negotiable:!r.por&&!!r.negotiable,whatsapp:whatsapp&&!!r.whatsapp}));}
 async function submit(event){
  event.preventDefault();if(busy||stopped)return;
  $('bulk-rows').querySelectorAll('details').forEach(d=>{if(d.querySelector(':invalid'))d.open=true;});if(!$('bulk-form').reportValidity()){message(t('invalid'));return;}
  const data=requestId&&requestPayload?JSON.parse(requestPayload):payload(),serialized=JSON.stringify(data);
  const identities=new Set(data.map(r=>[r.emirate,r.code,r.number].join('|')));
  if(identities.size!==data.length){message(t('duplicate'));return;}
  // A retry retains its token even if the first request already consumed the allowance.
  if(!requestId&&rows.length>remaining){message(t('limit'));return;}
  if(!confirm(t('confirm')))return;
  if(!requestId||requestPayload!==serialized){requestId=crypto.randomUUID();requestPayload=serialized;}
  save();busy=true;$('bulk-controls').disabled=true;message('');
  try{
   const result=await api.db.rpc('nasher_bulk_post',{p_rows:data,p_request:requestId});
   if(result.error)throw result.error;
   if(stopped)return;
   const count=result.data.length;
   rows=[];requestId=null;requestPayload=null;
   try{localStorage.removeItem(draftKey);}catch{}
   const totals=await api.db.from('nasher_ads').select('id',{head:true,count:'exact'}).eq('seller_id',api.user.id).eq('status','active').gt('expires_at',new Date().toISOString());
   remaining=totals.error?Math.max(0,remaining-count):Math.max(0,api.settings.max_active_ads-(totals.count||0));
   message(t('success')+' '+count);
   const link=make('a',api.language()==='ar'?' إعلاناتي':' My ads');link.href='my-ads.html';$('bulk-message').append(link);
  }catch(error){
   if(stopped)return;
   NasherExperience.recordError(error);
   if(error.message?.includes('NASHER_BATCH_ROW')){
    const row=String(error.details||'').match(/^\d+/)?.[0]||'';
    const code=String(error.details||'').match(/NASHER_[A-Z_]+/)?.[0]||'NASHER_BATCH';
    message(t('row')+' '+row+' · '+t('allOrNothing'));api.fail({message:code});
   }else if(error.message?.includes('NASHER_'))api.fail(error);
   else message(t('failed'));
  }finally{busy=false;$('bulk-controls').disabled=false;render();}
 }
 async function init(context){
  api=context;stopped=false;draftKey='nasher.bulk.v1.'+api.user.id;
  const [profile,contact,ads]=await Promise.all([
   api.db.from('nasher_profiles').select('published').eq('id',api.user.id).single(),
   api.db.from('nasher_seller_contacts').select('call_number,whatsapp_number').eq('user_id',api.user.id).single(),
   api.db.from('nasher_ads').select('id',{head:true,count:'exact'}).eq('seller_id',api.user.id).eq('status','active').gt('expires_at',new Date().toISOString())
  ]);
  if(stopped)return;
  if(profile.error||contact.error||ads.error)throw profile.error||contact.error||ads.error;
  $('bulk-page').hidden=false;
  if(!profile.data.published||!contact.data.call_number){message(t('profile'));$('bulk-controls').disabled=true;return;}
  remaining=Math.max(0,api.settings.max_active_ads-(ads.count||0));whatsapp=!!contact.data.whatsapp_number;
  loadDraft();if(!rows.length&&remaining)rows=[blank()];
  $('bulk-form').onsubmit=submit;
  $('bulk-add').onclick=()=>{if(rows.length<remaining){rows.push(blank());changed();render();}};
  render();
 }
 return {init,translate:render,stop(){stopped=true;}};
})();
