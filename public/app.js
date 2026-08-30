const KEY = "colorwin_complete_v3";

const MODES = {
  30: "Win Go 30s",
  60: "Win Go 1Min",
  180: "Win Go 3Min",
  300: "Win Go 5Min"
};

const ADMIN = {
  u: "admin",
  p: "admin-demo-only"
};

const fresh = () => ({
  user: null,
  users: {},
  giftCodes: {
    GIFT50: 50
  },
  transactions: [],
  rounds: {},
  otp: null,
  settings: {
    notice: "Welcome to ColorWin Entertainment Demo!"
  }
});

let state =
  JSON.parse(localStorage.getItem(KEY) || "null") || fresh();

const save = () =>
  localStorage.setItem(KEY, JSON.stringify(state));

const U = () => state.users[state.user];

const esc = x =>
  String(x ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m])
  );

function toast(t) {
  let d = document.createElement("div");
  d.className = "toast";
  d.textContent = t;
  document.body.appendChild(d);

  setTimeout(() => d.remove(), 2200);
}

function go(p) {
  history.pushState({}, "", p);
  render();
}

window.onpopstate = render;

function render() {
  if (location.pathname === "/admin-login") {
    return adminLogin();
  }

  if (location.pathname === "/admin") {
    return sessionStorage.cwadmin === "1"
      ? admin()
      : adminLogin();
  }

  if (!state.user) {
    return auth();
  }

  dashboard();
}

function auth() {
  document.getElementById("app").innerHTML = `
    <div class="auth">
      <div class="top">
        <div class="brand">ColorWin</div>
        <div class="sub">
          Entertainment simulator • virtual points only
        </div>
      </div>

      <div class="card">
        <div class="tabs">
          <button id="pt" class="tab active">
            Log in with phone
          </button>

          <button id="et" class="tab">
            Email login
          </button>
        </div>

        <div id="authbox"></div>
      </div>
    </div>
  `;

  let kind = "phone";
  let reg = false;

  function draw() {
    const authbox = document.getElementById("authbox");

    authbox.innerHTML = reg
      ? `
        <label>Phone / Email</label>
        <input
          id="rid"
          class="input"
          placeholder="Phone number or email"
        >

        <label>Set password</label>

        <div class="row">
          <input
            id="rp"
            class="input"
            type="password"
          >

          <button id="rshow" class="btn secondary">
            Show
          </button>
        </div>

        <label>Confirm password</label>

        <input
          id="rp2"
          class="input"
          type="password"
        >

        <label>SMS verification code</label>

        <div class="row">
          <input
            id="otp"
            class="input"
            placeholder="123456"
          >

          <button id="send" class="btn secondary">
            Send
          </button>
        </div>

        <label>Invite code (optional)</label>

        <input
          id="inv"
          class="input"
          placeholder="Optional"
        >

        <p class="small">
          By continuing you agree to the demo Privacy Agreement.
        </p>

        <button id="register" class="btn primary">
          Create account
        </button>

        <p class="small" style="margin-top:12px">
          Already registered?
          <button id="back" class="link">
            Log in
          </button>
        </p>
      `
      : `
        ${
          kind === "phone"
            ? `
              <label>Phone number</label>
              <input
                id="lid"
                class="input"
                placeholder="+91 phone number"
              >
            `
            : `
              <label>Email</label>
              <input
                id="lid"
                class="input"
                type="email"
                placeholder="email@example.com"
              >
            `
        }

        <label>Password</label>

        <div class="row">
          <input
            id="lp"
            class="input"
            type="password"
          >

          <button id="show" class="btn secondary">
            Show
          </button>
        </div>

        <div
          class="row"
          style="margin:10px 0"
        >
          <span class="small">
            ☐ Remember password
          </span>

          <button id="forgot" class="link">
            Forgot password?
          </button>
        </div>

        <button id="login" class="btn primary">
          Log in
        </button>

        <button
          id="reg"
          class="btn outline"
          style="margin-top:8px"
        >
          Register
        </button>

        <p
          class="small"
          style="margin-top:12px"
        >
          Demo OTP: <b>123456</b>
          (no SMS is sent)
        </p>
      `;
  }

  draw();

  document.getElementById("pt").onclick = () => {
    kind = "phone";
    document.getElementById("pt").classList.add("active");
    document.getElementById("et").classList.remove("active");
    draw();
  };

  document.getElementById("et").onclick = () => {
    kind = "email";
    document.getElementById("et").classList.add("active");
    document.getElementById("pt").classList.remove("active");
    draw();
  };

  document.getElementById("authbox").onclick = e => {
    if (e.target.id === "show" || e.target.id === "rshow") {
      const input =
        e.target.id === "show"
          ? document.getElementById("lp")
          : document.getElementById("rp");

      input.type =
        input.type === "password"
          ? "text"
          : "password";

      e.target.textContent =
        input.type === "password"
          ? "Show"
          : "Hide";
    }

    if (e.target.id === "reg") {
      reg = true;
      draw();
    }

    if (e.target.id === "back") {
      reg = false;
      draw();
    }

    if (e.target.id === "forgot") {
      toast("Demo only: use your saved password");
    }

    if (e.target.id === "send") {
      state.otp = "123456";
      save();
      toast("Demo OTP: 123456");
    }

    if (e.target.id === "login") {
      const id = document
        .getElementById("lid")
        .value.trim()
        .toLowerCase();

      const p =
        document.getElementById("lp").value;

      if (!id || !p) {
        return toast("Enter login details");
      }

      if (!state.users[id]) {
        return toast(
          "Account not found — register first"
        );
      }

      if (state.users[id].password !== p) {
        return toast("Incorrect password");
      }

      state.user = id;
      save();
      render();
    }

    if (e.target.id === "register") {
      const id = document
        .getElementById("rid")
        .value.trim()
        .toLowerCase();

      const p =
        document.getElementById("rp").value;

      const p2 =
        document.getElementById("rp2").value;

      const otp =
        document.getElementById("otp").value;

      const inv =
        document.getElementById("inv").value.trim();

      if (!id || !p || p !== p2) {
        return toast("Check registration fields");
      }

      if (otp !== "123456") {
        return toast("Use demo OTP 123456");
      }

      if (state.users[id]) {
        return toast("Account already exists");
      }

      state.users[id] = {
        id,
        password: p,
        balance: 1000,
        history: [],
        joined: new Date().toLocaleString(),
        invite: inv
      };

      state.user = id;

      save();

      toast(
        "Account created with 1,000 virtual points"
      );

      setTimeout(render, 300);
    }
  };
}

function initRounds() {
  for (let k in MODES) {
    if (!state.rounds[k]) {
      state.rounds[k] = {
        ends: Date.now() + Number(k) * 1000,
        period: 1,
        history: []
      };
    }
  }
}

function dashboard() {
  initRounds();
  save();

  const u = U();

  document.getElementById("app").innerHTML = `
    <div class="shell">

      <div class="top">
        <div class="toprow">

          <div>
            <div class="brand">
              ColorWin
            </div>

            <div class="sub">
              ${esc(u.id)}
            </div>
          </div>

          <button
            class="iconbtn"
            id="bell"
          >
            🔔
          </button>

        </div>
      </div>

      <div class="card">
        <div class="banner">
          <b>
            ${esc(state.settings.notice)}
          </b>

          <p>
            Play responsibly — this is a
            virtual entertainment simulator.
          </p>
        </div>
      </div>

      <div class="card">
        <div class="balance">

          <div class="muted">
            Virtual Wallet
          </div>

          <div class="amount">
            ₹${u.balance.toFixed(2)}
          </div>

          <div class="row">
            <button
              id="dep"
              class="btn outline"
            >
              Deposit
            </button>

            <button
              id="with"
              class="btn primary"
            >
              Withdraw
            </button>
          </div>

        </div>
      </div>

      <div class="card">
        <div class="quick">

          <button data-page="gift">
            🎁 Gift
          </button>

          <button data-page="wallet">
            💳 Wallet
          </button>

          <button data-page="profile">
            👤 Profile
          </button>

          <button data-page="help">
            ❓ Help
          </button>

        </div>
      </div>

      <div class="card">

        <div class="section-title">
          <h3>Game Modes</h3>
        </div>

        <div class="modebar">
          ${Object.entries(MODES)
            .map(
              ([k, v]) => `
                <button
                  class="mode ${
                    Number(k) ===
                    (window.cwmode || 60)
                      ? "active"
                      : ""
                  }"
                  data-mode="${k}"
                >
                  ${v}
                </button>
              `
            )
            .join("")}
        </div>

        <div id="game"></div>

      </div>

      <nav class="bottom">

        ${[
          "game",
          "gift",
          "wallet",
          "profile",
          "help"
        ]
          .map(
            (p, i) => `
              <button
                data-page="${p}"
                class="${
                  p === "game"
                    ? "active"
                    : ""
                }"
              >
                ${
                  ["🎮", "🎁", "💳", "👤", "❓"][i]
                }
                <br>
                ${
                  p[0].toUpperCase() +
                  p.slice(1)
                }
              </button>
            `
          )
          .join("")}

      </nav>

    </div>
  `;

  renderGame();

  document
    .querySelectorAll("[data-mode]")
    .forEach(b => {
      b.onclick = () => {
        window.cwmode =
          Number(b.dataset.mode);

        renderGame();
      };
    });

  document
    .querySelectorAll("[data-page]")
    .forEach(b => {
      b.onclick = () =>
        page(b.dataset.page);
    });

  document.getElementById("dep").onclick =
    () => page("deposit");

  // FIX: "with" is a reserved JavaScript keyword.
  const withBtn =
    document.getElementById("with");

  withBtn.onclick =
    () => page("withdraw");

  document.getElementById("bell").onclick =
    () => toast(state.settings.notice);
}

function renderGame() {
  const k = window.cwmode || 60;
  const r = state.rounds[k];

  if (!r) return;

  const s = Math.max(
    0,
    Math.ceil(
      (r.ends - Date.now()) / 1000
    )
  );

  const game =
    document.getElementById("game");

  if (!game) return;

  game.innerHTML = `
    <div class="timer">

      <div>
        Time remaining
      </div>

      <div class="time">
        ${String(Math.floor(s / 60)).padStart(
          2,
          "0"
        )}:${String(s % 60).padStart(2, "0")}
      </div>

      <div class="period">
        Period ${r.period}
      </div>

    </div>

    <div class="card">

      <div class="betgrid">

        <button
          class="bet green"
          data-bet="green"
        >
          Green 2×
        </button>

        <button
          class="bet violet"
          data-bet="violet"
        >
          Violet 4.5×
        </button>

        <button
          class="bet red"
          data-bet="red"
        >
          Red 2×
        </button>

      </div>

      <h4>Number</h4>

      <div class="numbergrid">

        ${[0,1,2,3,4,5,6,7,8,9]
          .map(
            n => `
              <button
                class="num
                ${
                  [0,2,4,6,8].includes(n)
                    ? "redn"
                    : ""
                }
                ${
                  [0,5].includes(n)
                    ? "violetn"
                    : ""
                }"
                data-bet="n${n}"
              >
                ${n}
              </button>
            `
          )
          .join("")}

      </div>

      <h4>Size</h4>

      <div class="sizegrid">

        <button
          class="bet big"
          data-bet="big"
        >
          Big 2×
        </button>

        <button
          class="bet smallb"
          data-bet="small"
        >
          Small 2×
        </button>

      </div>

      <p class="small">
        Virtual points only.
        Each prediction uses 10 points.
      </p>

    </div>

    <div class="card">

      <div class="section-title">
        <h3>History</h3>
      </div>

      <table class="history">

        <tr>
          <th>Period</th>
          <th>Number</th>
          <th>Size</th>
          <th>Color</th>
        </tr>

        ${r.history
          .slice(-10)
          .reverse()
          .map(
            x => `
              <tr>
                <td>${x.period}</td>
                <td>${x.number}</td>
                <td>${x.size}</td>
                <td>${x.color}</td>
              </tr>
            `
          )
          .join("")}

      </table>

    </div>
  `;

  document
    .querySelectorAll("[data-bet]")
    .forEach(b => {
      b.onclick = () =>
        bet(b.dataset.bet);
    });
}

function tick() {
  if (!state.user) return;

  const k = window.cwmode || 60;
  const r = state.rounds[k];

  if (!r) return;

  if (Date.now() >= r.ends) {
    const n =
      Math.floor(Math.random() * 10);

    let color =
      [0,2,4,6,8].includes(n)
        ? "Red"
        : "Green";

    if (n === 0 || n === 5) {
      color = "Violet";
    }

    r.history.push({
      period: r.period,
      number: n,
      size: n >= 5
        ? "Big"
        : "Small",
      color
    });

    r.period++;

    r.ends =
      Date.now() +
      Number(k) * 1000;

    save();

    renderGame();

  } else {
    const el =
      document.querySelector(".time");

    if (el) {
      const s = Math.ceil(
        (r.ends - Date.now()) / 1000
      );

      el.textContent =
        `${String(
          Math.floor(s / 60)
        ).padStart(2, "0")}:${String(
          s % 60
        ).padStart(2, "0")}`;
    }
  }
}

setInterval(tick, 500);

function bet(t) {
  if (U().balance < 10) {
    return toast(
      "Not enough virtual points"
    );
  }

  U().balance -= 10;

  U().history.push({
    type: "prediction",
    amount: 10,
    bet: t,
    time: new Date().toLocaleString()
  });

  save();

  toast("Prediction placed");
}

function page(p) {
  const g =
    document.getElementById("game");

  if (!g) return;

  if (p === "game") {
    renderGame();
    return;
  }

  if (p === "gift") {
    g.innerHTML = gift();
    bindGift();
    return;
  }

  if (p === "wallet") {
    g.innerHTML = wallet();
    return;
  }

  if (p === "deposit") {
    g.innerHTML = deposit();
    bindDep();
    return;
  }

  if (p === "withdraw") {
    g.innerHTML = withdraw();
    bindWith();
    return;
  }

  if (p === "profile") {
    g.innerHTML = profile();
    return;
  }

  if (p === "help") {
    g.innerHTML = help();
    return;
  }
}

function gift() {
  return `
    <div class="card">

      <h2>🎁 Gift Center</h2>

      <div class="notice">
        Rewards are virtual and have
        no cash value.
      </div>

      <label>Gift code</label>

      <input
        id="gc"
        class="input"
        placeholder="Please enter gift code"
      >

      <label>Verification code</label>

      <div class="row">

        <input
          id="gv"
          class="input"
          placeholder="4 digits"
        >

        <button
          id="vc"
          class="btn secondary"
        >
          4827
        </button>

      </div>

      <button
        id="receive"
        class="btn primary"
        style="margin-top:10px"
      >
        Receive
      </button>

      <h3>Social</h3>

      <div class="social">
        <a
          href="https://t.me"
          target="_blank"
        >
          ✈️ Telegram
        </a>

        <a
          href="https://wa.me"
          target="_blank"
        >
          💬 WhatsApp
        </a>
      </div>

      <h3>Claim History</h3>

      ${
        U().history
          .filter(x => x.type === "gift")
          .slice()
          .reverse()
          .map(
            x => `
              <p>
                <span class="pill">
                  Successfully received
                </span>
                <br>
                ${esc(x.time)}
                • +₹${x.amount}
              </p>
            `
          )
          .join("") ||
        '<p class="small">No claims yet.</p>'
      }

    </div>
  `;
}

function bindGift() {
  document.getElementById("vc").onclick =
    () => {
      document.getElementById("vc").textContent =
        Math.floor(
          1000 + Math.random() * 9000
        );
    };

  document.getElementById("receive").onclick =
    () => {
      const c =
        document
          .getElementById("gc")
          .value
          .trim()
          .toUpperCase();

      const verification =
        document
          .getElementById("gv")
          .value;

      const vc =
        document.getElementById("vc");

      if (verification !== vc.textContent) {
        return toast(
          "Invalid verification code"
        );
      }

      if (!state.giftCodes[c]) {
        return toast("Invalid gift code");
      }

      if (
        U().history.some(
          x =>
            x.type === "gift" &&
            x.code === c
        )
      ) {
        return toast("Already claimed");
      }

      const a =
        state.giftCodes[c];

      U().balance += a;

      U().history.push({
        type: "gift",
        code: c,
        amount: a,
        time: new Date().toLocaleString()
      });

      save();

      toast("Successfully received");

      page("gift");
    };
}

function wallet() {
  return `
    <div class="card">

      <h2>Wallet</h2>

      <div class="balance">

        <div class="muted">
          Virtual balance
        </div>

        <div class="amount">
          ₹${U().balance.toFixed(2)}
        </div>

      </div>

      <h3>Ledger</h3>

      ${
        U().history
          .slice()
          .reverse()
          .map(
            x => `
              <div class="adminrow">

                <b>
                  ${esc(x.type)}
                </b>

                <br>

                <span class="small">
                  ${esc(x.time)}
                </span>

                ${
                  x.amount
                    ? ` • ₹${x.amount}`
                    : ""
                }

              </div>
            `
          )
          .join("") ||
        '<p class="small">No activity.</p>'
      }

    </div>
  `;
}

function deposit() {
  return `
    <div class="card">

      <h2>Demo Deposit</h2>

      <div class="notice danger-note">
        This is a simulation.
        No real UPI payment is initiated
        or accepted.
      </div>

      <p>
        <b>Demo UPI reference:</b>
        9608890478-2@nyes
      </p>

      <div class="row">

        <button
          class="btn secondary amt"
          data-a="100"
        >
          ₹100
        </button>

        <button
          class="btn secondary amt"
          data-a="500"
        >
          ₹500
        </button>

        <button
          class="btn secondary amt"
          data-a="1000"
        >
          ₹1,000
        </button>

      </div>

      <label>
        Demo UTR / Reference
      </label>

      <input
        id="utr"
        class="input"
        placeholder="DEMO123456789"
      >

      <button
        id="sd"
        class="btn primary"
        style="margin-top:10px"
      >
        Submit Demo Request
      </button>

    </div>
  `;
}

function bindDep() {
  document
    .querySelectorAll(".amt")
    .forEach(b => {
      b.onclick = () => {
        document.getElementById("utr")
          .dataset.a = b.dataset.a;
      };
    });

  document.getElementById("sd").onclick =
    () => {
      const utr =
        document.getElementById("utr");

      const a =
        Number(utr.dataset.a || 0);

      if (!a || !utr.value.trim()) {
        return toast(
          "Choose amount and reference"
        );
      }

      state.transactions.push({
        kind: "deposit",
        user: state.user,
        amount: a,
        utr: utr.value.trim(),
        status: "Pending",
        time: new Date().toLocaleString()
      });

      save();

      toast(
        "Pending demo request created"
      );

      page("wallet");
    };
}

function withdraw() {
  return `
    <div class="card">

      <h2>Demo Withdrawal</h2>

      <div class="notice danger-note">
        No cash is transferred.
        This creates an admin-only
        simulation request.
      </div>

      <label>Bank Name</label>
      <input
        id="bank"
        class="input"
      >

      <label>Account Number</label>
      <input
        id="acct"
        class="input"
      >

      <label>IFSC</label>
      <input
        id="ifsc"
        class="input"
      >

      <label>UPI ID</label>
      <input
        id="upi"
        class="input"
      >

      <label>Virtual amount</label>
      <input
        id="wa"
        class="input"
        type="number"
      >

      <button
        id="sw"
        class="btn primary"
        style="margin-top:10px"
      >
        Submit Demo Request
      </button>

    </div>
  `;
}

function bindWith() {
  document.getElementById("sw").onclick =
    () => {
      const a =
        Number(
          document.getElementById("wa").value
        );

      if (!a || a <= 0) {
        return toast("Enter amount");
      }

      state.transactions.push({
        kind: "withdrawal",
        user: state.user,
        amount: a,
        bank:
          document.getElementById("bank").value,
        acct:
          document.getElementById("acct").value,
        ifsc:
          document.getElementById("ifsc").value,
        upi:
          document.getElementById("upi").value,
        status: "Pending",
        time: new Date().toLocaleString()
      });

      save();

      toast(
        "Pending demo request created"
      );

      page("wallet");
    };
}

function profile() {
  return `
    <div class="card">

      <h2>Profile</h2>

      <p>
        <b>User ID:</b>
        ${esc(state.user)}
      </p>

      <p>
        <b>Joined:</b>
        ${esc(U().joined)}
      </p>

      <label>
        Invite / Referral code
      </label>

      <div class="row">

        <input
          id="ref"
          class="input"
          value="${esc(state.user)}"
          readonly
        >

        <button
          id="copyref"
          class="btn secondary"
        >
          Copy
        </button>

      </div>

      <h3>Settings</h3>

      <button
        class="btn outline"
        id="privacy"
      >
        Privacy Agreement
      </button>

      <button
        class="btn outline"
        style="margin-top:8px"
        id="about"
      >
        About ColorWin
      </button>

      <button
        class="btn danger"
        style="margin-top:8px"
        id="logout"
      >
        Log out
      </button>

    </div>
  `;
}

function help() {
  return `
    <div class="card">

      <h2>Help & Support</h2>

      <div class="notice">
        This application is a
        virtual-credit entertainment demo.
        No real money is processed.
      </div>

      <h3>How it works</h3>

      <p class="small">
        Create a demo account, receive
        virtual points, select a game mode,
        and place virtual predictions.
        Rounds generate simulated results
        automatically.
      </p>

      <h3>Community</h3>

      <div class="social">

        <a
          href="https://t.me"
          target="_blank"
        >
          Telegram
        </a>

        <a
          href="https://wa.me"
          target="_blank"
        >
          WhatsApp
        </a>

      </div>

    </div>
  `;
}

document.addEventListener("click", e => {
  if (e.target.id === "logout") {
    state.user = null;
    save();
    render();
  }

  if (e.target.id === "copyref") {
    navigator.clipboard?.writeText(
      state.user
    );

    toast("Referral copied");
  }

  if (e.target.id === "privacy") {
    toast("Demo Privacy Agreement");
  }

  if (e.target.id === "about") {
    toast("ColorWin virtual entertainment demo");
  }
});

function adminLogin() {
  document.getElementById("app").innerHTML = `
    <div class="auth">

      <div class="top">
        <div class="brand">
          ColorWin Admin
        </div>

        <div class="sub">
          Private demo control center
        </div>
      </div>

      <div class="card">

        <label>Username</label>

        <input
          id="au"
          class="input"
        >

        <label>Password</label>

        <input
          id="ap"
          class="input"
          type="password"
        >

        <button
          id="ag"
          class="btn primary"
          style="margin-top:10px"
        >
          Login
        </button>

        <p class="small">
          Demo:
          admin / admin-demo-only
        </p>

      </div>

    </div>
  `;

  document.getElementById("ag").onclick =
    () => {
      const username =
        document.getElementById("au").value;

      const password =
        document.getElementById("ap").value;

      if (
        username === ADMIN.u &&
        password === ADMIN.p
      ) {
        sessionStorage.cwadmin = "1";
        go("/admin");
      } else {
        toast("Invalid admin credentials");
      }
    };
}

function admin() {
  const pend =
    state.transactions.filter(
      x => x.status === "Pending"
    );

  document.getElementById("app").innerHTML = `
    <div class="shell">

      <div class="top">

        <div class="toprow">

          <div>
            <div class="brand">
              Admin
            </div>

            <div class="sub">
              Virtual demo control center
            </div>
          </div>

          <button
            id="aout"
            class="iconbtn"
          >
            Logout
          </button>

        </div>

      </div>

      <div class="card">

        <div class="statgrid">

          <div class="stat">
            Users
            <b>
              ${Object.keys(state.users).length}
            </b>
          </div>

          <div class="stat">
            Pending
            <b>
              ${pend.length}
            </b>
          </div>

          <div class="stat">
            Deposits
            <b>
              ${
                state.transactions.filter(
                  x => x.kind === "deposit"
                ).length
              }
            </b>
          </div>

          <div class="stat">
            Withdrawals
            <b>
              ${
                state.transactions.filter(
                  x =>
                    x.kind === "withdrawal"
                ).length
              }
            </b>
          </div>

        </div>

      </div>

      <div class="card">

        <h3>Pending Requests</h3>

        ${
          pend
            .map(
              x => `
                <div class="adminrow">

                  <b>
                    ${esc(x.kind)}
                  </b>

                  • ${esc(x.user)}
                  • ₹${x.amount}

                  <br>

                  <span class="small">
                    ${esc(
                      x.utr ||
                      x.upi ||
                      ""
                    )}
                  </span>

                  <div
                    class="row"
                    style="margin-top:8px"
                  >

                    <button
                      class="btn primary"
                      onclick="adminAct(
                        ${state.transactions.indexOf(x)},
                        'approve'
                      )"
                    >
                      Approve
                    </button>

                    <button
                      class="btn danger"
                      onclick="adminAct(
                        ${state.transactions.indexOf(x)},
                        'reject'
                      )"
                    >
                      Reject
                    </button>

                  </div>

                </div>
              `
            )
            .join("") ||
          `
            <p class="small">
              No pending requests.
            </p>
          `
        }

      </div>

      <div class="card">

        <h3>Gift Codes</h3>

        ${
          Object.entries(state.giftCodes)
            .map(
              ([k, v]) =>
                `<p><b>${k}</b> → ₹${v}</p>`
            )
            .join("")
        }

        <div class="row">

          <input
            id="ng"
            class="input"
            placeholder="NEWCODE"
          >

          <input
            id="na"
            class="input"
            type="number"
            placeholder="Amount"
          >

          <button
            id="addg"
            class="btn primary"
          >
            Add
          </button>

        </div>

      </div>

      <div class="card">

        <h3>Broadcast Notice</h3>

        <input
          id="notice"
          class="input"
          value="${esc(
            state.settings.notice
          )}"
        >

        <button
          id="saveNotice"
          class="btn primary"
          style="margin-top:8px"
        >
          Save Notice
        </button>

      </div>

    </div>
  `;

  document.getElementById("aout").onclick =
    () => {
      sessionStorage.removeItem("cwadmin");
      go("/");
    };

  document.getElementById("addg").onclick =
    () => {
      const c =
        document
          .getElementById("ng")
          .value
          .trim()
          .toUpperCase();

      const a =
        Number(
          document.getElementById("na").value
        );

      if (!c || !a) {
        return toast(
          "Enter code and amount"
        );
      }

      state.giftCodes[c] = a;

      save();

      admin();
    };

  document.getElementById("saveNotice").onclick =
    () => {
      state.settings.notice =
        document.getElementById(
          "notice"
        ).value;

      save();

      toast("Notice saved");
    };
}

window.adminAct = (i, a) => {
  const x = state.transactions[i];

  if (!x) return;

  if (
    a === "approve" &&
    x.kind === "deposit"
  ) {
    state.users[x.user].balance +=
      x.amount;
  }

  x.status =
    a === "approve"
      ? "Approved"
      : "Rejected";

  save();

  admin();
};

render();
