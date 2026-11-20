'use strict';
window.NasherExperience = (() => {
 const get = id => document.getElementById(id);
 const browseFields = ['filter-status','filter-emirate','filter-code','filter-number','filter-digits','filter-min','filter-max','filter-sort'];
 const draftFields = ['ad-emirate','ad-code','ad-number','ad-variant','ad-price','ad-por','ad-negotiable','ad-whatsapp','seller-id'];
 const browseKey = 'nasher.browse.v1';
 let context, appliedBrowse = null, pendingScroll = null, draftKey = null;
 let draftMessage = '', draftActive = false, allowance = null, allowanceRequest = 0;
 let diagnostics = null, diagnosticTime = null, diagnosticError = false, diagnosticsBusy = false;
 const strings = {
  en: {
   draftSaved:'Draft saved on this browser.',draftRestored:'Your draft was restored. Review it before publishing.',
   draftUnavailable:'This browser could not save your draft.',draftInvalid:'Your draft was restored. Choose an available emirate, code and design.',
   discardDraft:'Discard draft',confirmDiscard:'Discard this saved draft and clear the form?',
   allowance:'Active ads',remaining:'Remaining',allowanceFailed:'Could not load your active-ad allowance.',
   diagnostics:'Site diagnostics',refreshDiagnostics:'Refresh diagnostics',diagnosticHint:'Counts cover all sellers. Request time measures this browser’s connection and database response.',
   total:'Total',active:'Active',expired:'Expired',sold:'Sold',removed:'Removed',emirate:'Emirate',
   profiles:'Seller profiles',published:'Published profiles',requestTime:'Request time (ms)',checked:'Last checked',
   diagnosticsFailed:'Diagnostics could not be loaded. Try Refresh diagnostics.',
   recentErrors:'Recent request failures on this browser',errorHint:'Up to 20 failures from listing, posting and admin pages on this browser. Messages, account details and contact numbers are excluded.',
   noErrors:'No request failures recorded on this browser.',clearErrors:'Clear this browser’s failure history',time:'Time',page:'Page',code:'Error code'
  },
  ar: {
   draftSaved:'تم حفظ المسودة في هذا المتصفح.',draftRestored:'تمت استعادة مسودتك. راجعها قبل النشر.',
   draftUnavailable:'تعذر حفظ المسودة في هذا المتصفح.',draftInvalid:'تمت استعادة المسودة. اختر إمارة ورمزاً وتصميماً متاحاً.',
   discardDraft:'حذف المسودة',confirmDiscard:'هل تريد حذف المسودة المحفوظة وتفريغ النموذج؟',
   allowance:'الإعلانات النشطة',remaining:'المتبقي',allowanceFailed:'تعذر تحميل الحد المتبقي للإعلانات.',
   diagnostics:'تشخيص الموقع',refreshDiagnostics:'تحديث التشخيص',diagnosticHint:'تشمل الأعداد جميع البائعين. يقيس زمن الطلب اتصال هذا المتصفح واستجابة قاعدة البيانات.',
   total:'الإجمالي',active:'نشط',expired:'منتهي',sold:'مباع',removed:'محذوف',emirate:'الإمارة',
   profiles:'ملفات البائعين',published:'الملفات المنشورة',requestTime:'زمن الطلب بالمللي ثانية',checked:'آخر تحديث',
   diagnosticsFailed:'تعذر تحميل التشخيص. حاول تحديثه.',
   recentErrors:'أخطاء الطلبات الأخيرة في هذا المتصفح',errorHint:'آخر 20 خطأ من صفحات التصفح والنشر والإدارة في هذا المتصفح. لا تُحفظ الرسائل أو بيانات الحساب أو أرقام الاتصال.',
   noErrors:'لا توجد أخطاء طلبات مسجلة في هذا المتصفح.',clearErrors:'مسح سجل أخطاء هذا المتصفح',time:'الوقت',page:'الصفحة',code:'رمز الخطأ'
  }
 };
 const label = key => strings[context.language()][key] || key;
 function read(storage,key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
 }
 function values(ids) {
  return Object.fromEntries(ids.filter(id=>get(id)).map(id=>[id,get(id).type==='checkbox'?get(id).checked:get(id).value]));
 }
 function setValue(id,value) {
  const field=get(id);
  if(!field)return false;
  if(field.type==='checkbox') {field.checked=value===true;return true;}
  if(typeof value!=='string')return false;
  if(field.tagName==='SELECT' && ![...field.options].some(o=>o.value===value)){field.value='';return false;}
  field.value=value.slice(0,200);
  return true;
 }
 function init(api) {
  context=api;
  if(get('browse-page')) {
   history.scrollRestoration='manual';
   addEventListener('pagehide',saveBrowse);
  }
 }
 function restoreBrowse() {
  if(!get('browse-page'))return 0;
  const saved=read(sessionStorage,browseKey);
  if(!saved || saved.version!==1 || !saved.fields)return 0;
  setValue('filter-emirate',saved.fields['filter-emirate']);
  context.setupCodes();
  for(const id of browseFields.filter(id=>id!=='filter-emirate')){if(id in saved.fields)setValue(id,saved.fields[id]);}
  pendingScroll=Number.isFinite(saved.scroll)?Math.max(0,saved.scroll):0;
  return Number.isInteger(saved.page)?Math.max(0,Math.min(saved.page,100000)):0;
 }
 function saveBrowse() {
  if(!appliedBrowse)return;
  try {sessionStorage.setItem(browseKey,JSON.stringify({...appliedBrowse,scroll:scrollY}));} catch {}
 }
 function listLoaded(page) {
  if(!get('browse-page'))return;
  appliedBrowse={version:1,page,fields:values(browseFields)};
  if(pendingScroll!==null) {
   const position=pendingScroll;pendingScroll=null;
   requestAnimationFrame(()=>requestAnimationFrame(()=>{scrollTo(0,position);saveBrowse();}));
  } else saveBrowse();
 }
 function newSearch() {pendingScroll=0;}
 function saveDraft() {
  if(!draftActive || !context.user())return;
  try {
   localStorage.setItem(draftKey,JSON.stringify({version:1,fields:values(draftFields)}));
   draftMessage='draftSaved';
  } catch {draftMessage='draftUnavailable';}
  renderDraft();
 }
 function renderDraft() {
  if(get('draft-status'))get('draft-status').textContent=draftMessage?label(draftMessage):'';
  if(get('discard-draft'))get('discard-draft').textContent=label('discardDraft');
 }
 function removeDraft() {
  draftActive=false;
  try {if(draftKey)localStorage.removeItem(draftKey);} catch {}
  draftMessage='';renderDraft();
 }
 function initDraft() {
  if(!get('ad-form') || context.editing() || !context.user())return;
  draftKey='nasher.draft.v1.'+context.user().id;
  draftActive=true;
  const saved=read(localStorage,draftKey);
  if(saved?.version===1 && saved.fields) {
   let valid=setValue('ad-emirate',saved.fields['ad-emirate']);
   context.postEmirate();
   for(const id of draftFields.slice(1))valid=setValue(id,saved.fields[id])&&valid;
   if(!context.isAdmin())get('seller-id').value='';
   context.priceMode();context.preview();
   draftMessage=valid?'draftRestored':'draftInvalid';
  }
  get('draft-panel').hidden=false;
  get('ad-form').addEventListener('input',saveDraft);
  get('ad-form').addEventListener('change',saveDraft);
  get('discard-draft').onclick=()=>{
   if(!confirm(label('confirmDiscard')))return;
   removeDraft();get('ad-form').reset();get('ad-call').checked=true;
   context.postEmirate();context.priceMode();draftActive=true;loadAllowance();
  };
  get('seller-id').addEventListener('change',loadAllowance);
  renderDraft();
 }
 function stop() {
  draftActive=false;allowanceRequest++;diagnostics=null;
  get('diagnostic-content')?.replaceChildren();
 }
 async function loadAllowance() {
  if(!get('post-allowance')||!context.user())return;
  const request=++allowanceRequest;
  const seller=context.isAdmin()?get('seller-id').value.trim():'';
  if(seller&&!/^[0-9a-f-]{36}$/i.test(seller)){allowance=null;renderAllowance();return;}
  try {
   const result=await context.client().from('nasher_ads').select('id',{head:true,count:'exact'})
    .eq('seller_id',seller||context.user().id).eq('status','active').gt('expires_at',new Date().toISOString());
   if(result.error)throw result.error;
   if(request!==allowanceRequest)return;
   allowance={active:result.count||0,max:context.settings().max_active_ads};
  } catch {
   if(request!==allowanceRequest)return;
   allowance=false;
  }
  renderAllowance();
 }
 function renderAllowance() {
  const target=get('post-allowance');if(!target)return;
  target.textContent=allowance===false?label('allowanceFailed'):allowance?
   label('allowance')+' '+allowance.active+' / '+allowance.max+' · '+label('remaining')+' '+Math.max(0,allowance.max-allowance.active):'';
 }
 function recordError(error) {
  // Store only bounded codes and known filenames, never raw error messages or URLs.
  const page=location.pathname.split('/').pop()||'index.html';
  if(!['index.html','post.html','ad.html','my-ads.html','admin.html','bulk.html'].includes(page))return;
  const code=String(error?.message||'').match(/NASHER_[A-Z_]+/)?.[0] ||
   (/^[A-Z0-9]{2,12}$/.test(String(error?.code||''))?String(error.code):'REQUEST_FAILED');
  try {
   const previous=read(localStorage,'nasher.errors.v1');
   const rows=Array.isArray(previous)?previous:[];
   rows.push({at:new Date().toISOString(),page,code:code.slice(0,60)});
   localStorage.setItem('nasher.errors.v1',JSON.stringify(rows.slice(-20)));
  } catch {}
 }
 function element(tag,value) {const n=document.createElement(tag);n.textContent=String(value);return n;}
 function renderDiagnostics() {
  if(!get('diagnostic-content'))return;
  document.querySelectorAll('[data-experience]').forEach(n=>n.textContent=label(n.dataset.experience));
  const target=get('diagnostic-content');target.replaceChildren();
  if(diagnosticError)target.append(element('p',label('diagnosticsFailed')));
  if(diagnostics) {
   target.append(element('p',label('profiles')+' '+diagnostics.profiles+' · '+label('published')+' '+diagnostics.published_profiles),
    element('p',label('checked')+' '+new Date(diagnostics.checked_at).toLocaleString(context.language()==='ar'?'ar-AE':'en-GB')+' · '+label('requestTime')+' '+diagnosticTime));
   const table=document.createElement('table'),head=document.createElement('tr');
   for(const key of ['emirate','total','active','expired','sold','removed'])head.append(element('th',label(key)));
   const thead=document.createElement('thead');thead.append(head);table.append(thead);
   const body=document.createElement('tbody');
   for(const row of diagnostics.by_emirate) {
    const tr=document.createElement('tr');tr.append(element('td',context.emirateName(row.emirate)));
    for(const key of ['total','active','expired','sold','removed'])tr.append(element('td',row[key]));
    body.append(tr);
   }
   table.append(body);target.append(table);
  }
  const errors=get('diagnostic-errors');errors.replaceChildren();
  const stored=read(localStorage,'nasher.errors.v1'),rows=Array.isArray(stored)?stored:[];
  if(!rows.length)errors.append(element('p',label('noErrors')));
  for(const row of rows.slice(-20).reverse())errors.append(element('p',row.at+' · '+row.page+' · '+row.code+' · REF '+row.at.replace(/[^0-9]/g,'').slice(0,17)));
 }
 async function loadDiagnostics() {
  if(!context.isAdmin()||diagnosticsBusy)return;
  diagnosticsBusy=true;get('refresh-diagnostics').disabled=true;
  const started=performance.now();
  try {
   const result=await context.client().rpc('nasher_admin_diagnostics');
   if(result.error)throw result.error;
   if(!context.isAdmin())return;
   diagnostics=result.data;diagnosticTime=Math.round(performance.now()-started);diagnosticError=false;
  } catch(error) {recordError(error);diagnosticError=true;}
  finally {diagnosticsBusy=false;get('refresh-diagnostics').disabled=false;if(context.isAdmin())renderDiagnostics();}
 }
 function initDiagnostics() {
  get('refresh-diagnostics').onclick=loadDiagnostics;
  get('clear-diagnostic-errors').onclick=()=>{
   try {localStorage.removeItem('nasher.errors.v1');}catch{}
   renderDiagnostics();
  };
  renderDiagnostics();return loadDiagnostics();
 }
 function translate() {renderDraft();renderAllowance();if(context.isAdmin())renderDiagnostics();}
 return {init,restoreBrowse,listLoaded,newSearch,initDraft,saveDraft,removeDraft,loadAllowance,stop,
  recordError,initDiagnostics,loadDiagnostics,translate};
})();
