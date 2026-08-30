import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'colorwin-demo-secret-change-me';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin-demo-only';
const DB_FILE = path.join(__dirname, 'db', 'colorwin.json');

const blank = () => ({users:[],bets:[],rounds:[],requests:[],gifts:[{id:1,code:'GIFT50',amount:5000,active:1,created_at:new Date().toISOString()}],giftClaims:[],next:{user:1,bet:1,round:1,request:1,gift:2,claim:1}});
fs.mkdirSync(path.dirname(DB_FILE), {recursive:true});
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { db = blank(); save(); }
function save(){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
const now=()=>new Date().toISOString();
const userCode=()=>`CW${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const publicUser=u=>u&&({id:u.id,user_code:u.user_code,phone:u.phone,email:u.email,balance:u.balance,created_at:u.created_at});
const currentUser=id=>publicUser(db.users.find(u=>u.id===Number(id)));
function tokenFor(u){return jwt.sign({id:u.id,role:'user'},JWT_SECRET,{expiresIn:'7d'});}
function auth(req,res,next){try{const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';req.user=jwt.verify(t,JWT_SECRET);next();}catch{res.status(401).json({error:'Unauthorized'});}}
function admin(req,res,next){if(req.headers['x-admin-token']!=='demo-admin-token')return res.status(401).json({error:'Admin authentication required'});next();}
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

app.post('/api/send-otp',(req,res)=>res.json({message:'Demo OTP sent',otp:'123456'}));
app.post('/api/register',async(req,res)=>{
  const {phone,email,password,otp}=req.body||{};
  if(!password||password.length<6)return res.status(400).json({error:'Password must be at least 6 characters'});
  if(otp!=='123456')return res.status(400).json({error:'Demo OTP is 123456'});
  if(!phone&&!email)return res.status(400).json({error:'Phone or email required'});
  if(db.users.some(u=>(phone&&u.phone===phone)||(email&&u.email===email)))return res.status(400).json({error:'Account already exists'});
  const u={id:db.next.user++,user_code:userCode(),phone:phone||null,email:email||null,password_hash:await bcrypt.hash(password,10),balance:100000,created_at:now()};
  db.users.push(u);save();res.json({token:tokenFor(u),user:publicUser(u)});
});
app.post('/api/login',async(req,res)=>{const {identifier,password}=req.body||{};const u=db.users.find(x=>x.phone===identifier||x.email===identifier);if(!u||!(await bcrypt.compare(password||'',u.password_hash)))return res.status(401).json({error:'Invalid login'});res.json({token:tokenFor(u),user:publicUser(u)});});
app.get('/api/me',auth,(req,res)=>{const u=currentUser(req.user.id);if(!u)return res.status(401).json({error:'User not found'});res.json(u);});

const modes={'30s':30,'1m':60,'3m':180,'5m':300};
const currentPeriod=mode=>String(Math.floor(Date.now()/1000/modes[mode]));
function settle(mode,period){let existing=db.rounds.find(r=>r.mode===mode&&r.period===period);if(existing)return existing;const number=Math.floor(Math.random()*10);const color=number===0||number===5?'Violet':([1,3,5,7,9].includes(number)?'Green':'Red');const size=number>=5?'Big':'Small';const r={id:db.next.round++,mode,period,number,color,size,created_at:now()};db.rounds.push(r);for(const b of db.bets.filter(x=>x.mode===mode&&x.period===period&&x.status==='pending')){let win=false,m=0;if(b.bet_type==='color'&&b.selection===color){win=true;m=color==='Violet'?4.5:2;}if(b.bet_type==='number'&&Number(b.selection)===number){win=true;m=9;}if(b.bet_type==='size'&&b.selection===size){win=true;m=2;}b.status=win?'won':'lost';b.payout=win?Math.floor(b.amount*m):0;const u=db.users.find(x=>x.id===b.user_id);if(u&&b.payout)u.balance+=b.payout;}save();return r;}
app.get('/api/game/:mode',auth,(req,res)=>{const mode=req.params.mode;if(!modes[mode])return res.status(400).json({error:'Invalid mode'});const period=currentPeriod(mode);const elapsed=Math.floor(Date.now()/1000)%modes[mode];const secondsLeft=modes[mode]-elapsed;settle(mode,String(Number(period)-1));const history=db.rounds.filter(r=>r.mode===mode).sort((a,b)=>b.id-a.id).slice(0,20);res.json({mode,period,secondsLeft,history});});
app.post('/api/bet',auth,(req,res)=>{const {mode,betType,selection,amount}=req.body||{};if(!modes[mode]||!['color','number','size'].includes(betType)||!Number.isInteger(amount)||amount<1)return res.status(400).json({error:'Invalid virtual bet'});const allowed=betType==='color'?['Green','Red','Violet']:betType==='size'?['Big','Small']:['0','1','2','3','4','5','6','7','8','9'];if(!allowed.includes(String(selection)))return res.status(400).json({error:'Invalid selection'});const u=db.users.find(x=>x.id===req.user.id);if(!u||u.balance<amount)return res.status(400).json({error:'Insufficient virtual balance'});u.balance-=amount;db.bets.push({id:db.next.bet++,user_id:u.id,mode,period:currentPeriod(mode),bet_type:betType,selection:String(selection),amount,status:'pending',payout:0,created_at:now()});save();res.json({user:publicUser(u),period:currentPeriod(mode)});});
app.get('/api/bets',auth,(req,res)=>res.json(db.bets.filter(b=>b.user_id===req.user.id).sort((a,b)=>b.id-a.id).slice(0,100)));

app.post('/api/deposit-request',auth,(req,res)=>{const {amount,utr}=req.body||{};if(!Number.isInteger(amount)||amount<10000||!/^[0-9]{12}$/.test(String(utr||'')))return res.status(400).json({error:'Demo deposits require amount >= ₹100 and a 12-digit test UTR'});const r={id:db.next.request++,user_id:req.user.id,type:'deposit',amount,status:'Pending',utr:String(utr),created_at:now()};db.requests.push(r);save();res.json({id:r.id,status:r.status});});
app.post('/api/withdraw-request',auth,(req,res)=>{const {amount,bankName,accountNumber,ifsc,upiId}=req.body||{};const u=db.users.find(x=>x.id===req.user.id);if(!Number.isInteger(amount)||amount<10000||!u||u.balance<amount)return res.status(400).json({error:'Insufficient virtual balance or invalid amount'});u.balance-=amount;const r={id:db.next.request++,user_id:u.id,type:'withdrawal',amount,status:'Pending',bank_name:bankName||'',account_number:accountNumber||'',ifsc:ifsc||'',upi_id:upiId||'',created_at:now()};db.requests.push(r);save();res.json({id:r.id,status:r.status,user:publicUser(u)});});
app.get('/api/requests',auth,(req,res)=>res.json(db.requests.filter(r=>r.user_id===req.user.id).sort((a,b)=>b.id-a.id)));

app.post('/api/gift/redeem',auth,(req,res)=>{const code=String(req.body?.code||'').trim().toUpperCase();const g=db.gifts.find(x=>x.code===code&&x.active);if(!g)return res.status(400).json({error:'Invalid or inactive gift code'});if(db.giftClaims.some(c=>c.gift_id===g.id&&c.user_id===req.user.id))return res.status(400).json({error:'Gift code already claimed'});db.giftClaims.push({id:db.next.claim++,gift_id:g.id,user_id:req.user.id,claimed_at:now()});const u=db.users.find(x=>x.id===req.user.id);u.balance+=g.amount;save();res.json({message:'Successfully received',amount:g.amount,user:publicUser(u)});});
app.get('/api/gift/history',auth,(req,res)=>res.json(db.giftClaims.filter(c=>c.user_id===req.user.id).sort((a,b)=>b.id-a.id).map(c=>{const g=db.gifts.find(x=>x.id===c.gift_id);return{code:g.code,amount:g.amount,claimed_at:c.claimed_at};})));

app.post('/api/admin/login',(req,res)=>{const {username,password}=req.body||{};if(username!==ADMIN_USER||password!==ADMIN_PASSWORD)return res.status(401).json({error:'Invalid admin credentials'});res.json({token:'demo-admin-token'});});
app.get('/api/admin/overview',admin,(req,res)=>{const deposits=db.requests.filter(r=>r.type==='deposit'&&r.status==='Approved').reduce((s,r)=>s+r.amount,0);const withdrawals=db.requests.filter(r=>r.type==='withdrawal'&&r.status==='Approved').reduce((s,r)=>s+r.amount,0);res.json({users:db.users.length,deposits,withdrawals,profit:deposits-withdrawals});});
app.get('/api/admin/requests',admin,(req,res)=>res.json(db.requests.slice().sort((a,b)=>b.id-a.id).map(r=>({...r,...(()=>{const u=db.users.find(x=>x.id===r.user_id);return{user_code:u?.user_code||'',phone:u?.phone||'',email:u?.email||''}})()}))));
app.post('/api/admin/request/:id',admin,(req,res)=>{const {action}=req.body||{};const r=db.requests.find(x=>x.id===Number(req.params.id));if(!r||!['Approve','Reject'].includes(action)||r.status!=='Pending')return res.status(400).json({error:'Invalid request'});const u=db.users.find(x=>x.id===r.user_id);if(action==='Approve'&&r.type==='deposit')u.balance+=r.amount;if(action==='Reject'&&r.type==='withdrawal')u.balance+=r.amount;r.status=action==='Approve'?'Approved':'Rejected';save();res.json({ok:true});});
app.get('/api/admin/gifts',admin,(req,res)=>res.json(db.gifts.map(g=>({...g,claims:db.giftClaims.filter(c=>c.gift_id===g.id).length}))));
app.post('/api/admin/gifts',admin,(req,res)=>{const {code,amount}=req.body||{};const c=String(code||'').trim().toUpperCase();if(!c||!Number.isInteger(amount)||amount<1||db.gifts.some(g=>g.code===c))return res.status(400).json({error:'Invalid or duplicate gift'});const g={id:db.next.gift++,code:c,amount,active:1,created_at:now()};db.gifts.push(g);save();res.json({id:g.id});});
app.get('/{*splat}',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`ColorWin demo running on http://localhost:${PORT}`));
