import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is missing or too short');
}

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  throw new Error('ADMIN_USER / ADMIN_PASSWORD missing');
}

if (!MSG91_AUTHKEY || !MSG91_TEMPLATE_ID) {
  console.warn(
    'MSG91 credentials are missing. Real OTP will not work until .env is configured.'
  );
}

const DB_FILE = path.join(__dirname, 'db', 'colorwin.json');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const blank = () => ({
  users: [],
  bets: [],
  rounds: [],
  requests: [],
  gifts: [
    {
      id: 1,
      code: 'GIFT50',
      amount: 5000,
      active: 1,
      created_at: new Date().toISOString()
    }
  ],
  giftClaims: [],
  otpChallenges: [],
  next: {
    user: 1,
    bet: 1,
    round: 1,
    request: 1,
    gift: 2,
    claim: 1
  }
});

let db;

try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  db = blank();
  save();
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const now = () => new Date().toISOString();

const userCode = () =>
  `CW${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const publicUser = u =>
  u && {
    id: u.id,
    user_code: u.user_code,
    phone: u.phone,
    email: u.email,
    balance: u.balance,
    created_at: u.created_at
  };

function tokenFor(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const token = header.slice(7);

    req.auth = jwt.verify(token, JWT_SECRET);

    next();
  } catch {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }
}

function admin(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Admin authentication required'
      });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access denied'
      });
    }

    req.admin = payload;

    next();
  } catch {
    return res.status(401).json({
      error: 'Admin authentication required'
    });
  }
}

function normalizePhone(value) {
  let phone = String(value || '').trim().replace(/[^\d+]/g, '');

  if (phone.startsWith('+')) {
    phone = phone.slice(1);
  }

  if (phone.startsWith('0') && phone.length === 10) {
    phone = `91${phone.slice(1)}`;
  }

  if (/^\d{10}$/.test(phone)) {
    phone = `91${phone}`;
  }

  if (!/^91\d{10}$/.test(phone)) {
    return null;
  }

  return phone;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return email;
}

function userByIdentifier(identifier) {
  const raw = String(identifier || '').trim();

  const phone = normalizePhone(raw);
  const email = normalizeEmail(raw);

  return db.users.find(u =>
    (phone && u.phone === phone) ||
    (email && u.email === email)
  );
}

async function msg91SendOtp(phone) {
  if (!MSG91_AUTHKEY || !MSG91_TEMPLATE_ID) {
    throw new Error('MSG91 is not configured');
  }

  const params = new URLSearchParams({
    template_id: MSG91_TEMPLATE_ID,
    mobile: phone,
    authkey: MSG91_AUTHKEY,
    otp_length: '6',
    otp_expiry: '5'
  });

  const response = await fetch(
    `https://control.msg91.com/api/v5/otp?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json'
      }
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.type === 'error') {
    console.error('MSG91 send error:', data);

    throw new Error(
      data.message ||
      'Unable to send OTP'
    );
  }

  return data;
}

async function msg91VerifyOtp(phone, otp) {
  if (!MSG91_AUTHKEY) {
    throw new Error('MSG91 is not configured');
  }

  const params = new URLSearchParams({
    mobile: phone,
    otp: String(otp)
  });

  const response = await fetch(
    `https://control.msg91.com/api/v5/otp/verify?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        authkey: MSG91_AUTHKEY,
        accept: 'application/json'
      }
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return false;
  }

  const message = String(
    data.message || ''
  ).toLowerCase();

  return (
    data.type === 'success' ||
    message.includes('verified')
  );
}

async function msg91RetryOtp(phone) {
  if (!MSG91_AUTHKEY) {
    throw new Error('MSG91 is not configured');
  }

  const params = new URLSearchParams({
    authkey: MSG91_AUTHKEY,
    retrytype: 'text',
    mobile: phone
  });

  const response = await fetch(
    `https://control.msg91.com/api/v5/otp/retry?${params.toString()}`,
    {
      method: 'GET'
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.type === 'error') {
    throw new Error(
      data.message ||
      'Unable to resend OTP'
    );
  }

  return data;
}

app.use(
  helmet({
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: '20kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many OTP requests. Please try again later.'
  }
});

app.use('/api', apiLimiter);

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

app.get('/index.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

app.get('/app.js', (req, res) => {
  res.type('application/javascript');

  res.sendFile(
    path.join(__dirname, 'public', 'app.js')
  );
});

app.get('/style.css', (req, res) => {
  res.type('text/css');

  res.sendFile(
    path.join(__dirname, 'public', 'style.css')
  );
});

/* =========================
   OTP
========================= */

app.post('/api/send-otp', otpLimiter, async (req, res) => {
  try {
    const {
      phone,
      purpose = 'register'
    } = req.body || {};

    const normalized = normalizePhone(phone);

    if (!normalized) {
      return res.status(400).json({
        error: 'Valid Indian mobile number required'
      });
    }

    if (
      !['register', 'login', 'reset'].includes(purpose)
    ) {
      return res.status(400).json({
        error: 'Invalid OTP purpose'
      });
    }

    if (purpose === 'register') {
      const existing = db.users.find(
        u => u.phone === normalized
      );

      if (existing) {
        return res.status(400).json({
          error: 'Phone number is already registered'
        });
      }
    }

    if (purpose === 'reset') {
      const existing = db.users.find(
        u => u.phone === normalized
      );

      if (!existing) {
        return res.status(400).json({
          error: 'Account not found'
        });
      }
    }

    await msg91SendOtp(normalized);

    db.otpChallenges = db.otpChallenges.filter(
      x =>
        !(
          x.phone === normalized &&
          x.purpose === purpose &&
          x.used === false
        )
    );

    db.otpChallenges.push({
      id: crypto.randomUUID(),
      phone: normalized,
      purpose,
      created_at: Date.now(),
      expires_at: Date.now() + 5 * 60 * 1000,
      used: false
    });

    save();

    return res.json({
      ok: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      error: error.message || 'OTP service unavailable'
    });
  }
});

app.post('/api/verify-otp', otpLimiter, async (req, res) => {
  try {
    const {
      phone,
      otp,
      purpose = 'register'
    } = req.body || {};

    const normalized = normalizePhone(phone);
    const code = String(otp || '').trim();

    if (!normalized || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: 'Valid phone and 6-digit OTP required'
      });
    }

    const challenge =
      db.otpChallenges
        .filter(
          x =>
            x.phone === normalized &&
            x.purpose === purpose &&
            !x.used
        )
        .sort((a, b) => b.created_at - a.created_at)[0];

    if (!challenge) {
      return res.status(400).json({
        error: 'OTP request not found'
      });
    }

    if (Date.now() > challenge.expires_at) {
      challenge.used = true;
      save();

      return res.status(400).json({
        error: 'OTP expired'
      });
    }

    const verified =
      await msg91VerifyOtp(
        normalized,
        code
      );

    if (!verified) {
      return res.status(400).json({
        error: 'Invalid OTP'
      });
    }

    challenge.used = true;

    const proof = tokenFor(
      {
        type: 'otp-proof',
        phone: normalized,
        purpose
      },
      '10m'
    );

    save();

    return res.json({
      ok: true,
      verified: true,
      proof
    });
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      error: error.message || 'OTP verification failed'
    });
  }
});

app.post('/api/retry-otp', otpLimiter, async (req, res) => {
  try {
    const phone = normalizePhone(
      req.body?.phone
    );

    if (!phone) {
      return res.status(400).json({
        error: 'Valid mobile number required'
      });
    }

    await msg91RetryOtp(phone);

    return res.json({
      ok: true,
      message: 'OTP resent successfully'
    });
  } catch (error) {
    return res.status(502).json({
      error: error.message || 'Unable to resend OTP'
    });
  }
});

/* =========================
   USER AUTH
========================= */

app.post('/api/register', async (req, res) => {
  try {
    const {
      phone,
      email,
      password,
      otpProof
    } = req.body || {};

    const normalizedPhone =
      normalizePhone(phone);

    const normalizedEmail =
      email ? normalizeEmail(email) : null;

    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'Phone number is required for OTP registration'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    if (!otpProof) {
      return res.status(400).json({
        error: 'OTP verification required'
      });
    }

    let proof;

    try {
      proof = jwt.verify(
        otpProof,
        JWT_SECRET
      );
    } catch {
      return res.status(400).json({
        error: 'OTP verification expired'
      });
    }

    if (
      proof.type !== 'otp-proof' ||
      proof.purpose !== 'register' ||
      proof.phone !== normalizedPhone
    ) {
      return res.status(400).json({
        error: 'Invalid OTP verification'
      });
    }

    if (
      db.users.some(
        u =>
          u.phone === normalizedPhone ||
          (
            normalizedEmail &&
            u.email === normalizedEmail
          )
      )
    ) {
      return res.status(400).json({
        error: 'Account already exists'
      });
    }

    const user = {
      id: db.next.user++,
      user_code: userCode(),
      phone: normalizedPhone,
      email: normalizedEmail,
      password_hash:
        await bcrypt.hash(password, 12),
      balance: 100000,
      created_at: now()
    };

    db.users.push(user);

    save();

    const token = tokenFor({
      id: user.id,
      role: 'user'
    });

    return res.json({
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Registration failed'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const {
      identifier,
      password
    } = req.body || {};

    const user =
      userByIdentifier(identifier);

    if (
      !user ||
      !(
        await bcrypt.compare(
          password || '',
          user.password_hash
        )
      )
    ) {
      return res.status(401).json({
        error: 'Invalid login details'
      });
    }

    const token = tokenFor({
      id: user.id,
      role: 'user'
    });

    return res.json({
      token,
      user: publicUser(user)
    });
  } catch {
    return res.status(500).json({
      error: 'Login failed'
    });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const {
      phone,
      newPassword,
      otpProof
    } = req.body || {};

    const normalized =
      normalizePhone(phone);

    if (!normalized || !otpProof) {
      return res.status(400).json({
        error: 'OTP verification required'
      });
    }

    if (
      !newPassword ||
      newPassword.length < 6
    ) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    let proof;

    try {
      proof = jwt.verify(
        otpProof,
        JWT_SECRET
      );
    } catch {
      return res.status(400).json({
        error: 'OTP verification expired'
      });
    }

    if (
      proof.type !== 'otp-proof' ||
      proof.purpose !== 'reset' ||
      proof.phone !== normalized
    ) {
      return res.status(400).json({
        error: 'Invalid OTP verification'
      });
    }

    const user = db.users.find(
      u => u.phone === normalized
    );

    if (!user) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    user.password_hash =
      await bcrypt.hash(newPassword, 12);

    save();

    return res.json({
      ok: true,
      message: 'Password reset successfully'
    });
  } catch {
    return res.status(500).json({
      error: 'Password reset failed'
    });
  }
});

app.get('/api/me', auth, (req, res) => {
  const user = db.users.find(
    u => u.id === Number(req.auth.id)
  );

  if (!user) {
    return res.status(401).json({
      error: 'User not found'
    });
  }

  res.json(publicUser(user));
});

/* =========================
   GAME
========================= */

const modes = {
  '30s': 30,
  '1m': 60,
  '3m': 180,
  '5m': 300
};

const currentPeriod = mode =>
  String(
    Math.floor(
      Date.now() / 1000 / modes[mode]
    )
  );

function resultForNumber(number) {
  let color;

  if (number === 0 || number === 5) {
    color = 'Violet';
  } else if (
    [1, 3, 7, 9].includes(number)
  ) {
    color = 'Green';
  } else {
    color = 'Red';
  }

  return {
    number,
    color,
    size: number >= 5 ? 'Big' : 'Small'
  };
}

function settle(mode, period) {
  const existing = db.rounds.find(
    r =>
      r.mode === mode &&
      r.period === period
  );

  if (existing) {
    return existing;
  }

  const number =
    crypto.randomInt(0, 10);

  const result =
    resultForNumber(number);

  const round = {
    id: db.next.round++,
    mode,
    period,
    number,
    color: result.color,
    size: result.size,
    created_at: now()
  };

  db.rounds.push(round);

  for (
    const bet of db.bets.filter(
      x =>
        x.mode === mode &&
        x.period === period &&
        x.status === 'pending'
    )
  ) {
    let won = false;
    let multiplier = 0;

    if (
      bet.bet_type === 'color' &&
      bet.selection === result.color
    ) {
      won = true;
      multiplier =
        result.color === 'Violet'
          ? 4.5
          : 2;
    }

    if (
      bet.bet_type === 'number' &&
      Number(bet.selection) === number
    ) {
      won = true;
      multiplier = 9;
    }

    if (
      bet.bet_type === 'size' &&
      bet.selection === result.size
    ) {
      won = true;
      multiplier = 2;
    }

    bet.status =
      won ? 'won' : 'lost';

    bet.payout =
      won
        ? Math.floor(
            bet.amount * multiplier
          )
        : 0;

    const user =
      db.users.find(
        u => u.id === bet.user_id
      );

    if (user && bet.payout > 0) {
      user.balance += bet.payout;
    }
  }

  save();

  return round;
}

app.get(
  '/api/game/:mode',
  auth,
  (req, res) => {
    const mode =
      req.params.mode;

    if (!modes[mode]) {
      return res.status(400).json({
        error: 'Invalid game mode'
      });
    }

    const period =
      currentPeriod(mode);

    const secondsElapsed =
      Math.floor(Date.now() / 1000) %
      modes[mode];

    const secondsLeft =
      modes[mode] -
      secondsElapsed;

    settle(
      mode,
      String(Number(period) - 1)
    );

    const history =
      db.rounds
        .filter(r => r.mode === mode)
        .sort((a, b) => b.id - a.id)
        .slice(0, 20);

    res.json({
      mode,
      period,
      secondsLeft,
      history
    });
  }
);

app.post('/api/bet', auth, (req, res) => {
  const {
    mode,
    betType,
    selection,
    amount
  } = req.body || {};

  if (
    !modes[mode] ||
    !['color', 'number', 'size'].includes(
      betType
    ) ||
    !Number.isInteger(amount) ||
    amount < 100
  ) {
    return res.status(400).json({
      error: 'Invalid virtual bet'
    });
  }

  const allowed =
    betType === 'color'
      ? ['Green', 'Red', 'Violet']
      : betType === 'size'
        ? ['Big', 'Small']
        : [
            '0','1','2','3','4',
            '5','6','7','8','9'
          ];

  if (
    !allowed.includes(
      String(selection)
    )
  ) {
    return res.status(400).json({
      error: 'Invalid selection'
    });
  }

  const user =
    db.users.find(
      u => u.id === Number(req.auth.id)
    );

  if (!user) {
    return res.status(401).json({
      error: 'User not found'
    });
  }

  if (user.balance < amount) {
    return res.status(400).json({
      error: 'Insufficient virtual balance'
    });
  }

  const period =
    currentPeriod(mode);

  user.balance -= amount;

  const bet = {
    id: db.next.bet++,
    user_id: user.id,
    mode,
    period,
    bet_type: betType,
    selection: String(selection),
    amount,
    status: 'pending',
    payout: 0,
    created_at: now()
  };

  db.bets.push(bet);

  save();

  res.json({
    user: publicUser(user),
    bet: {
      id: bet.id,
      mode: bet.mode,
      period: bet.period,
      betType: bet.bet_type,
      selection: bet.selection,
      amount: bet.amount,
      status: bet.status,
      payout: bet.payout
    }
  });
});

app.get('/api/bets', auth, (req, res) => {
  const bets =
    db.bets
      .filter(
        b =>
          b.user_id ===
          Number(req.auth.id)
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, 100);

  res.json(bets);
});

/* =========================
   DEMO WALLET REQUESTS
========================= */

app.post(
  '/api/deposit-request',
  auth,
  (req, res) => {
    const {
      amount,
      utr
    } = req.body || {};

    if (
      !Number.isInteger(amount) ||
      amount < 10000 ||
      !/^\d{12}$/.test(
        String(utr || '')
      )
    ) {
      return res.status(400).json({
        error:
          'Demo deposits require amount >= ₹100 and a 12-digit test UTR'
      });
    }

    const request = {
      id: db.next.request++,
      user_id: Number(req.auth.id),
      type: 'deposit',
      amount,
      status: 'Pending',
      utr: String(utr),
      created_at: now()
    };

    db.requests.push(request);

    save();

    res.json({
      id: request.id,
      status: request.status
    });
  }
);

app.post(
  '/api/withdraw-request',
  auth,
  (req, res) => {
    const {
      amount,
      bankName,
      accountNumber,
      ifsc,
      upiId
    } = req.body || {};

    const user =
      db.users.find(
        u => u.id === Number(req.auth.id)
      );

    if (
      !user ||
      !Number.isInteger(amount) ||
      amount < 10000 ||
      user.balance < amount
    ) {
      return res.status(400).json({
        error:
          'Insufficient virtual balance or invalid amount'
      });
    }

    user.balance -= amount;

    const request = {
      id: db.next.request++,
      user_id: user.id,
      type: 'withdrawal',
      amount,
      status: 'Pending',
      bank_name: String(bankName || ''),
      account_number:
        String(accountNumber || ''),
      ifsc: String(ifsc || ''),
      upi_id: String(upiId || ''),
      created_at: now()
    };

    db.requests.push(request);

    save();

    res.json({
      id: request.id,
      status: request.status,
      user: publicUser(user)
    });
  }
);

app.get(
  '/api/requests',
  auth,
  (req, res) => {
    res.json(
      db.requests
        .filter(
          r =>
            r.user_id ===
            Number(req.auth.id)
        )
        .sort((a, b) => b.id - a.id)
    );
  }
);

/* =========================
   GIFTS
========================= */

app.post(
  '/api/gift/redeem',
  auth,
  (req, res) => {
    const code =
      String(
        req.body?.code || ''
      )
        .trim()
        .toUpperCase();

    const gift =
      db.gifts.find(
        g =>
          g.code === code &&
          g.active
      );

    if (!gift) {
      return res.status(400).json({
        error:
          'Invalid or inactive gift code'
      });
    }

    const userId =
      Number(req.auth.id);

    if (
      db.giftClaims.some(
        c =>
          c.gift_id === gift.id &&
          c.user_id === userId
      )
    ) {
      return res.status(400).json({
        error:
          'Gift code already claimed'
      });
    }

    const user =
      db.users.find(
        u => u.id === userId
      );

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    db.giftClaims.push({
      id: db.next.claim++,
      gift_id: gift.id,
      user_id: userId,
      claimed_at: now()
    });

    user.balance += gift.amount;

    save();

    res.json({
      message: 'Successfully received',
      amount: gift.amount,
      user: publicUser(user)
    });
  }
);

app.get(
  '/api/gift/history',
  auth,
  (req, res) => {
    const history =
      db.giftClaims
        .filter(
          c =>
            c.user_id ===
            Number(req.auth.id)
        )
        .sort((a, b) => b.id - a.id)
        .map(c => {
          const gift =
            db.gifts.find(
              g => g.id === c.gift_id
            );

          return {
            code: gift?.code || '',
            amount: gift?.amount || 0,
            claimed_at: c.claimed_at
          };
        });

    res.json(history);
  }
);

/* =========================
   ADMIN
========================= */

app.post(
  '/api/admin/login',
  async (req, res) => {
    const {
      username,
      password
    } = req.body || {};

    if (
      username !== ADMIN_USER ||
      password !== ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        error:
          'Invalid admin credentials'
      });
    }

    const token =
      tokenFor(
        {
          role: 'admin',
          username: ADMIN_USER
        },
        '2h'
      );

    res.json({
      token
    });
  }
);

app.get(
  '/api/admin/overview',
  admin,
  (req, res) => {
    const deposits =
      db.requests
        .filter(
          r =>
            r.type === 'deposit' &&
            r.status === 'Approved'
        )
        .reduce(
          (sum, r) =>
            sum + r.amount,
          0
        );

    const withdrawals =
      db.requests
        .filter(
          r =>
            r.type === 'withdrawal' &&
            r.status === 'Approved'
        )
        .reduce(
          (sum, r) =>
            sum + r.amount,
          0
        );

    res.json({
      owner: 'Anand',
      users: db.users.length,
      deposits,
      withdrawals,
      profit:
        deposits - withdrawals
    });
  }
);

app.get(
  '/api/admin/requests',
  admin,
  (req, res) => {
    res.json(
      db.requests
        .slice()
        .sort(
          (a, b) => b.id - a.id
        )
        .map(r => {
          const user =
            db.users.find(
              u => u.id === r.user_id
            );

          return {
            ...r,
            user_code:
              user?.user_code || '',
            phone:
              user?.phone || '',
            email:
              user?.email || ''
          };
        })
    );
  }
);

app.post(
  '/api/admin/request/:id',
  admin,
  (req, res) => {
    const {
      action
    } = req.body || {};

    if (
      !['Approve', 'Reject']
        .includes(action)
    ) {
      return res.status(400).json({
        error: 'Invalid action'
      });
    }

    const request =
      db.requests.find(
        r =>
          r.id ===
          Number(req.params.id)
      );

    if (
      !request ||
      request.status !== 'Pending'
    ) {
      return res.status(400).json({
        error: 'Invalid request'
      });
    }

    const user =
      db.users.find(
        u =>
          u.id ===
          request.user_id
      );

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (
      action === 'Approve' &&
      request.type === 'deposit'
    ) {
      user.balance += request.amount;
    }

    if (
      action === 'Reject' &&
      request.type === 'withdrawal'
    ) {
      user.balance += request.amount;
    }

    request.status =
      action === 'Approve'
        ? 'Approved'
        : 'Rejected';

    save();

    res.json({
      ok: true
    });
  }
);

app.get(
  '/api/admin/gifts',
  admin,
  (req, res) => {
    res.json(
      db.gifts.map(g => ({
        ...g,
        claims:
          db.giftClaims.filter(
            c =>
              c.gift_id === g.id
          ).length
      }))
    );
  }
);

app.post(
  '/api/admin/gifts',
  admin,
  (req, res) => {
    const {
      code,
      amount
    } = req.body || {};

    const normalized =
      String(code || '')
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z0-9]+$/.test(
        normalized
      )
    ) {
      return res.status(400).json({
        error:
          'Gift code must contain only alphanumeric characters'
      });
    }

    if (
      !Number.isInteger(amount) ||
      amount < 1
    ) {
      return res.status(400).json({
        error: 'Invalid gift amount'
      });
    }

    if (
      db.gifts.some(
        g => g.code === normalized
      )
    ) {
      return res.status(400).json({
        error: 'Gift code already exists'
      });
    }

    const gift = {
      id: db.next.gift++,
      code: normalized,
      amount,
      active: 1,
      created_at: now()
    };

    db.gifts.push(gift);

    save();

    res.json({
      id: gift.id
    });
  }
);

/* =========================
   FRONTEND FALLBACK
========================= */

app.get(
  '/{*splat}',
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );
  }
);

app.listen(
  PORT,
  () => {
    console.log(
      `ColorWin demo running on port ${PORT}`
    );
  }
);
