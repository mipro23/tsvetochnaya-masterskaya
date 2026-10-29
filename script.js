const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const cart = new Map();
const grid = $('#productGrid');
const overlay = $('#overlay');
const drawer = $('#cartDrawer');
const toast = $('#toast');
let toastTimer;
$('#year').textContent = new Date().getFullYear();

// Telegram магазина указан в официальной карточке организации на Яндекс Картах
// (https://yandex.com/maps/org/tsvetochnaya_masterskaya/51469944668/).
// Перед публикацией убедитесь, что аккаунт принадлежит магазину.
const SHOP_TELEGRAM_USERNAME = 'tcvetochnaya_masterskaya';

function notify(message){
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove('show'),2200);
}
function productData(card){
  return {id:card.dataset.id,name:card.dataset.name,price:Number(card.dataset.price),image:$('img',card).src};
}
function addProduct(card){
  const p=productData(card);
  const current=cart.get(p.id);
  cart.set(p.id,{...p,qty:(current?.qty||0)+1});
  renderCart(); notify('Добавлено в корзину: '+p.name);
}
$$('.quick-add').forEach(btn=>btn.addEventListener('click',()=>addProduct(btn.closest('.product-card'))));

$$('.filter').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.filter').forEach(b=>b.classList.toggle('active',b===btn));
  const filter=btn.dataset.filter;
  $$('.product-card').forEach((card,i)=>{
    const visible=filter==='all'||card.dataset.category===filter;
    card.hidden=!visible;
    if(visible){card.style.animationDelay=(i*60)+'ms';}
  });
}));

function renderCart(){
  const items=[...cart.values()];
  const count=items.reduce((sum,p)=>sum+p.qty,0);
  const total=items.reduce((sum,p)=>sum+p.price*p.qty,0);
  $('#cartCount').textContent=count;
  $('#drawerCount').textContent='('+count+')';
  $('#cartTotal').textContent=total.toLocaleString('ru-RU')+' ₽';
  const container=$('#cartItems');
  if(!items.length){container.innerHTML='<div class="empty-cart">Пока здесь пусто.<br><span>Пусть первым будет любимый букет.</span></div>';return;}
  container.innerHTML=items.map(p=>`<div class="cart-row" data-cart-id="${p.id}"><img src="${p.image}" alt=""><div><h3>${p.name}</h3><p>${p.price.toLocaleString('ru-RU')} ₽</p><div class="qty-controls"><button type="button" data-action="minus" aria-label="Уменьшить количество">−</button><span>${p.qty}</span><button type="button" data-action="plus" aria-label="Увеличить количество">+</button></div></div><button type="button" class="remove" data-action="remove" aria-label="Удалить ${p.name}">×</button></div>`).join('');
}
$('#cartItems').addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const row=button.closest('[data-cart-id]'),p=cart.get(row.dataset.cartId);if(!p)return;
  if(button.dataset.action==='plus')p.qty++;
  if(button.dataset.action==='minus')p.qty--;
  if(button.dataset.action==='remove'||p.qty<=0)cart.delete(p.id);
  else cart.set(p.id,p);
  renderCart();
});
let lastFocusedElement=null;
function openCart(){
  lastFocusedElement=document.activeElement;
  overlay.classList.add('visible');drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');drawer.removeAttribute('inert');document.body.style.overflow='hidden';
  $('#closeCart').focus();
}
function closeCart(){
  const wasOpen=drawer.classList.contains('open');
  overlay.classList.remove('visible');drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');drawer.setAttribute('inert','');document.body.style.overflow='';
  if(wasOpen&&lastFocusedElement instanceof HTMLElement)lastFocusedElement.focus();
}
$('#openCart').addEventListener('click',openCart);
$('#closeCart').addEventListener('click',closeCart);
overlay.addEventListener('click',closeCart);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCart();closeMenu();if($('#order').open)$('#order').close();}});
$('#checkout').addEventListener('click',()=>{
  if(!cart.size){notify('Сначала добавьте букет в корзину');return;}
  closeCart();$('#order').showModal();$('#orderResult').hidden=true;$('#orderForm').hidden=false;
});
$('#closeOrder').addEventListener('click',()=>$('#order').close());
$('#order').addEventListener('click',e=>{if(e.target===$('#order'))$('#order').close();});
$('#orderForm').addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  const customer=String(data.get('customer')||'').trim();
  const phone=String(data.get('phone')||'').trim();
  if(!customer){notify('Укажите, как к вам обращаться');$('input[name="customer"]').focus();return;}
  const phoneDigits=phone.replace(/\D/g,'');
  if(!/^[0-9()+\s-]{10,20}$/.test(phone)||phoneDigits.length<10||phoneDigits.length>15){notify('Введите телефон в формате +7 999 123-45-67');$('input[name="phone"]').focus();return;}
  const items=[...cart.values()];
  const total=items.reduce((s,p)=>s+p.price*p.qty,0);
  const list=items.map(p=>`• ${p.name} — ${p.qty} шт. × ${p.price.toLocaleString('ru-RU')} ₽`).join('\n');
  const message=`Заявка — Цветочная мастерская\nИмя: ${customer}\nТелефон: ${phone}\n\nЗаказ:\n${list}\n\nИтого: ${total.toLocaleString('ru-RU')} ₽\nПожелания: ${String(data.get('notes')||'').trim()||'не указаны'}`;
  $('#orderText').value=message;
  const directUrl = `https://t.me/${SHOP_TELEGRAM_USERNAME}?text=${encodeURIComponent(message)}`;
  $('#sendTelegram').href = directUrl;
  $('#orderForm').hidden=true;$('#orderResult').hidden=false;
});
$('#sendTelegram').addEventListener('click',()=>{
  // Telegram requires the customer to press Send. A website cannot send a message silently.
  notify('Проверьте текст и отправьте сообщение в Telegram');
});
$('#copyOrder').addEventListener('click',async()=>{
  const text=$('#orderText').value;
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
    notify('Текст заявки скопирован');
  }catch{
    try{$('#orderText').select();document.execCommand('copy');notify('Текст заявки скопирован');}
    catch{notify('Не удалось скопировать. Выделите текст вручную.');}
  }
});
const primaryNav=$('.desktop-nav');
function setMenu(open){
  primaryNav.classList.toggle('mobile-open',open);
  $('#menuToggle').setAttribute('aria-expanded',open?'true':'false');
}
function closeMenu(){setMenu(false);}
$('#menuToggle').addEventListener('click',()=>setMenu(!primaryNav.classList.contains('mobile-open')));
$$('.desktop-nav a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('click',e=>{
  if(primaryNav.classList.contains('mobile-open')&&!primaryNav.contains(e.target)&&!$('#menuToggle').contains(e.target))closeMenu();
});
renderCart();
