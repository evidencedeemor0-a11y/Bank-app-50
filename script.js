const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const KEY="vault_state_v2";
let state=JSON.parse(localStorage.getItem(KEY)||"null")||{
 balance:0, hidden:false, frozen:false, light:false, accentTheme:"purple",
 transactions:[], requests:[], revealed:false, linkedCards:[],
 spending:{food:0,shopping:0,bills:0,other:0}, notifications:false
};
if(!Array.isArray(state.linkedCards))state.linkedCards=[];
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const ACCENT_THEMES={
 purple:{accent:"#8b7cf6",accent2:"#b5aaff",rgb:"139,124,246",dark:"#5e55a5"},
 red:{accent:"#ef4444",accent2:"#ff9b9b",rgb:"239,68,68",dark:"#a82525"},
 green:{accent:"#22c55e",accent2:"#8fefb3",rgb:"34,197,94",dark:"#158249"},
 blue:{accent:"#3b82f6",accent2:"#93c0ff",rgb:"59,130,246",dark:"#1d4ed8"},
 brown:{accent:"#a5713f",accent2:"#d6ac7f",rgb:"165,113,63",dark:"#6b4726"},
 grey:{accent:"#8a8a94",accent2:"#c2c1ca",rgb:"138,138,148",dark:"#57565f"}
};
function applyAccent(name){
 const t=ACCENT_THEMES[name]||ACCENT_THEMES.purple;
 const r=document.documentElement.style;
 r.setProperty("--accent",t.accent);
 r.setProperty("--accent2",t.accent2);
 r.setProperty("--accent-rgb",t.rgb);
 r.setProperty("--accent-dark",t.dark);
}
function syncAccentSwatches(){
 $$("#accentSwatches [data-accent]").forEach(b=>b.classList.toggle("active",b.dataset.accent===(state.accentTheme||"purple")));
}
const money=n=>"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function toast(t){let e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200)}
function notifSupported(){return "Notification" in window}
function notify(title,body){
 if(!state.notifications) return;
 if(!notifSupported()) return;
 if(Notification.permission!=="granted") return;
 try{ new Notification(title,{body,tag:"vault-"+Date.now()}) }catch(e){}
}
function syncNotifBtn(){
 const b=$("#notifToggleBtn");
 if(!b) return;
 if(!notifSupported()){ b.textContent="Notifications not supported"; b.disabled=true; return }
 if(state.notifications && Notification.permission==="granted"){ b.textContent="Notifications on ✓"; }
 else if(Notification.permission==="denied"){ b.textContent="Notifications blocked — check browser settings"; }
 else{ b.textContent="Enable transaction notifications"; }
}
function genTxId(){return Array.from({length:20},()=>Math.floor(Math.random()*10)).join("")}
function addTx(type,title,amount,meta="Just now",category="other",status="completed"){
 state.transactions.unshift({id:Date.now()+Math.random(),txId:genTxId(),type,title,amount,meta,category,status});
 save(); render();
}
function addPendingTx(type,title,amount,meta,category){
 const id=Date.now()+Math.random();
 state.transactions.unshift({id,txId:genTxId(),type,title,amount,meta,category,status:"pending"});
 save(); render();
 return id;
}
function completeTx(id,newMeta="Just now"){
 const tx=state.transactions.find(t=>t.id===id);
 if(tx){tx.status="completed";tx.meta=newMeta;}
 save(); render();
}
function render(){
 document.body.classList.toggle("light",state.light);
 $("#balance").textContent=state.hidden?"••••••":money(state.balance);
 $("#toggleBalance").textContent=state.hidden?"◎":"◉";
 $("#cvv").textContent=state.revealed?"381":"•••";
 $("#cardNumber").textContent=state.revealed?"4827  1904  6631  4821":"••••  ••••  ••••  4821";
 $("#spendingTotal").textContent=money(state.spending.food+state.spending.shopping+state.spending.bills+state.spending.other);
 $("#foodSpend").textContent=money(state.spending.food);
 $("#shopSpend").textContent=money(state.spending.shopping);
 $("#billSpend").textContent=money(state.spending.bills);
 $("#otherSpend").textContent=money(state.spending.other);
 renderChart(); renderTx(); renderRequests(); renderLinkedCards();
 if(currentTxId!==null && !$("#txDetailMain").classList.contains("hidden")){
  const tx=state.transactions.find(t=>t.id===currentTxId);
  if(tx && (tx.status!==txDetailLastStatus || currentTxId!==txDetailLastId)) renderTxDetail();
 }
}
function cardBrand(num){
 if(/^4/.test(num))return"Visa";
 if(/^5[1-5]/.test(num))return"Mastercard";
 if(/^3[47]/.test(num))return"Amex";
 if(/^6(?:011|5)/.test(num))return"Discover";
 return"Card";
}
function linkedCardRow(c,i){
 return `<div class="linked-card"><div class="tx-icon">✓</div><div class="tx-info"><b>${esc(c.brand)} •••• ${esc(c.last4)}</b><small>${esc(c.name)} · Exp ${esc(c.expiry)}</small></div><button class="small-btn" onclick="removeLinkedCard(${i})">Remove</button></div>`;
}
function renderLinkedCards(){
 const html=state.linkedCards.length?state.linkedCards.map(linkedCardRow).join(""):`<div class="empty">No cards added yet.</div>`;
 if($("#linkedCards"))$("#linkedCards").innerHTML=html;
 if($("#linkedCardsChecklist"))$("#linkedCardsChecklist").innerHTML=html;
}
function removeLinkedCard(i){state.linkedCards.splice(i,1);save();render();toast("Card removed")}
function renderChart(){
 const vals=Object.values(state.spending), max=Math.max(...vals,10);
 $("#chart").innerHTML=vals.map(v=>`<div class="bar" style="height:${Math.max(5,v/max*100)}%"></div>`).join("");
}
let currentFilter="all";
let currentTxId=null;
let txDetailLastId=null, txDetailLastStatus=null;
function renderTx(){
 const q=$("#searchTx").value.toLowerCase();
 let arr=state.transactions.filter(t=>(currentFilter==="all"||t.type===currentFilter)&&(`${t.title} ${t.meta}`).toLowerCase().includes(q));
 $("#transactions").innerHTML=arr.length?arr.map(t=>{
 const pending=t.status==="pending";
 const icon=pending?"❗️":(t.type==="sent"?"↗":t.type==="received"?"↓":"＋");
 return `<div class="tx ${pending?"pending":""}" data-id="${t.id}"><div class="tx-icon ${pending?"pulse":""}">${icon}</div><div class="tx-info"><b>${esc(t.title)}</b><small>${pending?"Pending":`${esc(t.meta)} · ${esc(t.category)}`}</small></div><div class="tx-amount ${pending?"pending-amt":(t.amount>=0?"plus":"minus")}">${t.amount>=0?"+":"−"}${money(Math.abs(t.amount))}</div></div>`;
 }).join(""):`<div class="empty">No transactions yet.</div>`;
}
function renderRequests(){
 const s=$("#requestsSection"), box=$("#requests");
 s.classList.toggle("hidden",!state.requests.length);
 box.innerHTML=state.requests.map((r,i)=>`<div class="tx"><div class="tx-icon">?</div><div class="tx-info"><b>${esc(r.name)}</b><small>Requested ${money(r.amount)}</small></div><button class="small-btn" onclick="cancelRequest(${i})">Cancel</button></div>`).join("");
}
function esc(x){return String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function openModal(html,opts={}){$("#modalContent").innerHTML=html;$(".modal-sheet").classList.toggle("raised",!!opts.raised);$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
$("#closeModal").onclick=closeModal;
$(".modal-backdrop").onclick=closeModal;

const COUNTRIES=["United Kingdom","Ireland","Canada","Australia","New Zealand","Germany","France","Spain","Italy","Netherlands","Belgium","Switzerland","Sweden","Norway","Denmark","Poland","Portugal","Austria","Nigeria","Ghana","South Africa","Kenya","Egypt","Morocco","India","China","Japan","South Korea","Singapore","Hong Kong","United Arab Emirates","Saudi Arabia","Qatar","Israel","Turkey","Brazil","Mexico","Argentina","Chile","Colombia","Philippines","Indonesia","Malaysia","Thailand","Vietnam","Pakistan","Bangladesh"];

function intlForm(){
 return `<h2>International transfer</h2><p>Send money abroad to any bank account.</p>
 <div class="field"><label>Country</label><select id="country">${COUNTRIES.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div>
 <div class="field"><label>Recipient name</label><input id="who" placeholder="e.g. Alex Morgan"></div>
 <div class="field"><label>Account number / IBAN</label><input id="acctNum" placeholder="e.g. GB29 NWBK 6016 1331 9268 19"></div>
 <div class="field"><label>Amount (USD)</label><input id="amt" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00"></div>
 <button class="primary" id="submitMoney">Send transfer</button>`;
}
function addFromCardForm(){
 return `<h2>Add from card</h2><p>Choose a linked card and amount to add to your balance.</p>
 <div class="field"><label>Card</label><select id="who">${state.linkedCards.map((c,i)=>`<option value="${i}">${esc(c.brand)} •••• ${esc(c.last4)}</option>`).join("")}</select></div>
 <div class="field"><label>Amount (USD)</label><input id="amt" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00"></div>
 <div class="quick">${[10,50,100,500].map(x=>`<button type="button" onclick="$('#amt').value=${x}">$${x}</button>`).join("")}</div>
 <button class="primary" id="submitMoney">Add to balance</button>`;
}
function amountForm(kind){
 const labels={send:["Send money","Recipient","Send"],receive:["Receive money","From","Add received money"],request:["Request money","Person","Create request"]};
 const [title,who,button]=labels[kind];
 return `<h2>${title}</h2><p>${kind==="send"?"Enter the recipient and amount to continue.":""}</p>
 <div class="field"><label>${who}</label><input id="who" placeholder="e.g. Alex"></div>
 <div class="field"><label>Amount (USD)</label><input id="amt" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00"></div>
 <button class="primary" id="submitMoney">${button}</button>`;
}
function transactionAuth(kind){
  const labels={send:"Send money",receive:"Receive money",request:"Request money",add:"Add from card",intl:"International transfer"};
  openModal(`<div class="success" style="font-size:24px">⌁</div><h2 style="text-align:center">Enter passcode</h2><p style="text-align:center">Enter your 4-digit passcode to continue with ${labels[kind]}.</p>
  <div class="field"><label>Passcode</label><input id="transactionPin" inputmode="numeric" maxlength="4" type="password" placeholder="••••" autocomplete="off"></div>
  <button class="primary" id="verifyTransaction">Continue</button>`);
  $("#verifyTransaction").onclick=()=>{
    if($("#transactionPin").value==="1472"){
      amountFormAndSubmit(kind);
    }else{
      toast("Incorrect passcode");
      $("#transactionPin").value="";
    }
  };
}

/* ---- Pending badge (animated) shown the same way the success badge is ---- */
const PENDING_BADGE_SVG=`<svg class="pending-badge" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
 <circle class="pending-ring-bg" cx="50" cy="50" r="42" fill="none" stroke="#f5a52f" stroke-width="8"/>
 <circle class="pending-ring" cx="50" cy="50" r="42" fill="none" stroke="#f5a52f" stroke-width="8" stroke-linecap="round"/>
 <circle class="pending-dot" cx="50" cy="50" r="6" fill="#f5a52f"/>
</svg>`;
function pending(title,text,note="",badge=PENDING_BADGE_SVG){
 openModal(`<div class="success">${badge}</div><h2 style="text-align:center">${title}</h2><p style="text-align:center">${text}</p>${note?`<p style="text-align:center;color:var(--text);font-size:13px;line-height:1.5;background:rgba(var(--accent-rgb),.1);border-radius:12px;padding:10px 14px;margin:12px 0 18px">${note}</p>`:""}<button class="primary" onclick="closeModal()">Got it</button>`,{raised:true});
 save(); render();
}

const CARD_PENDING_SVG=`<svg class="card-pending-badge" viewBox="0 0 160 118" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id="cardPendingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
   <stop offset="0%" stop-color="var(--accent2)"/>
   <stop offset="100%" stop-color="var(--accent-dark)"/>
  </linearGradient>
  <clipPath id="cardPendingClip"><rect x="12" y="16" width="136" height="82" rx="14"/></clipPath>
 </defs>
 <g class="card-pending-body">
  <rect x="12" y="16" width="136" height="82" rx="14" fill="url(#cardPendingGrad)"/>
  <rect x="26" y="34" width="27" height="19" rx="4" fill="#ffffff99"/>
  <rect x="26" y="69" width="58" height="7" rx="3.5" fill="#ffffff66"/>
  <rect x="26" y="81" width="38" height="6" rx="3" fill="#ffffff40"/>
  <g clip-path="url(#cardPendingClip)">
   <rect class="card-pending-shine" x="-40" y="0" width="34" height="118" fill="#ffffff55" transform="skewX(-18)"/>
  </g>
 </g>
 <g transform="translate(130,90)">
  <circle r="17" fill="var(--panel)"/>
  <circle class="card-pending-ring-bg" r="13" fill="none" stroke="#f5a52f" stroke-width="4" opacity=".35"/>
  <circle class="card-pending-ring" r="13" fill="none" stroke="#f5a52f" stroke-width="4" stroke-linecap="round" stroke-dasharray="61 82"/>
  <circle class="card-pending-dot" r="2.6" fill="#f5a52f"/>
 </g>
</svg>`;

function amountFormAndSubmit(kind){
  openModal(kind==="intl"?intlForm():kind==="add"?addFromCardForm():amountForm(kind));
  $("#submitMoney").onclick=()=>{
    const amt=Number($("#amt").value||0);
    let who=kind==="add"?"":($("#who").value.trim()||"Vault user");
    if(kind==="add"){
      const card=state.linkedCards[Number($("#who").value)];
      if(!card){toast("Select a card");return}
      who=`${card.brand} •••• ${card.last4}`;
    }
    if(!(amt>0)){toast("Enter a valid amount");return}
    if(kind==="intl"){
      const country=$("#country").value;
      const acct=$("#acctNum").value.trim();
      if(!acct){toast("Enter an account number");return}
      if(amt>state.balance){toast("Insufficient balance");return}
      const acctTail=acct.replace(/\s+/g,"").slice(-4);
      const id=addPendingTx("sent",`Sent to ${who} (${country})`,-amt,`Intl · Acct •••${acctTail}`,"other");
      pending("Sending transfer…",`Sending ${money(amt)} to ${esc(who)} in ${esc(country)}.`,"International transactions are processed within 24hrs to 2 business days.");
      setTimeout(()=>{
        state.balance-=amt;
        state.spending.other+=amt;
        completeTx(id,`Intl · ${country} · Acct •••${acctTail}`);
        success("Transfer sent",`You sent ${money(amt)} to ${esc(who)} in ${esc(country)}`);
      },10000);
      return;
    }
    if(kind==="add"){
      const id=addPendingTx("added","Money added",amt,`From ${who}`,"other");
      pending("Adding money…",`Adding ${money(amt)} from your ${esc(who)}.`);
      setTimeout(()=>{
        state.balance+=amt;
        completeTx(id);
        success("Money added",`Your balance is now ${money(state.balance)}`);
      },10000);
    }
    if(kind==="send"){
      if(amt>state.balance){toast("Insufficient balance");return}
      const id=addPendingTx("sent",`Sent to ${who}`,-amt,"Just now","other");
      pending("Sending money…",`Sending ${money(amt)} to ${esc(who)}. This usually takes a few moments.`);
      setTimeout(()=>{
        state.balance-=amt;
        state.spending.other+=amt;
        completeTx(id);
        success("Sent successfully",`You sent ${money(amt)} to ${esc(who)}`);
      },10000);
    }
    if(kind==="receive"){
      const id=addPendingTx("received",`Received from ${who}`,amt,"Just now","other");
      pending("Receiving money…",`Receiving ${money(amt)} from ${esc(who)}. This usually takes a few moments.`);
      setTimeout(()=>{
        state.balance+=amt;
        completeTx(id);
        success("Payment received",`Your balance increased by ${money(amt)}`);
      },10000);
    }
    if(kind==="request"){state.requests.unshift({name:who,amount:amt});save();render();success("Request created",`You requested ${money(amt)} from ${esc(who)}`)}
  }
}
function showAction(kind){transactionAuth(kind)}

const CHECK_BADGE_SVG=`<svg class="check-badge" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
 <path class="badge-shape" d="M50 3 L57 12 L67 8 L70 19 L81 19 L80 30 L90 35 L85 45 L92 54 L82 60 L84 71 L73 71 L69 82 L59 78 L50 87 L41 78 L31 82 L27 71 L16 71 L18 60 L8 54 L15 45 L10 35 L20 30 L19 19 L30 19 L33 8 L43 12 Z" fill="url(#badgeGrad)"/>
 <path class="badge-check" d="M33 51 L45 63 L69 37" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
 <defs>
  <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
   <stop offset="0%" stop-color="#8CE6A8"/>
   <stop offset="100%" stop-color="#4FAE72"/>
  </linearGradient>
 </defs>
</svg>`;
function success(title,text){openModal(`<div class="success">${CHECK_BADGE_SVG}</div><h2 style="text-align:center">${title}</h2><p style="text-align:center">${text}</p><button class="primary" onclick="closeModal()">Done</button>`,{raised:true});save();render();notify(title,text)}

const CARD_ADDED_SVG=`<svg class="card-added-badge" viewBox="0 0 160 118" xmlns="http://www.w3.org/2000/svg">
 <defs>
  <linearGradient id="cardAddedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
   <stop offset="0%" stop-color="var(--accent2)"/>
   <stop offset="100%" stop-color="var(--accent-dark)"/>
  </linearGradient>
  <clipPath id="cardAddedClip"><rect x="12" y="16" width="136" height="82" rx="14"/></clipPath>
 </defs>
 <g class="card-added-body">
  <rect x="12" y="16" width="136" height="82" rx="14" fill="url(#cardAddedGrad)"/>
  <rect x="26" y="34" width="27" height="19" rx="4" fill="#ffffff99"/>
  <rect x="26" y="69" width="58" height="7" rx="3.5" fill="#ffffff66"/>
  <rect x="26" y="81" width="38" height="6" rx="3" fill="#ffffff40"/>
  <g clip-path="url(#cardAddedClip)">
   <rect class="card-added-shine" x="-40" y="0" width="34" height="118" fill="#ffffff55" transform="skewX(-18)"/>
  </g>
 </g>
 <g transform="translate(130,90)">
  <g class="card-added-check">
   <circle r="17" fill="#4FAE72" stroke="var(--panel)" stroke-width="4"/>
   <path d="M-7 0 L-2 5.5 L8 -6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="card-added-check-path"/>
  </g>
 </g>
</svg>`;

$("#addMoneyBtn").onclick=()=>{
 if(!state.linkedCards.length){toast("Link a card first");showAddCardPage();return}
 showAction("add");
};
$("#intlTransferBtn").onclick=()=>showAction("intl");
$$("[data-action]").forEach(b=>b.onclick=()=>showAction(b.dataset.action));
$("#toggleBalance").onclick=()=>{state.hidden=!state.hidden;save();render()};
$("#addCardBtn").onclick=showAddCardPage;
$("#showCard").onclick=()=>{state.revealed=!state.revealed;save();render()};
$("#searchTx").oninput=renderTx;
$$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;renderTx()});
$("#clearHistory").onclick=()=>{if(confirm("Clear transaction history?")){state.transactions=[];save();render()}};
function cancelRequest(i){state.requests.splice(i,1);save();render();toast("Request cancelled")}

function showProfilePage(){
 $("#homeMain").classList.add("hidden");
 $("#profileMain").classList.remove("hidden");
 $("#themeToggleBtn").textContent=`Switch to ${state.light?"dark":"light"} mode`;
 syncAccentSwatches();
 syncNotifBtn();
 window.scrollTo({top:0});
 $$(".nav").forEach(x=>x.classList.remove("active"));
 $('[data-nav="profile"]').classList.add("active");
}
function showHomePage(){
 $("#profileMain").classList.add("hidden");
 $("#addCardMain").classList.add("hidden");
 $("#txDetailMain").classList.add("hidden");
 $("#homeMain").classList.remove("hidden");
 currentTxId=null;
 txDetailLastId=null; txDetailLastStatus=null;
 window.scrollTo({top:0});
 $$(".nav").forEach(x=>x.classList.remove("active"));
 $('[data-nav="home"]').classList.add("active");
}
function showAddCardPage(){
 $("#homeMain").classList.add("hidden");
 $("#addCardMain").classList.remove("hidden");
 $("#addCardForm").reset();
 $("#previewNumber").textContent="•••• •••• •••• ••••";
 $("#previewExpiry").textContent="MM/YY";
 $("#previewCvv").textContent="•••";
 $("#previewName").textContent="CARDHOLDER";
 window.scrollTo({top:0});
}
$("#profileBtn").onclick=showProfilePage;
$("#backHome").onclick=showHomePage;
$("#backFromCard").onclick=showHomePage;
$("#backFromTxDetail").onclick=showHomePage;

$("#transactions").addEventListener("click",e=>{
 const row=e.target.closest(".tx");
 if(!row)return;
 showTxDetailPage(Number(row.dataset.id));
});

function showTxDetailPage(id){
 currentTxId=id;
 txDetailLastId=null; txDetailLastStatus=null;
 $("#homeMain").classList.add("hidden");
 $("#profileMain").classList.add("hidden");
 $("#addCardMain").classList.add("hidden");
 $("#txDetailMain").classList.remove("hidden");
 renderTxDetail();
 window.scrollTo({top:0});
}
function renderTxDetail(){
 const tx=state.transactions.find(t=>t.id===currentTxId);
 if(!tx){showHomePage();return}
 if(!tx.txId){tx.txId=genTxId();save()}
 const pending=tx.status==="pending";
 const labels={sent:"Sent",received:"Received",added:"Added"};
 const statusText=pending?"Pending":(labels[tx.type]||"Completed");
 const dot=pending?"🟡":"🟢";
 $("#txDetailContent").innerHTML=`
  <div class="success" style="margin:16px 0 6px">${pending?PENDING_BADGE_SVG:CHECK_BADGE_SVG}</div>
  <h2 style="text-align:center;margin:0 0 4px">${esc(tx.title)}</h2>
  <div style="text-align:center;font-size:30px;font-weight:750;margin:6px 0 2px" class="${tx.amount>=0?'plus':'minus'}">${tx.amount>=0?"+":"−"}${money(Math.abs(tx.amount))}</div>
  <p style="text-align:center;font-size:14px;margin:0 0 22px;color:var(--text)">Status: ${esc(statusText)} ${dot}</p>
  <div class="field"><label>Transaction ID</label><input value="${tx.txId}" readonly></div>
  <div class="field"><label>Category</label><input value="${esc(tx.category||'other')}" readonly></div>
  <div class="field"><label>Date</label><input value="${esc(pending?'Processing…':tx.meta)}" readonly></div>
 `;
 txDetailLastId=currentTxId; txDetailLastStatus=tx.status;
}

$("#cardNum").oninput=e=>{
 let v=e.target.value.replace(/\D/g,"").slice(0,16);
 e.target.value=v.replace(/(.{4})/g,"$1 ").trim();
 $("#previewNumber").textContent=v?e.target.value.padEnd(19,"•").replace(/(.{4})(?=.)/g,"$1 ").trim():"•••• •••• •••• ••••";
};
$("#cardExpiry").oninput=e=>{
 let v=e.target.value.replace(/\D/g,"").slice(0,4);
 if(v.length>=3)v=v.slice(0,2)+"/"+v.slice(2);
 e.target.value=v;
 $("#previewExpiry").textContent=v||"MM/YY";
};
$("#cardCvv").oninput=e=>{
 e.target.value=e.target.value.replace(/\D/g,"").slice(0,4);
 $("#previewCvv").textContent="•".repeat(e.target.value.length)||"•••";
};
$("#cardName").oninput=e=>{
 $("#previewName").textContent=e.target.value.trim()?e.target.value.toUpperCase():"CARDHOLDER";
};
$("#addCardForm").onsubmit=e=>{
 e.preventDefault();
 const digits=$("#cardNum").value.replace(/\D/g,"");
 const name=$("#cardName").value.trim();
 const expiry=$("#cardExpiry").value.trim();
 const cvv=$("#cardCvv").value.trim();
 const zip=$("#cardZip").value.trim();
 if(digits.length<13){toast("Enter a valid card number");return}
 if(!name){toast("Enter the cardholder name");return}
 if(!/^\d{2}\/\d{2}$/.test(expiry)){toast("Enter a valid expiry date");return}
 if(cvv.length<3){toast("Enter a valid CVV");return}
 if(!zip){toast("Enter a billing ZIP / postal code");return}
 const brand=cardBrand(digits), last4=digits.slice(-4);
 pending("Adding card…",`Adding your ${brand} card ending in ${last4}.`,"",CARD_PENDING_SVG);
 setTimeout(()=>{
  state.linkedCards.unshift({brand,last4,name,expiry});
  save(); render();
  cardAdded();
 },10000);
};
function cardAdded(){
 openModal(`<div class="success">${CARD_ADDED_SVG}</div><h2 style="text-align:center;margin-top:16px">Card added successfully</h2><button class="primary" id="cardAddedDone">Done</button>`,{raised:true});
 save(); render();
 notify("Card added successfully","Your card was linked to Vault.");
 $("#cardAddedDone").onclick=()=>{closeModal();showHomePage()};
}
$("#saveProfileBtn").onclick=()=>toast("Profile saved");
$("#themeToggleBtn").onclick=()=>{state.light=!state.light;save();render();$("#themeToggleBtn").textContent=`Switch to ${state.light?"dark":"light"} mode`;toast("Theme updated")};
$("#notifToggleBtn").onclick=()=>{
 if(!notifSupported()){toast("Not supported on this browser");return}
 if(Notification.permission==="denied"){toast("Blocked — enable notifications for this site in browser settings");return}
 if(Notification.permission==="granted"){
  state.notifications=!state.notifications;
  save(); syncNotifBtn();
  toast(state.notifications?"Notifications enabled":"Notifications disabled");
  return;
 }
 Notification.requestPermission().then(perm=>{
  state.notifications=(perm==="granted");
  save(); syncNotifBtn();
  toast(perm==="granted"?"Notifications enabled":"Permission denied");
 });
};
$("#clearHistoryProfileBtn").onclick=()=>{if(confirm("Clear transaction history? This can't be undone.")){state.transactions=[];save();render();toast("Transaction history cleared")}};
$$("#accentSwatches [data-accent]").forEach(b=>b.onclick=()=>{
 state.accentTheme=b.dataset.accent;
 save();
 applyAccent(state.accentTheme);
 syncAccentSwatches();
 toast("Accent color updated");
});
$("#notificationsBtn").onclick=()=>openModal(`<h2>Notifications</h2><p>${state.transactions.length?"Your latest wallet activity appears here.":"You're all caught up."}</p>${state.transactions.slice(0,5).map(t=>`<div class="tx"><div class="tx-icon">•</div><div class="tx-info"><b>${esc(t.title)}</b><small>${esc(t.meta)}</small></div></div>`).join("")}`);
$$("[data-nav]").forEach(n=>n.onclick=()=>{let target=n.dataset.nav;if(target==="profile"){showProfilePage();return}if(target==="home"){showHomePage();return}$$(".nav").forEach(x=>x.classList.remove("active"));n.classList.add("active");if(target==="card")document.querySelector(".virtual-card").scrollIntoView({behavior:"smooth"});if(target==="activity")document.querySelector(".transactions").scrollIntoView({behavior:"smooth"})});

applyAccent(state.accentTheme||"purple");
render();
