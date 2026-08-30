const SKEY="cw_demo_state_v2";
const ADMIN_USER="admin", ADMIN_PASS="admin-demo-only";
const modes={30:"Win Go 30s",60:"Win Go 1Min",180:"Win Go 3Min",300:"Win Go 5Min"};
const initial=()=>({user:null,users:{},giftClaims:{},giftCodes:{GIFT50:50},transactions:[],rounds:{},otp:null});
let state=JSON.parse(localStorage.getItem(SKEY)||"null")||initial();
function save(){localStorage.setItem(SKEY,JSON.stringify(state))}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function toast(t){const d=document.createElement("div");d.className="toast";d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
function app(){if(location.pathname==="/admin-login")return adminLogin();if(location.pathname==="/admin")return admin();if(!state.user)return auth();dashboard()}
function auth(){
document.getElementById("app").innerHTML=`<div class="shell"><div class="top"><div class="brand">ColorWin</div><div class="sub">Entertainment prediction simulator • virtual points only</div></div><div class="card">
<div class="tabs"><button id="phoneTab" class="tab active">Log in with phone</button><button id="emailTab" class="tab">Email login</button></div>
<div id="authBox"></div></div></div>`;
let mode="phone",register=false;
const render=()=>{document.getElementById("authBox").innerHTML=register?`
<label>Phone number</label><input id="regPhone" class="input" placeholder="+91 phone number">
<label>Set password</label><input id="regPass" class="input" type="password" placeholder="Password">
<label>Confirm password</label><input id="regPass2" class="input" type="password" placeholder="Password again">
<label>SMS verification code</label><div class="row"><input id="otp" class="input" placeholder="6-digit demo OTP"><button id="sendOtp" class="btn ghost">Send</button></div>
<label>Invite code (optional)</label><input id="invite" class="input" placeholder="Optional">
<p class="small">Demo account only — no real SMS is sent.</p>
<button id="register" class="btn primary">Register</button>
<p class="small">Already registered? <button id="backLogin" class="link">Log in</button></p>`:
`${mode==="phone"?`<label>Phone number</label><input id="loginId" class="input" placeholder="+91 phone number">`:`<label>Email</label><input id="loginId" class="input" type="email" placeholder="email@example.com">`}
<label>Password</label><div class="row"><input id="loginPass" class="input" type="password" placeholder="Password"><button id="show" class="btn outline" style="max-width:82px">Show</button></div>
<div class="row" style="align-items:center;margin:10px 0"><span class="small">☐ Remember password</span><button class="link" id="forgot">Forgot password</button></div>
<button id="login" class="btn primary">Log in</button><button id="goReg" class="btn outline" style="margin-top:8px">Register</button>
<p class="small">Demo OTP is <b>123456</b>. No SMS is sent.</p>`;
render();
phoneTab.onclick=()=>{mode="phone";phoneTab.classList.add("active");emailTab.classList.remove("active");render()};
emailTab.onclick=()=>{mode="email";emailTab.classList.add("active");phoneTab.classList.remove("active");render()};
authBox.onclick=e=>{
if(e.target.id==="show"){const i=document.getElementById("loginPass");i.type=i.type==="password"?"text":"password";e.target.textContent=i.type==="password"?"Show":"Hide"}
if(e.target.id==="goReg"){register=true;render()}
if(e.target.id==="backLogin"){register=false;render()}
if(e.target.id==="sendOtp"){state.otp={code:"123456",at:Date.now()};save();toast("Demo OTP: 123456")}
if(e.target.id==="login"){const id=document.getElementById("loginId").value.trim().toLowerCase(),p=document.getElementById("loginPass").value;
if(!id||!p)return toast("Enter login details");
if(!state.users[id])return toast("Account not found");
if(state.users[id].password!==p)return toast("Incorrect password");
state.user=id;save();app()}
if(e.target.id==="forgot")toast("Demo only: use your saved password")
if(e.target.id==="register"){const id=document.getElementById("regPhone").value.trim().toLowerCase(),p=document.getElementById("regPass").value,p2=document.getElementById("regPass2").value,otp=document.getElementById("otp").value.trim();
if(!id||!p||p!==p2)return toast("Check registration fields");
if(otp!=="123456")return toast("Use demo OTP 123456");
if(state.users[id])return toast("Account already exists");
state.users[id]={id,password:p,balance:1000,history:[],email:id.includes("@")?id:null};
state.user=id;save();toast("Account created");setTimeout(app,400)}
}};
function user(){return state.users[state.user]}
function ensureRounds(){for(const k of Object.keys(modes))if(!state.rounds[k])state.rounds[k]={ends:Date.now()+Number(k)*1000,period:1,history:[]}}
function dashboard(){ensureRounds();save();const u=user();document.getElementById("app").innerHTML=`<div class="shell"><div class="top"><div class="brand">ColorWin</div><div class="sub">${esc(u.id)}</div></div><div class="card">
<div class="balance"><div>Virtual Wallet</div><div class="amount">₹${u.balance.toFixed(2)}</div><div class="row"><button id="deposit" class="btn outline">Deposit</button><button id="withdraw" class="btn primary">Withdraw</button></div></div>
</div><div class="card"><div class="modebar">${Object.entries(modes).map(([k,v])=>`<button class="mode ${k===(window.mode||60)?"active":""}" data-mode="${k}">${v}</button>`).join("")}</div><div id="game"></div></div>
<div class="nav"><button data-page="game" class="active">🎮 Game</button><button data-page="gift">🎁 Gift</button><button data-page="wallet">💳 Wallet</button><button data-page="profile">👤 Profile</button></div></div>`;
if(!window.mode)window.mode=60;renderGame();setInterval(()=>{if(state.user)renderTimer()},500);
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{window.mode=Number(b.dataset.mode);document.querySelectorAll(".mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderGame()});
document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>page(b.dataset.page));
document.getElementById("deposit").onclick=()=>page("deposit");document.getElementById("withdraw").onclick=()=>page("withdraw")}
function renderGame(){const r=state.rounds[window.mode],sec=Math.ceil(Math.max(0,r.ends-Date.now())/1000);document.getElementById("game").innerHTML=`<div class="timer"><div>Time remaining</div><div class="time">${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}</div><div class="period">Period ${r.period}</div></div><div class="card"><div class="betgrid"><button class="bet green" data-bet="green">Green 2×</button><button class="bet violet" data-bet="violet">Violet 4.5×</button><button class="bet red" data-bet="red">Red 2×</button></div><h4>Numbers</h4><div class="numbergrid">${[0,1,2,3,4,5,6,7,8,9].map(n=>`<button class="num" data-bet="n${n}">${n}</button>`).join("")}</div><h4>Size</h4><div class="sizegrid"><button class="bet big" data-bet="big">Big 2×</button><button class="bet smallb" data-bet="small">Small 2×</button></div><p class="small">Virtual points only. Each prediction costs 10 points.</p></div><div class="card"><h3>Game history</h3><table class="history"><tr><th>Period</th><th>Number</th><th>Size</th><th>Color</th></tr>${r.history.slice(-8).reverse().map(x=>`<tr><td>${x.period}</td><td>${x.number}</td><td>${x.size}</td><td>${x.color}</td></tr>`).join("")}</table></div>`;
document.querySelectorAll("[data-bet]").forEach(b=>b.onclick=()=>placeBet(b.dataset.bet))}
function renderTimer(){const r=state.rounds[window.mode];if(!r)return;if(Date.now()>=r.ends){const n=Math.floor(Math.random()*10),color=[0,2,4,6,8].includes(n)?"Red":"Green",size=n>=5?"Big":"Small";r.history.push({period:r.period,number:n,size,color});r.period++;r.ends=Date.now()+Number(window.mode)*1000;save();renderGame()}else{const el=document.querySelector(".timer .time");if(el){const s=Math.ceil((r.ends-Date.now())/1000);el.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}}}
function placeBet(type){const u=user();if(u.balance<10)return toast("Not enough virtual points");u.balance-=10;u.history.push({type:"prediction",bet:type,amount:10,time:new Date().toLocaleString()});save();toast("Prediction placed with 10 virtual points")}
function page(p){const g=document.getElementById("game");if(p==="game"){renderGame();return}if(p==="gift"){g.innerHTML=gift();bindGift();return}if(p==="wallet"){g.innerHTML=wallet();return}if(p==="deposit"){g.innerHTML=deposit();bindDeposit();return}if(p==="withdraw"){g.innerHTML=withdraw();bindWithdraw();return}if(p==="profile"){g.innerHTML=profile();bindProfile();return}}
function gift(){return `<div class="card"><h2>🎁 Gift</h2><div class="notice">Demo rewards only — no cash value.</div><label>Gift code</label><input id="giftCode" class="input" placeholder="Please enter gift code"><label>Verification code</label><div class="row"><input id="giftVerify" class="input" placeholder="4-digit code"><button id="newCode" class="btn ghost">4827</button></div><button id="receive" class="btn primary">Receive</button><hr><h3>Follow channels</h3><div class="social"><a href="https://t.me" target="_blank">✈️ Telegram</a><a href="https://wa.me" target="_blank">💬 WhatsApp</a></div></div>`}
function bindGift(){newCode.onclick=()=>{newCode.textContent=Math.floor(1000+Math.random()*9000)};receive.onclick=()=>{const code=giftCode.value.trim().toUpperCase();if(giftVerify.value!==newCode.textContent)return toast("Invalid verification code");if(!state.giftCodes[code])return toast("Invalid gift code");if(user().history.some(x=>x.type==="gift"&&x.code===code))return toast("Already claimed");const a=state.giftCodes[code];user().balance+=a;user().history.push({type:"gift",code,amount:a,time:new Date().toLocaleString()});save();toast("Successfully received");page("gift")}}
function wallet(){return `<div class="card"><h2>Wallet</h2><div class="balance"><div>Virtual points</div><div class="amount">₹${user().balance.toFixed(2)}</div></div><p class="small">This balance has no cash value.</p></div>`}
function deposit(){return `<div class="card"><h2>Demo Deposit</h2><div class="notice">⚠️ No real payment is created or accepted.</div><p>Choose a virtual amount:</p><div class="row"><button class="btn ghost amt">₹100</button><button class="btn ghost amt">₹500</button><button class="btn ghost amt">₹1000</button></div><label>Demo reference</label><input id="utr" class="input" placeholder="DEMO123456"><button id="submitDep" class="btn primary">Submit Demo Request</button></div>`}
function bindDeposit(){document.querySelectorAll(".amt").forEach(b=>b.onclick=()=>{document.getElementById("utr").dataset.amount=b.textContent.replace(/[₹,]/g,"")});submitDep.onclick=()=>{const amount=Number(utr.dataset.amount||0);const ref=utr.value.trim();if(!amount||!ref)return toast("Choose amount and reference");state.transactions.push({kind:"deposit",user:state.user,amount,utr:ref,status:"Pending",time:new Date().toLocaleString()});save();toast("Demo request submitted");page("wallet")}}
function withdraw(){return `<div class="card"><h2>Demo Withdrawal</h2><div class="notice">No cash is transferred. This only creates a simulated admin request.</div><label>UPI ID</label><input id="upi" class="input" placeholder="example@upi"><label>Virtual amount</label><input id="wamt" class="input" type="number" placeholder="100"><button id="submitW" class="btn primary">Submit Demo Withdrawal</button></div>`}
function bindWithdraw(){submitW.onclick=()=>{const amount=Number(wamt.value);if(!amount||amount<=0)return toast("Enter amount");state.transactions.push({kind:"withdrawal",user:state.user,amount,upi:upi.value,status:"Pending",time:new Date().toLocaleString()});save();toast("Demo withdrawal request submitted");page("wallet")}}
function profile(){return `<div class="card"><h2>Profile</h2><p><b>User ID:</b> ${esc(state.user)}</p><p class="small">Entertainment/demo account</p><button id="logout" class="btn outline">Log out</button></div>`}
function bindProfile(){logout.onclick=()=>{state.user=null;save();app()}}
function adminLogin(){document.getElementById("app").innerHTML=`<div class="shell"><div class="top"><div class="brand">ColorWin Admin</div></div><div class="card"><h2>Admin Login</h2><label>Username</label><input id="au" class="input"><label>Password</label><input id="ap" class="input" type="password"><button id="adminGo" class="btn primary">Login</button><p class="small">Username: admin<br>Password: admin-demo-only</p></div></div>`;adminGo.onclick=()=>{if(au.value===ADMIN_USER&&ap.value===ADMIN_PASS){sessionStorage.admin="1";location.pathname="/admin"}else toast("Invalid admin credentials")}}
function admin(){if(sessionStorage.admin!=="1")return adminLogin();const pending=state.transactions.filter(x=>x.status==="Pending");document.getElementById("app").innerHTML=`<div class="shell"><div class="top"><div class="brand">ColorWin Admin</div><div class="sub">Virtual-credit control center</div></div><div class="card"><h3>Users</h3><p>${Object.keys(state.users).length}</p></div><div class="card"><h3>Pending Requests</h3>${pending.map(x=>`<div class="card"><b>${esc(x.user)}</b><br>${x.kind} • ₹${x.amount}<br><button class="btn primary" onclick="adminAction(${state.transactions.indexOf(x)},'approve')">Approve</button> <button class="btn danger" onclick="adminAction(${state.transactions.indexOf(x)},'reject')">Reject</button></div>`).join("")||"<p class='small'>None</p>"}</div><div class="card"><button class="btn outline" id="adminOut">Admin logout</button></div></div>`;adminOut.onclick=()=>{sessionStorage.removeItem("admin");location.pathname="/admin-login"}}
window.adminAction=(i,a)=>{const x=state.transactions[i];if(!x)return;if(a==="approve"&&x.kind==="deposit")state.users[x.user].balance+=x.amount;x.status=a==="approve"?"Approved":"Rejected";save();admin()}
app();
