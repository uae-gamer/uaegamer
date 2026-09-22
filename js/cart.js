window.Cart={
key:'storefront_cart_v1',get(){try{return JSON.parse(localStorage.getItem(this.key)||'{}')}catch{return{}}},save(c){localStorage.setItem(this.key,JSON.stringify(c));Store.renderNav()},
add(id){if(!Store.state.user){Store.go('login');Store.alert('Please log in before using the shopping cart.','err');return}const c=this.get(),p=Store.state.products.find(x=>x.id===id);c[id]=Math.min((c[id]||0)+1,p?.stock_quantity||1);this.save(c);Store.alert('Item added to cart.')},
count(){return Object.values(this.get()).reduce((a,b)=>a+Number(b),0)},
render(){
 if(!Store.state.user){Store.view(`<div class="card">You must be logged in to view and manage your shopping cart.</div>`);return}
 const c=this.get(),rows=Object.entries(c).map(([id,q])=>[Store.state.products.find(p=>p.id===id),q]).filter(x=>x[0]);
 if(!rows.length){Store.view('<div class="card">Your shopping cart is empty.</div>');return}
 let total=0;rows.forEach(([p,q])=>total+=Products.price(p)*q);
 Store.view(`<div class="table-wrap"><table><thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>${rows.map(([p,q])=>`<tr><td>${Store.esc(localize(p,'title'))}</td><td>${Products.price(p).toFixed(2)} USD</td><td><input class="qty" data-id="${p.id}" type="number" min="0" max="${p.stock_quantity}" value="${q}" style="width:80px"></td><td>${(Products.price(p)*q).toFixed(2)} USD</td><td><button class="btn danger remove" data-id="${p.id}">Remove</button></td></tr>`).join('')}<tr><th colspan="3">Current item subtotal</th><th colspan="2">${total.toFixed(2)} USD</th></tr></tbody></table></div><div class="card"><strong>Checkout:</strong> secure order submission is prepared in Supabase, but the final PayPal transaction-ID and delivery/VAT/gateway-fee workflow will be enabled after we finalize those rules.</div>`);
 document.querySelectorAll('.qty').forEach(x=>x.onchange=()=>{let c=this.get(),v=Math.max(0,Math.min(Number(x.value)||0,Number(x.max)));if(v)c[x.dataset.id]=v;else delete c[x.dataset.id];this.save(c);this.render()});document.querySelectorAll('.remove').forEach(x=>x.onclick=()=>{let c=this.get();delete c[x.dataset.id];this.save(c);this.render()});
}};