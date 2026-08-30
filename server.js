import express from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-change-me';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin-demo-only';
const db = new Database(path.join(__dirname, 'db', 'colorwin.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_code TEXT UNIQUE NOT NULL,
 phone TEXT UNIQUE,
 email TEXT UNIQUE,
 password_hash TEXT NOT NULL,
 balance INTEGER NOT NULL DEFAULT 100000,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 mode TEXT NOT NULL,
 period TEXT NOT NULL,
 bet_type TEXT NOT NULL,
 selection TEXT NOT NULL,
 amount INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 payout INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rounds (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 mode TEXT NOT NULL,
 period TEXT NOT NULL,
 number INTEGER NOT NULL,
 color TEXT NOT NULL,
 size TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(mode, period)
);
CREATE TABLE IF NOT EXISTS requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 type TEXT NOT NULL,
 amount INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending',
 utr TEXT,
 bank_name TEXT,
 account_number TEXT,
 ifsc TEXT,
 upi_id TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gifts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT UNIQUE NOT NULL,
 amount INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gift_claims (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 gift_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 claimed_at TEXT NOT NULL,
 UNIQUE(gift_id, user_id)
);
`);
const now = () => new Date().toISOString();
const userCode = () => `CW${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const seed = db.prepare('SELECT COUNT(*) c FROM gifts').get();
if (!seed.c) db.prepare('INSERT INTO gifts(code,amount,active,created_at) VALUES(?,?,1,?)').run('GIFT50', 5000, now());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function tokenFor(user) { return jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req,res,next){
  try { const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):''; req.user=jwt.verify(t,JWT_SECRET); next(); }
  catch { res.status(401).json({error:'Unauthorized'}); }
}
function admin(req,res,next){
  if(req.headers['x-admin-token']!=='demo-admin-token') return res.status(401).json({error:'Admin authentication required'});
  next();
}
function currentUser(id){ return db.prepare('SELECT id,user_code,phone,email,balance,created_at FROM users WHERE id=?').get(id); }

app.post('/api/register', (req,res)=>{
  const {phone,email,password,otp}=req.body||{};
  if(!password || password.length<6) return res.status(400).json({error:'Password must be at least 6 characters'});
  if(otp!=='123456') return res.status(400).json({error:'Demo OTP is 123456'});
  if(!phone && !email) return res.status(400).json({error:'Phone or email required'});
  try {
    const hash=bcrypt.hashSync(password,10); const code=userCode();
    const info=db.prepare('INSERT INTO users(user_code,phone,email,password_hash,balance,created_at) VALUES(?,?,?,?,?,?)').run(code,phone||null,email||null,hash,100000,now());
    const user=currentUser(info.lastInsertRowid); res.json({token:tokenFor(user),user});
  } catch(e){ res.status(400).json({error:'Account already exists'}); }
});
app.post('/api/send-otp',(req,res)=>res.json({message:'Demo OTP sent',otp:'123456'}));
app.post('/api/login',(req,res)=>{
  const {identifier,password}=req.body||{};
  const u=db.prepare('SELECT * FROM users WHERE phone=? OR email=?').get(identifier,identifier);
  if(!u || !bcrypt.compareSync(password||'',u.password_hash)) return res.status(401).json({error:'Invalid login'});
  res.json({token:tokenFor(u),user:currentUser(u.id)});
});
app.get('/api/me',auth,(req,res)=>res.json(currentUser(req.user.id)));

const modes={
 '30s':30,'1m':60,'3m':180,'5m':300
};
function currentPeriod(mode){ const len=modes[mode]; return String(Math.floor(Date.now()/1000/len)); }
function settle(mode,period){
  const existing=db.prepare('SELECT * FROM rounds WHERE mode=? AND period=?').get(mode,period); if(existing) return existing;
  const number=Math.floor(Math.random()*10);
  const color=[0,2,4,6,8].includes(number)?'Red':'Green';
  const finalColor=(number===0||number===5)?'Violet':color;
  const size=number>=5?'Big':'Small';
  const tx=db.transaction(()=>{
    db.prepare('INSERT OR IGNORE INTO rounds(mode,period,number,color,size,created_at) VALUES(?,?,?,?,?,?)').run(mode,period,number,finalColor,size,now());
    const bets=db.prepare("SELECT * FROM bets WHERE mode=? AND period=? AND status='pending'").all(mode,period);
    for(const b of bets){
      let win=false, multiplier=0;
      if(b.bet_type==='color' && b.selection===finalColor){win=true; multiplier= b.selection==='Violet'?4.5:2;}
      if(b.bet_type==='number' && Number(b.selection)===number){win=true; multiplier=9;}
      if(b.bet_type==='size' && b.selection===size){win=true; multiplier=2;}
      const payout=win?Math.floor(b.amount*multiplier):0;
      if(payout) db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(payout,b.user_id);
      db.prepare('UPDATE bets SET status=?,payout=? WHERE id=?').run(win?'won':'lost',payout,b.id);
    }
  });
  tx(); return db.prepare('SELECT * FROM rounds WHERE mode=? AND period=?').get(mode,period);
}
app.get('/api/game/:mode',auth,(req,res)=>{
  const mode=req.params.mode; if(!modes[mode]) return res.status(400).json({error:'Invalid mode'});
  const period=currentPeriod(mode); const secondsLeft=modes[mode]-(Math.floor(Date.now()/1000)%modes[mode]);
  const history=db.prepare('SELECT period,number,color,size,created_at FROM rounds WHERE mode=? ORDER BY id DESC LIMIT 20').all(mode);
  res.json({mode,period,secondsLeft,history});
});
app.post('/api/bet',auth,(req,res)=>{
  const {mode,betType,selection,amount}=req.body||{};
  if(!modes[mode]||!['color','number','size'].includes(betType)||!Number.isInteger(amount)||amount<1) return res.status(400).json({error:'Invalid bet'});
  const allowed=betType==='color'?['Green','Red','Violet']:betType==='size'?['Big','Small']:['0','1','2','3','4','5','6','7','8','9'];
  if(!allowed.includes(String(selection))) return res.status(400).json({error:'Invalid selection'});
  const u=currentUser(req.user.id); if(u.balance<amount) return res.status(400).json({error:'Insufficient virtual balance'});
  const period=currentPeriod(mode);
  const tx=db.transaction(()=>{
    db.prepare('UPDATE users SET balance=balance-? WHERE id=?').run(amount,u.id);
    db.prepare('INSERT INTO bets(user_id,mode,period,bet_type,selection,amount,created_at) VALUES(?,?,?,?,?,?,?)').run(u.id,mode,period,betType,String(selection),amount,now());
  }); tx(); res.json({user:currentUser(u.id),period});
});
app.get('/api/bets',auth,(req,res)=>res.json(db.prepare('SELECT mode,period,bet_type,selection,amount,status,payout,created_at FROM bets WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id)));

app.post('/api/deposit-request',auth,(req,res)=>{
  const {amount,utr}=req.body||{};
  if(!Number.isInteger(amount)||amount<10000||!/^\d{12}$/.test(String(utr||''))) return res.status(400).json({error:'Demo deposits require an amount >= ₹100 and a 12-digit test UTR'});
  const info=db.prepare("INSERT INTO requests(user_id,type,amount,status,utr,created_at) VALUES(?,?,?,?,?,?)").run(req.user.id,'deposit',amount,'Pending',utr,now());
  res.json({id:info.lastInsertRowid,status:'Pending'});
});
app.post('/api/withdraw-request',auth,(req,res)=>{
  const {amount,bankName,accountNumber,ifsc,upiId}=req.body||{};
  const u=currentUser(req.user.id);
  if(!Number.isInteger(amount)||amount<100||u.balance<amount) return res.status(400).json({error:'Insufficient virtual balance or invalid amount'});
  const tx=db.transaction(()=>{
    db.prepare('UPDATE users SET balance=balance-? WHERE id=?').run(amount,u.id);
    return db.prepare("INSERT INTO requests(user_id,type,amount,status,bank_name,account_number,ifsc,upi_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(u.id,'withdrawal',amount,'Pending',bankName,accountNumber,ifsc,upiId,now());
  });
  const info=tx(); res.json({id:info.lastInsertRowid,status:'Pending',user:currentUser(u.id)});
});
app.get('/api/requests',auth,(req,res)=>res.json(db.prepare('SELECT * FROM requests WHERE user_id=? ORDER BY id DESC').all(req.user.id)));

app.post('/api/gift/redeem',auth,(req,res)=>{
  const {code}=req.body||{}; const g=db.prepare('SELECT * FROM gifts WHERE code=? AND active=1').get(String(code||'').trim().toUpperCase());
  if(!g) return res.status(400).json({error:'Invalid or inactive gift code'});
  try {
    const tx=db.transaction(()=>{ db.prepare('INSERT INTO gift_claims(gift_id,user_id,claimed_at) VALUES(?,?,?)').run(g.id,req.user.id,now()); db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(g.amount,req.user.id); }); tx();
    res.json({message:'Successfully received',amount:g.amount,user:currentUser(req.user.id)});
  } catch { res.status(400).json({error:'Gift code already claimed'}); }
});
app.get('/api/gift/history',auth,(req,res)=>res.json(db.prepare('SELECT g.code,g.amount,c.claimed_at FROM gift_claims c JOIN gifts g ON g.id=c.gift_id WHERE c.user_id=? ORDER BY c.id DESC').all(req.user.id)));

app.post('/api/admin/login',(req,res)=>{ const {username,password}=req.body||{}; if(username!==ADMIN_USER||password!==ADMIN_PASSWORD) return res.status(401).json({error:'Invalid admin credentials'}); res.json({token:'demo-admin-token'}); });
app.get('/api/admin/overview',admin,(req,res)=>{
 const users=db.prepare('SELECT COUNT(*) c FROM users').get().c;
 const deposits=db.prepare("SELECT COALESCE(SUM(amount),0) s FROM requests WHERE type='deposit' AND status='Approved'").get().s;
 const withdrawals=db.prepare("SELECT COALESCE(SUM(amount),0) s FROM requests WHERE type='withdrawal' AND status='Approved'").get().s;
 const profit=deposits-withdrawals;
 res.json({users,deposits,withdrawals,profit});
});
app.get('/api/admin/requests',admin,(req,res)=>res.json(db.prepare(`SELECT r.*,u.user_code,u.phone,u.email FROM requests r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC`).all()));
app.post('/api/admin/request/:id',admin,(req,res)=>{
 const {action}=req.body||{}; const r=db.prepare('SELECT * FROM requests WHERE id=?').get(req.params.id); if(!r||!['Approve','Reject'].includes(action)) return res.status(400).json({error:'Invalid request'}); if(r.status!=='Pending') return res.status(400).json({error:'Already processed'});
 const tx=db.transaction(()=>{
   if(action==='Approve' && r.type==='deposit') db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(r.amount,r.user_id);
   if(action==='Reject' && r.type==='withdrawal') db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(r.amount,r.user_id);
   db.prepare('UPDATE requests SET status=? WHERE id=?').run(action==='Approve'?'Approved':'Rejected',r.id);
 }); tx(); res.json({ok:true});
});
app.get('/api/admin/gifts',admin,(req,res)=>res.json(db.prepare(`SELECT g.id,g.code,g.amount,g.active,g.created_at,COUNT(c.id) claims FROM gifts g LEFT JOIN gift_claims c ON c.gift_id=g.id GROUP BY g.id ORDER BY g.id DESC`).all()));
app.post('/api/admin/gifts',admin,(req,res)=>{ const {code,amount}=req.body||{}; if(!code||!Number.isInteger(amount)||amount<1) return res.status(400).json({error:'Invalid gift'}); try { const info=db.prepare('INSERT INTO gifts(code,amount,active,created_at) VALUES(?,?,1,?)').run(String(code).toUpperCase(),amount,now()); res.json({id:info.lastInsertRowid}); } catch { res.status(400).json({error:'Code already exists'}); } });

app.get('/{*splat}',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`ColorWin demo running on http://localhost:${PORT}`));
