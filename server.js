import "dotenv/config";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = Number(process.env.PORT || 3000);

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY;
const MSG91_WIDGET_ID = process.env.MSG91_WIDGET_ID || "";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET is missing or too short");
}

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  throw new Error("ADMIN_USER / ADMIN_PASSWORD missing");
}

if (!MSG91_AUTHKEY) {
  console.warn("WARNING: MSG91_AUTHKEY is not configured yet.");
}

const DB_FILE = path.join(__dirname, "db", "colorwin.json");

const PUBLIC_DIR = path.join(__dirname, "public");

const MODES = {
  "30s": 30,
  "1m": 60,
  "3m": 180,
  "5m": 300
};

const BET_AMOUNTS = [
  10,
  20,
  50,
  100,
  500,
  1000
];

const ADMIN_ROLE = "admin";
const USER_ROLE = "user";

const blankDB = () => ({
  users: [],
  bets: [],
  rounds: [],
  requests: [],
  gifts: [
    {
      id: 1,
      code: "GIFT50",
      amount: 50,
      active: 1,
      created_at: new Date().toISOString()
    }
  ],
  giftClaims: [],
  settings: {
    notice: "Welcome to ColorWin Entertainment Demo!"
  },
  next: {
    user: 1,
    bet: 1,
    round: 1,
    request: 1,
    gift: 2,
    claim: 1
  }
});

fs.mkdirSync(path.dirname(DB_FILE), {
  recursive: true
});

let db;

try {
  db = JSON.parse(
    fs.readFileSync(DB_FILE, "utf8")
  );
} catch {
  db = blankDB();
  save();
}

function save() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

function now() {
  return new Date().toISOString();
}

function userCode() {
  return (
    "CW" +
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()
  );
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    user_code: user.user_code,
    phone: user.phone || null,
    email: user.email || null,
    balance: user.balance,
    created_at: user.created_at
  };
}

function findUser(id) {
  return db.users.find(
    u => u.id === Number(id)
  );
}

function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || "")
    .replace(/[^\d+]/g, "")
    .trim();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* -------------------------------------------------------
   JWT
------------------------------------------------------- */

function createUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: USER_ROLE
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
      issuer: "colorwin"
    }
  );
}

function createAdminToken() {
  return jwt.sign(
    {
      role: ADMIN_ROLE
    },
    JWT_SECRET,
    {
      expiresIn: "4h",
      issuer: "colorwin-admin"
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: token ? undefined : "colorwin"
  });
}

/* -------------------------------------------------------
   Middleware
------------------------------------------------------- */

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "50kb"
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again later."
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use("/api", apiLimiter);

/* -------------------------------------------------------
   USER AUTH
------------------------------------------------------- */

function requireUser(req, res, next) {
  try {
    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const token = header.slice(7);

    const payload = jwt.verify(
      token,
      JWT_SECRET,
      {
        issuer: "colorwin"
      }
    );

    if (
      payload.role !== USER_ROLE ||
      !payload.id
    ) {
      throw new Error("Invalid user token");
    }

    const user = findUser(payload.id);

    if (!user) {
      return res.status(401).json({
        error: "User not found"
      });
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }
}

function requireAdmin(req, res, next) {
  try {
    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Admin authentication required"
      });
    }

    const token = header.slice(7);

    const payload = jwt.verify(
      token,
      JWT_SECRET,
      {
        issuer: "colorwin-admin"
      }
    );

    if (payload.role !== ADMIN_ROLE) {
      throw new Error("Not admin");
    }

    next();
  } catch {
    return res.status(401).json({
      error: "Admin authentication required"
    });
  }
}

/* -------------------------------------------------------
   STATIC FILES
------------------------------------------------------- */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(PUBLIC_DIR, "index.html")
  );
});

app.get("/index.html", (req, res) => {
  res.sendFile(
    path.join(PUBLIC_DIR, "index.html")
  );
});

app.get("/app.js", (req, res) => {
  res
    .type("application/javascript")
    .sendFile(
      path.join(PUBLIC_DIR, "app.js")
    );
});

app.get("/style.css", (req, res) => {
  res
    .type("text/css")
    .sendFile(
      path.join(PUBLIC_DIR, "style.css")
    );
});

/* -------------------------------------------------------
   MSG91 ACCESS TOKEN VERIFICATION
------------------------------------------------------- */

/*
  MSG91 Widget flow:

  1. User completes OTP inside MSG91 Widget.
  2. Widget returns an access-token.
  3. Frontend sends that access-token here.
  4. Server sends it to MSG91 verifyAccessToken.
  5. Only after successful verification do we create
     our own ColorWin JWT.
*/

async function verifyMSG91AccessToken(accessToken) {
  if (!MSG91_AUTHKEY) {
    throw new Error(
      "MSG91_AUTHKEY is not configured"
    );
  }

  if (
    !accessToken ||
    typeof accessToken !== "string" ||
    accessToken.length < 20
  ) {
    throw new Error(
      "Invalid MSG91 access token"
    );
  }

  const response = await fetch(
    "https://control.msg91.com/api/v5/widget/verifyAccessToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        authkey: MSG91_AUTHKEY,
        "access-token": accessToken
      })
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid response from MSG91"
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      "MSG91 verification failed"
    );
  }

  /*
    MSG91 response formats can contain the verified
    information in different nested fields.
    We intentionally don't trust the client supplied
    identifier. We only use verified data returned
    by MSG91.
  */

  const verified =
    findVerifiedIdentifier(data);

  if (!verified) {
    throw new Error(
      "MSG91 did not return verified identifier"
    );
  }

  return {
    raw: data,
    ...verified
  };
}

function findVerifiedIdentifier(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const phoneKeys = [
    "mobile",
    "phone",
    "phoneNumber",
    "mobileNumber",
    "contact"
  ];

  const emailKeys = [
    "email",
    "emailAddress"
  ];

  for (const key of phoneKeys) {
    if (
      typeof value[key] === "string" &&
      value[key].trim()
    ) {
      return {
        type: "phone",
        value: normalizePhone(value[key])
      };
    }
  }

  for (const key of emailKeys) {
    if (
      typeof value[key] === "string" &&
      value[key].trim()
    ) {
      return {
        type: "email",
        value: normalizeEmail(value[key])
      };
    }
  }

  for (const key of Object.keys(value)) {
    const found =
      findVerifiedIdentifier(
        value[key]
      );

    if (found) return found;
  }

  return null;
}

/* -------------------------------------------------------
   OTP LOGIN / REGISTER
------------------------------------------------------- */

app.post(
  "/api/auth/otp",
  authLimiter,
  async (req, res) => {
    try {
      const accessToken =
        String(
          req.body?.accessToken || ""
        ).trim();

      if (!accessToken) {
        return res.status(400).json({
          error: "MSG91 access token required"
        });
      }

      const verified =
        await verifyMSG91AccessToken(
          accessToken
        );

      let user;

      if (verified.type === "phone") {
        user = db.users.find(
          u =>
            u.phone === verified.value
        );
      }

      if (verified.type === "email") {
        user = db.users.find(
          u =>
            u.email === verified.value
        );
      }

      if (!user) {
        user = {
          id: db.next.user++,
          user_code: userCode(),
          phone:
            verified.type === "phone"
              ? verified.value
              : null,
          email:
            verified.type === "email"
              ? verified.value
              : null,

          /*
            Virtual credits only.
            No cash value.
          */
          balance: 1000,

          created_at: now()
        };

        db.users.push(user);
        save();
      }

      const token =
        createUserToken(user);

      return res.json({
        token,
        user: publicUser(user)
      });
    } catch (error) {
      console.error(
        "MSG91 OTP verification:",
        error.message
      );

      return res.status(401).json({
        error:
          "OTP verification failed"
      });
    }
  }
);

/* -------------------------------------------------------
   CURRENT USER
------------------------------------------------------- */

app.get(
  "/api/me",
  requireUser,
  (req, res) => {
    res.json(
      publicUser(req.user)
    );
  }
);

/* -------------------------------------------------------
   GAME
------------------------------------------------------- */

function currentPeriod(mode) {
  return String(
    Math.floor(
      Date.now() / 1000 / MODES[mode]
    )
  );
}

function getColor(number) {
  if (
    number === 0 ||
    number === 5
  ) {
    return "Violet";
  }

  if (
    [1, 3, 7, 9].includes(number)
  ) {
    return "Green";
  }

  return "Red";
}

function getSize(number) {
  return number >= 5
    ? "Big"
    : "Small";
}

function calculatePayout(
  bet,
  result
) {
  let multiplier = 0;

  if (
    bet.bet_type === "color" &&
    bet.selection === result.color
  ) {
    multiplier =
      result.color === "Violet"
        ? 4.5
        : 2;
  }

  if (
    bet.bet_type === "number" &&
    Number(bet.selection) ===
      result.number
  ) {
    multiplier = 9;
  }

  if (
    bet.bet_type === "size" &&
    bet.selection === result.size
  ) {
    multiplier = 2;
  }

  return multiplier > 0
    ? Math.floor(
        bet.amount * multiplier
      )
    : 0;
}

function settleRound(
  mode,
  period
) {
  const existing =
    db.rounds.find(
      r =>
        r.mode === mode &&
        r.period === period
    );

  if (existing) {
    return existing;
  }

  const number =
    Math.floor(Math.random() * 10);

  const result = {
    id: db.next.round++,
    mode,
    period,
    number,
    color: getColor(number),
    size: getSize(number),
    created_at: now()
  };

  db.rounds.push(result);

  const pending =
    db.bets.filter(
      b =>
        b.mode === mode &&
        b.period === period &&
        b.status === "pending"
    );

  for (const bet of pending) {
    const payout =
      calculatePayout(
        bet,
        result
      );

    bet.status =
      payout > 0
        ? "won"
        : "lost";

    bet.payout = payout;

    if (payout > 0) {
      const user =
        findUser(bet.user_id);

      if (user) {
        user.balance += payout;
      }
    }
  }

  save();

  return result;
}

app.get(
  "/api/game/:mode",
  requireUser,
  (req, res) => {
    const mode =
      req.params.mode;

    if (!MODES[mode]) {
      return res.status(400).json({
        error: "Invalid game mode"
      });
    }

    const duration =
      MODES[mode];

    const period =
      currentPeriod(mode);

    const elapsed =
      Math.floor(
        Date.now() / 1000
      ) % duration;

    const secondsLeft =
      duration - elapsed;

    /*
      Settle the previous period.
    */
    settleRound(
      mode,
      String(
        Number(period) - 1
      )
    );

    const history =
      db.rounds
        .filter(
          r => r.mode === mode
        )
        .sort(
          (a, b) => b.id - a.id
        )
        .slice(0, 20);

    res.json({
      mode,
      period,
      secondsLeft,
      history
    });
  }
);

/* -------------------------------------------------------
   PLACE VIRTUAL BET
------------------------------------------------------- */

app.post(
  "/api/bet",
  requireUser,
  (req, res) => {
    const {
      mode,
      betType,
      selection,
      amount
    } = req.body || {};

    if (!MODES[mode]) {
      return res.status(400).json({
        error: "Invalid game mode"
      });
    }

    if (
      ![
        "color",
        "number",
        "size"
      ].includes(betType)
    ) {
      return res.status(400).json({
        error: "Invalid bet type"
      });
    }

    if (
      !Number.isInteger(amount) ||
      !BET_AMOUNTS.includes(amount)
    ) {
      return res.status(400).json({
        error:
          "Invalid virtual bet amount"
      });
    }

    let allowed;

    if (betType === "color") {
      allowed = [
        "Green",
        "Red",
        "Violet"
      ];
    } else if (
      betType === "size"
    ) {
      allowed = [
        "Big",
        "Small"
      ];
    } else {
      allowed = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9"
      ];
    }

    if (
      !allowed.includes(
        String(selection)
      )
    ) {
      return res.status(400).json({
        error: "Invalid selection"
      });
    }

    const user =
      req.user;

    if (
      user.balance < amount
    ) {
      return res.status(400).json({
        error:
          "Insufficient virtual balance"
      });
    }

    const period =
      currentPeriod(mode);

    /*
      Prevent betting after the round is
      effectively over.
    */
    const elapsed =
      Math.floor(
        Date.now() / 1000
      ) % MODES[mode];

    if (
      elapsed >=
      MODES[mode]
    ) {
      return res.status(400).json({
        error: "Round closed"
      });
    }

    user.balance -= amount;

    const bet = {
      id: db.next.bet++,
      user_id: user.id,
      mode,
      period,
      bet_type: betType,
      selection:
        String(selection),
      amount,
      status: "pending",
      payout: 0,
      created_at: now()
    };

    db.bets.push(bet);

    save();

    res.json({
      bet: {
        id: bet.id,
        mode: bet.mode,
        period: bet.period,
        betType: bet.bet_type,
        selection: bet.selection,
        amount: bet.amount,
        status: bet.status
      },
      user: publicUser(user)
    });
  }
);

/* -------------------------------------------------------
   USER BET HISTORY
------------------------------------------------------- */

app.get(
  "/api/bets",
  requireUser,
  (req, res) => {
    res.json(
      db.bets
        .filter(
          b =>
            b.user_id ===
            req.user.id
        )
        .sort(
          (a, b) => b.id - a.id
        )
        .slice(0, 100)
    );
  }
);

/* -------------------------------------------------------
   DEMO DEPOSIT
------------------------------------------------------- */

app.post(
  "/api/deposit-request",
  requireUser,
  (req, res) => {
    const {
      amount,
      reference
    } = req.body || {};

    if (
      !Number.isInteger(amount) ||
      !BET_AMOUNTS.includes(amount)
    ) {
      return res.status(400).json({
        error:
          "Invalid demo amount"
      });
    }

    if (
      !String(reference || "")
        .trim()
    ) {
      return res.status(400).json({
        error:
          "Demo reference required"
      });
    }

    const request = {
      id:
        db.next.request++,
      user_id:
        req.user.id,
      type:
        "deposit",
      amount,
      reference:
        String(reference)
          .trim()
          .slice(0, 100),
      status:
        "Pending",
      created_at:
        now()
    };

    db.requests.push(
      request
    );

    save();

    res.json({
      id: request.id,
      status:
        request.status
    });
  }
);

/* -------------------------------------------------------
   DEMO WITHDRAWAL
------------------------------------------------------- */

app.post(
  "/api/withdraw-request",
  requireUser,
  (req, res) => {
    const {
      amount,
      bankName,
      accountNumber,
      ifsc,
      upiId
    } = req.body || {};

    if (
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        error:
          "Invalid virtual amount"
      });
    }

    if (
      req.user.balance <
      amount
    ) {
      return res.status(400).json({
        error:
          "Insufficient virtual balance"
      });
    }

    /*
      This is only a virtual demo request.
      No bank/UPI transfer occurs.
    */

    req.user.balance -= amount;

    const request = {
      id:
        db.next.request++,
      user_id:
        req.user.id,
      type:
        "withdrawal",
      amount,

      bank_name:
        String(
          bankName || ""
        ).slice(0, 100),

      account_number:
        String(
          accountNumber || ""
        ).slice(-4),

      ifsc:
        String(
          ifsc || ""
        ).slice(0, 20),

      upi_id:
        String(
          upiId || ""
        ).slice(0, 100),

      status:
        "Pending",

      created_at:
        now()
    };

    db.requests.push(
      request
    );

    save();

    res.json({
      id:
        request.id,
      status:
        request.status,
      user:
        publicUser(
          req.user
        )
    });
  }
);

/* -------------------------------------------------------
   USER REQUEST HISTORY
------------------------------------------------------- */

app.get(
  "/api/requests",
  requireUser,
  (req, res) => {
    res.json(
      db.requests
        .filter(
          r =>
            r.user_id ===
            req.user.id
        )
        .sort(
          (a, b) => b.id - a.id
        )
    );
  }
);

/* -------------------------------------------------------
   GIFTS
------------------------------------------------------- */

app.post(
  "/api/gift/redeem",
  requireUser,
  (req, res) => {
    const code =
      String(
        req.body?.code || ""
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
          "Invalid or inactive gift code"
      });
    }

    const claimed =
      db.giftClaims.some(
        c =>
          c.gift_id ===
            gift.id &&
          c.user_id ===
            req.user.id
      );

    if (claimed) {
      return res.status(400).json({
        error:
          "Gift code already claimed"
      });
    }

    db.giftClaims.push({
      id:
        db.next.claim++,
      gift_id:
        gift.id,
      user_id:
        req.user.id,
      claimed_at:
        now()
    });

    req.user.balance +=
      gift.amount;

    save();

    res.json({
      message:
        "Successfully received",
      amount:
        gift.amount,
      user:
        publicUser(
          req.user
        )
    });
  }
);

app.get(
  "/api/gift/history",
  requireUser,
  (req, res) => {
    const history =
      db.giftClaims
        .filter(
          c =>
            c.user_id ===
            req.user.id
        )
        .sort(
          (a, b) => b.id - a.id
        )
        .map(c => {
          const gift =
            db.gifts.find(
              g =>
                g.id ===
                c.gift_id
            );

          return {
            code:
              gift?.code || "",
            amount:
              gift?.amount || 0,
            claimed_at:
              c.claimed_at
          };
        });

    res.json(history);
  }
);

/* -------------------------------------------------------
   ADMIN LOGIN
------------------------------------------------------- */

app.post(
  "/api/admin/login",
  authLimiter,
  (req, res) => {
    const {
      username,
      password
    } = req.body || {};

    if (
      username !==
        ADMIN_USER ||
      password !==
        ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        error:
          "Invalid admin credentials"
      });
    }

    const token =
      createAdminToken();

    res.json({
      token
    });
  }
);

/* -------------------------------------------------------
   ADMIN OVERVIEW
------------------------------------------------------- */

app.get(
  "/api/admin/overview",
  requireAdmin,
  (req, res) => {
    const approvedDeposits =
      db.requests
        .filter(
          r =>
            r.type ===
              "deposit" &&
            r.status ===
              "Approved"
        )
        .reduce(
          (sum, r) =>
            sum + r.amount,
          0
        );

    const approvedWithdrawals =
      db.requests
        .filter(
          r =>
            r.type ===
              "withdrawal" &&
            r.status ===
              "Approved"
        )
        .reduce(
          (sum, r) =>
            sum + r.amount,
          0
        );

    res.json({
      users:
        db.users.length,
      pending:
        db.requests.filter(
          r =>
            r.status ===
            "Pending"
        ).length,
      deposits:
        approvedDeposits,
      withdrawals:
        approvedWithdrawals,
      profit:
        approvedDeposits -
        approvedWithdrawals
    });
  }
);

/* -------------------------------------------------------
   ADMIN USERS
------------------------------------------------------- */

app.get(
  "/api/admin/users",
  requireAdmin,
  (req, res) => {
    res.json(
      db.users
        .slice()
        .sort(
          (a, b) =>
            b.id - a.id
        )
        .map(
          publicUser
        )
    );
  }
);

/* -------------------------------------------------------
   ADMIN REQUESTS
------------------------------------------------------- */

app.get(
  "/api/admin/requests",
  requireAdmin,
  (req, res) => {
    const result =
      db.requests
        .slice()
        .sort(
          (a, b) =>
            b.id - a.id
        )
        .map(r => {
          const user =
            findUser(
              r.user_id
            );

          return {
            ...r,
            user_code:
              user?.user_code ||
              "",
            phone:
              user?.phone ||
              "",
            email:
              user?.email ||
              ""
          };
        });

    res.json(result);
  }
);

/* -------------------------------------------------------
   ADMIN APPROVE / REJECT
------------------------------------------------------- */

app.post(
  "/api/admin/request/:id",
  requireAdmin,
  (req, res) => {
    const {
      action
    } = req.body || {};

    if (
      ![
        "Approve",
        "Reject"
      ].includes(action)
    ) {
      return res.status(400).json({
        error:
          "Invalid action"
      });
    }

    const request =
      db.requests.find(
        r =>
          r.id ===
          Number(
            req.params.id
          )
      );

    if (
      !request ||
      request.status !==
        "Pending"
    ) {
      return res.status(400).json({
        error:
          "Invalid or already processed request"
      });
    }

    const user =
      findUser(
        request.user_id
      );

    if (!user) {
      return res.status(404).json({
        error:
          "User not found"
      });
    }

    if (
      action ===
        "Approve" &&
      request.type ===
        "deposit"
    ) {
      user.balance +=
        request.amount;
    }

    if (
      action ===
        "Reject" &&
      request.type ===
        "withdrawal"
    ) {
      user.balance +=
        request.amount;
    }

    request.status =
      action ===
        "Approve"
        ? "Approved"
        : "Rejected";

    request.processed_at =
      now();

    save();

    res.json({
      ok: true,
      status:
        request.status
    });
  }
);

/* -------------------------------------------------------
   ADMIN GIFTS
------------------------------------------------------- */

app.get(
  "/api/admin/gifts",
  requireAdmin,
  (req, res) => {
    res.json(
      db.gifts.map(
        gift => ({
          ...gift,
          claims:
            db.giftClaims.filter(
              c =>
                c.gift_id ===
                gift.id
            ).length
        })
      )
    );
  }
);

app.post(
  "/api/admin/gifts",
  requireAdmin,
  (req, res) => {
    const code =
      String(
        req.body?.code || ""
      )
        .trim()
        .toUpperCase();

    const amount =
      Number(
        req.body?.amount
      );

    if (
      !code ||
      !Number.isInteger(
        amount
      ) ||
      amount <= 0
    ) {
      return res.status(400).json({
        error:
          "Invalid gift"
      });
    }

    if (
      db.gifts.some(
        g =>
          g.code === code
      )
    ) {
      return res.status(400).json({
        error:
          "Gift code already exists"
      });
    }

    const gift = {
      id:
        db.next.gift++,
      code,
      amount,
      active: 1,
      created_at:
        now()
    };

    db.gifts.push(
      gift
    );

    save();

    res.json({
      ok: true,
      gift
    });
  }
);

/* -------------------------------------------------------
   ADMIN NOTICE
------------------------------------------------------- */

app.get(
  "/api/notice",
  (req, res) => {
    res.json({
      notice:
        db.settings.notice
    });
  }
);

app.post(
  "/api/admin/notice",
  requireAdmin,
  (req, res) => {
    const notice =
      String(
        req.body?.notice || ""
      )
        .trim()
        .slice(0, 500);

    if (!notice) {
      return res.status(400).json({
        error:
          "Notice cannot be empty"
      });
    }

    db.settings.notice =
      notice;

    save();

    res.json({
      ok: true,
      notice
    });
  }
);

/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "ColorWin",
      time:
        now()
    });
  }
);

/* -------------------------------------------------------
   FRONTEND FALLBACK
------------------------------------------------------- */

app.get(
  "/{*splat}",
  (req, res) => {
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );
  }
);

/* -------------------------------------------------------
   ERROR HANDLER
------------------------------------------------------- */

app.use(
  (err, req, res, next) => {
    console.error(
      "Server error:",
      err
    );

    if (
      res.headersSent
    ) {
      return next(err);
    }

    res.status(500).json({
      error:
        "Internal server error"
    });
  }
);

app.listen(
  PORT,
  () => {
    console.log(
      `ColorWin server running on port ${PORT}`
    );
  }
);
