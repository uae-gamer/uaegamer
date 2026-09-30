window.IncludedCategories = {
 async load(id){const r=await db.rpc('included_category_counts',{p_product_id:id});if(r.error)throw r.error;return r.data||[];},
 apply(query,category){return category==='*'?query:query.eq('category',category);},
 html(rows,selected,lang,esc){
  if(rows.length<2)return '';
  const total=rows.reduce((n,r)=>n+Number(r.count||0),0);
  return `<div class="included-category-tabs" role="group" aria-label="${lang==='ar'?'فئات المحتوى':'Content categories'}">`+
   [{category:'*',label:lang==='ar'?'الكل':'All',count:total},...rows.map(r=>({...r,label:r.category?(lang==='ar'?(r.category_ar||r.category):r.category):(lang==='ar'?'غير مصنف':'Uncategorized')}))]
   .map(r=>`<button type="button" class="btn included-category-tab ${selected===r.category?'primary':''}" aria-pressed="${selected===r.category}" data-category="${esc(r.category)}">${esc(r.label)} (${Number(r.count)})</button>`).join('')+'</div>';
 }
};
