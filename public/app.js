const $ = s => document.querySelector(s);

const api = async (url, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || 'Request failed'
    );
  }

  return data;
};

let state = {
  page: 'login',
  authTab: 'phone',
  user: null,
  mode: '1m',
  game: null,
  betType: 'color',
  selection: null,
  amount: 1000,

  otpSent: false,
  otpVerified: false,
  otpProof: null,
  otpPhone: '',

  adminToken: null,
  adminTab: 'overview'
};

const esc = value =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char])
  );

function toast(message) {
  const element =
    document.createElement('div');

  element.className = 'toast';
  element.textContent = message;

  document.body.append(element);

  setTimeout(
    () => element.remove(),
    2200
  );
}

/* =========================
   RENDER
========================= */

function render() {
  const root = $('#app');

  if (!root) return;

  if (state.page === 'login') {
    root.innerHTML = login();
    bind();
    return;
  }

  if (state.page === 'register') {
    root.innerHTML = register();
    bind();
    return;
  }

  if (state.page === 'admin-login') {
    root.innerHTML = adminLogin();
    bind();
    return;
  }

  if (state.page === 'admin') {
    root.innerHTML = admin();

    setTimeout(
      adminBind,
      0
    );

    return;
  }

  root.innerHTML = appShell();

  bind();
}

/* =========================
   LOGIN
========================= */

function login() {
  return `
    <div class="auth">

      <div class="authbrand">
        ColorWin
      </div>

      <div class="authbox">

        <div class="auth-tabs">

          <button
            class="auth-tab ${
              state.authTab === 'phone'
                ? 'active'
                : ''
            }"
            data-auth="phone">
            Log in with phone
          </button>

          <button
            class="auth-tab ${
              state.authTab === 'email'
                ? 'active'
                : ''
            }"
            data-auth="email">
            Email login
          </button>

        </div>

        <div class="label">
          ${
            state.authTab === 'phone'
              ? 'Phone number'
              : 'Email'
          }
        </div>

        <input
          id="ident"
          class="field"
          placeholder="${
            state.authTab === 'phone'
              ? '+91 phone number'
              : 'Email address'
          }">

        <div class="label">
          Password
        </div>

        <div class="row">

          <input
            id="pass"
            class="field"
            type="password"
            placeholder="Password">

          <button
            id="show"
            class="btn outline">
            Show
          </button>

        </div>

        <div
          class="row"
          style="margin:4px 0 16px">

          <label class="mini">
            <input
              id="remember"
              type="checkbox">
            Remember password
          </label>

          <button
            id="forgot"
            class="nav">
            Forgot password
          </button>

        </div>

        <button
          id="login"
          class="btn primary"
          style="width:100%">
          Log in
        </button>

        <button
          id="toRegister"
          class="btn outline"
          style="width:100%;margin-top:10px">
          Register
        </button>

        <p
          class="mini"
          style="margin-top:16px">
          Demo app • virtual credits only
        </p>

      </div>
    </div>
  `;
}

/* =========================
   REGISTER
========================= */

function register() {
  return `
    <div class="auth">

      <div class="authbrand">
        ColorWin
      </div>

      <div class="authbox">

        <h2>
          Create account
        </h2>

        <div class="label">
          Phone number
        </div>

        <input
          id="ident"
          class="field"
          inputmode="tel"
          placeholder="+91 phone number">

        <div class="label">
          Set password
        </div>

        <input
          id="pass"
          class="field"
          type="password"
          placeholder="Password">

        <div class="label">
          Confirm password
        </div>

        <input
          id="pass2"
          class="field"
          type="password"
          placeholder="Enter password again">

        <div class="label">
          SMS verification code
        </div>

        <div class="row">

          <input
            id="otp"
            class="field"
            inputmode="numeric"
            maxlength="6"
            placeholder="6-digit OTP">

          <button
            id="send"
            class="btn outline">
            Send
          </button>

        </div>

        <div
          id="otpStatus"
          class="mini"
          style="margin:8px 0">
          OTP verification required
        </div>

        <button
          id="verifyOtp"
          class="btn outline"
          style="width:100%">
          Verify OTP
        </button>

        <div class="label">
          Invite code (optional)
        </div>

        <input
          id="invite"
          class="field"
          placeholder="Invite code">

        <label class="mini">

          <input
            id="agree"
            type="checkbox">

          I have read and agree
          <u>Privacy Agreement</u>

        </label>

        <button
          id="register"
          class="btn primary"
          style="width:100%;margin-top:18px">
          Register
        </button>

        <button
          id="backLogin"
          class="btn outline"
          style="width:100%;margin-top:10px">
          Back to login
        </button>

      </div>
    </div>
  `;
}

/* =========================
   APP SHELL
========================= */

function appShell() {
  if (state.page === 'gift') {
    return giftPage();
  }

  if (state.page === 'wallet') {
    return walletPage();
  }

  if (state.page === 'profile') {
    return profilePage();
  }

  return dashboard(
    state.user
  );
}

/* =========================
   DASHBOARD
========================= */

function dashboard(user) {
  const game =
    state.game || {
      secondsLeft: 0,
      period: '',
      history: []
    };

  return `
    <div class="shell">

      <div class="top">

        <div class="row">

          <div>

            <div class="brand">
              ColorWin
            </div>

            <div class="sub">
              ID:
              ${esc(user?.user_code)}
            </div>

          </div>

          <button
            class="btn"
            style="background:rgba(255,255,255,.15);color:#fff"
            data-page="profile">
            Profile
          </button>

        </div>

        <div
          class="wallet"
          style="margin-top:18px">

          <div
            class="mini"
            style="color:#dff8ea">
            Wallet Balance
          </div>

          <div class="balance">
            ₹${(
              Number(user?.balance || 0) / 100
            ).toFixed(2)}
          </div>

          <div
            class="row"
            style="margin-top:12px">

            <button
              class="btn"
              data-page="wallet"
              style="background:#fff;color:var(--green)">
              Deposit
            </button>

            <button
              class="btn"
              data-page="wallet"
              style="background:#fff;color:var(--green)">
              Withdraw
            </button>

          </div>

        </div>

      </div>

      <div class="tabs">

        ${[
          ['30s', 'Win Go 30s'],
          ['1m', 'Win Go 1Min'],
          ['3m', 'Win Go 3Min'],
          ['5m', 'Win Go 5Min']
        ]
          .map(
            item => `
              <button
                class="tab ${
                  state.mode === item[0]
                    ? 'active'
                    : ''
                }"
                data-mode="${item[0]}">
                ${item[1]}
              </button>
            `
          )
          .join('')}

      </div>

      <div class="card gamehead">

        <div class="row">

          <div>

            <div
              class="mini"
              style="color:#d8f5e5">
              Current period
            </div>

            <b>
              ${esc(game.period)}
            </b>

          </div>

          <div
            style="text-align:right">

            <div
              class="mini"
              style="color:#d8f5e5">
              Time remaining
            </div>

            <div class="timer">
              ${formatTime(
                game.secondsLeft
              )}
            </div>

          </div>

        </div>

      </div>

      <div class="card">

        <h3>
          Choose your bet
        </h3>

        <div class="colorrow">

          ${[
            'Green',
            'Violet',
            'Red'
          ]
            .map(
              color => `
                <button
                  class="colorbtn ${color.toLowerCase()}
                  ${
                    state.betType === 'color' &&
                    state.selection === color
                      ? 'selected'
                      : ''
                  }"
                  data-bettype="color"
                  data-select="${color}">
                  ${color}
                  <small>
                    ${
                      color === 'Violet'
                        ? '4.5×'
                        : '2×'
                    }
                  </small>
                </button>
              `
            )
            .join('')}

        </div>

        <h4>
          Numbers
        </h4>

        <div class="betgrid">

          ${Array.from(
            { length: 10 },
            (_, number) => {

              let color =
                number === 0 ||
                number === 5
                  ? 'mix'
                  : number % 2
                    ? 'green'
                    : 'red';

              return `
                <button
                  class="ball ${color}
                  ${
                    state.betType === 'number' &&
                    state.selection ===
                      String(number)
                      ? 'selected'
                      : ''
                  }"
                  data-bettype="number"
                  data-select="${number}">
                  ${number}
                </button>
              `;
            }
          ).join('')}

        </div>

        <h4>
          Bet amount
        </h4>

        <div class="chips">

          ${[
            1000,
            5000,
            10000,
            20000,
            50000
          ]
            .map(
              amount => `
                <button
                  class="chip ${
                    state.amount === amount
                      ? 'on'
                      : ''
                  }"
                  data-amt="${amount}">
                  ₹${amount / 100}
                </button>
              `
            )
            .join('')}

        </div>

        <div class="sizerow">

          <button
            class="sizebtn orange ${
              state.betType === 'size' &&
              state.selection === 'Big'
                ? 'selected'
                : ''
            }"
            data-bettype="size"
            data-select="Big">
            Big 2×
          </button>

          <button
            class="sizebtn blue ${
              state.betType === 'size' &&
              state.selection === 'Small'
                ? 'selected'
                : ''
            }"
            data-bettype="size"
            data-select="Small">
            Small 2×
          </button>

          <button
            class="btn outline"
            data-page="gift">
            Gift
          </button>

        </div>

        <button
          id="place"
          class="btn primary"
          style="width:100%;margin-top:14px"
          ${
            state.selection === null
              ? 'disabled'
              : ''
          }>
          Place virtual bet ₹${(
            state.amount / 100
          ).toFixed(2)}
        </button>

      </div>

      <div class="card">

        <h3>
          Game history
        </h3>

        <div class="tablewrap">

          <table class="history">

            <thead>
              <tr>
                <th>Period</th>
                <th>Number</th>
                <th>Big/Small</th>
                <th>Color</th>
              </tr>
            </thead>

            <tbody>

              ${(
                game.history || []
              )
                .map(
                  round => `
                    <tr>
                      <td>
                        ${esc(round.period)}
                      </td>

                      <td>
                        ${esc(round.number)}
                      </td>

                      <td>
                        ${esc(round.size)}
                      </td>

                      <td>
                        ${esc(round.color)}
                      </td>
                    </tr>
                  `
                )
                .join('')}

            </tbody>

          </table>

        </div>

      </div>

      <nav class="bottom">

        <button class="nav active">
          ⌂<br>Home
        </button>

        <button
          class="nav"
          data-page="gift">
          🎁<br>Gift
        </button>

        <button
          class="nav"
          data-page="wallet">
          💳<br>Wallet
        </button>

        <button
          class="nav"
          data-page="profile">
          ◉<br>Profile
        </button>

      </nav>

    </div>
  `;
}

function formatTime(seconds) {
  seconds = Math.max(
    0,
    Number(seconds) || 0
  );

  return `${String(
    Math.floor(seconds / 60)
  ).padStart(2, '0')}:${String(
    seconds % 60
  ).padStart(2, '0')}`;
}

/* =========================
   WALLET
========================= */

function walletPage() {
  return `
    <div class="shell">

      <div class="top">

        <div class="row">

          <button
            class="btn"
            data-page="home">
            ←
          </button>

          <div class="brand">
            Wallet
          </div>

          <span></span>

        </div>

      </div>

      <div class="card">

        <div class="mini">
          Virtual balance
        </div>

        <div class="balance">
          ₹${(
            Number(state.user?.balance || 0) /
            100
          ).toFixed(2)}
        </div>

      </div>

      <div class="card">

        <h3>
          Demo deposit request
        </h3>

        <p class="mini">
          Real-money UPI/QR payments are
          disabled in this demo.
        </p>

        <div class="label">
          Amount (virtual credits)
        </div>

        <input
          id="depamt"
          class="field"
          type="number"
          min="100"
          value="100">

        <div class="label">
          12-digit test UTR
        </div>

        <input
          id="utr"
          class="field"
          inputmode="numeric"
          maxlength="12"
          placeholder="123456789012">

        <button
          id="dep"
          class="btn primary"
          style="width:100%">
          Submit Deposit Request
        </button>

      </div>

      <div class="card">

        <h3>
          Demo withdrawal request
        </h3>

        <p class="mini">
          This demo does not transfer real
          money.
        </p>

        <input
          id="bank"
          class="field"
          placeholder="Bank Name">

        <input
          id="acc"
          class="field"
          placeholder="Account Number">

        <input
          id="ifsc"
          class="field"
          placeholder="IFSC Code">

        <input
          id="upi"
          class="field"
          placeholder="UPI ID">

        <input
          id="wamt"
          class="field"
          type="number"
          min="100"
          placeholder="Amount">

        <button
          id="wd"
          class="btn outline"
          style="width:100%">
          Submit Withdrawal Request
        </button>

      </div>

    </div>
  `;
}

/* =========================
   GIFT
========================= */

function giftPage() {
  return `
    <div class="shell">

      <div class="top">

        <div class="row">

          <button
            class="btn"
            data-page="home">
            ←
          </button>

          <div class="brand">
            Gift
          </div>

          <span></span>

        </div>

        <div
          style="
            font-size:64px;
            text-align:center;
            margin:16px 0">
          🎁
        </div>

      </div>

      <div class="card">

        <h3>
          Please enter the gift code below
        </h3>

        <input
          id="gift"
          class="field"
          placeholder="Please enter gift code">

        <button
          id="receive"
          class="btn primary"
          style="width:100%">
          Receive
        </button>

      </div>

      <div class="card">

        <h3>
          Follow official channel
        </h3>

        <div class="row">

          <a
            class="btn outline"
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer">
            Telegram
          </a>

          <a
            class="btn outline"
            href="https://wa.me"
            target="_blank"
            rel="noopener noreferrer">
            WhatsApp
          </a>

        </div>

      </div>

      <div class="card">

        <h3>
          History
        </h3>

        <div id="gh">
          <div class="mini">
            Loading…
          </div>
        </div>

      </div>

    </div>
  `;
}

/* =========================
   PROFILE
========================= */

function profilePage() {
  return `
    <div class="shell">

      <div class="top">

        <div class="brand">
          Profile
        </div>

        <div class="sub">
          ${esc(
            state.user?.user_code
          )}
        </div>

      </div>

      <div class="card">

        <h3>
          Account
        </h3>

        <p>
          Phone:
          ${esc(
            state.user?.phone || '—'
          )}
        </p>

        <p>
          Email:
          ${esc(
            state.user?.email || '—'
          )}
        </p>

        <p>
          Virtual balance:
          ₹${(
            Number(
              state.user?.balance || 0
            ) / 100
          ).toFixed(2)}
        </p>

        <button
          id="logout"
          class="btn outline">
          Log out
        </button>

      </div>

    </div>
  `;
}

/* =========================
   ADMIN LOGIN
========================= */

function adminLogin() {
  return `
    <div class="auth">
      <div class="authbrand">
        ColorWin Admin
      </div>

      <div class="authbox">
        <h2>Secure admin login</h2>

        <div class="label">Username</div>
        <input
          id="au"
          class="field"
          placeholder="Username"
          autocomplete="username">

        <div class="label">Password</div>
        <input
          id="ap"
          class="field"
          type="password"
          placeholder="Password"
          autocomplete="current-password">

        <button
          id="adminLogin"
          class="btn primary"
          style="width:100%;margin-top:18px">
          Login
        </button>

        <button
          id="backUser"
          class="btn outline"
          style="width:100%;margin-top:10px">
          Back
        </button>
      </div>
    </div>
  `;
}


/* =========================
   ADMIN
========================= */

function admin() {
  return `
    <div class="admin">
      <div class="shell">

        <div class="top">
          <div class="row">
            <div>
              <div class="brand">ColorWin Admin</div>
              <div class="sub">Administration panel</div>
            </div>

            <button
              id="adminLogout"
              class="iconbtn">
              Logout
            </button>
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab ${
              state.adminTab === 'overview'
                ? 'active'
                : ''
            }"
            data-admin-tab="overview">
            Overview
          </button>

          <button
            class="tab ${
              state.adminTab === 'requests'
                ? 'active'
                : ''
            }"
            data-admin-tab="requests">
            Requests
          </button>

          <button
            class="tab ${
              state.adminTab === 'gifts'
                ? 'active'
                : ''
            }"
            data-admin-tab="gifts">
            Gifts
          </button>
        </div>

        ${
          state.adminTab === 'overview'
            ? adminOverview()
            : state.adminTab === 'requests'
              ? adminRequests()
              : adminGifts()
        }

      </div>
    </div>
  `;
}


function adminOverview() {
  return `
    <div class="card">
      <div class="section-title">
        <h3>Overview</h3>
        <span class="small">ColorWin</span>
      </div>

      <div id="adminStats">
        <div class="mini">Loading...</div>
      </div>
    </div>
  `;
}


function adminRequests() {
  return `
    <div class="card">
      <div class="section-title">
        <h3>Deposit / Withdrawal Requests</h3>
      </div>

      <div id="adminRequests">
        <div class="mini">Loading...</div>
      </div>
    </div>
  `;
}


function adminGifts() {
  return `
    <div class="card">
      <div class="section-title">
        <h3>Gift Codes</h3>
      </div>

      <div class="row">
        <input
          id="giftCode"
          class="field"
          placeholder="Gift code">

        <input
          id="giftAmount"
          class="field"
          type="number"
          min="1"
          placeholder="Amount">
      </div>

      <button
        id="createGift"
        class="btn primary"
        style="margin-top:10px">
        Create Gift
      </button>

      <div
        id="adminGiftsList"
        style="margin-top:15px">
        <div class="mini">Loading...</div>
      </div>
    </div>
  `;
}


/* =========================
   ADMIN API
========================= */

async function adminApi(url, options = {}) {
  const token = state.adminToken;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || 'Admin request failed'
    );
  }

  return data;
}


async function loadAdminOverview() {
  try {
    const data =
      await adminApi('/api/admin/overview');

    const box = $('#adminStats');

    if (!box) return;

    box.innerHTML = `
      <div class="statgrid">

        <div class="stat">
          <div class="small">Owner</div>
          <b>${esc(data.owner)}</b>
        </div>

        <div class="stat">
          <div class="small">Users</div>
          <b>${esc(data.users)}</b>
        </div>

        <div class="stat">
          <div class="small">Deposits</div>
          <b>₹${(
            Number(data.deposits || 0) / 100
          ).toFixed(2)}</b>
        </div>

        <div class="stat">
          <div class="small">Withdrawals</div>
          <b>₹${(
            Number(data.withdrawals || 0) / 100
          ).toFixed(2)}</b>
        </div>

        <div class="stat">
          <div class="small">Profit</div>
          <b>₹${(
            Number(data.profit || 0) / 100
          ).toFixed(2)}</b>
        </div>

      </div>
    `;
  } catch (error) {
    toast(error.message);
  }
}


async function loadAdminRequests() {
  try {
    const data =
      await adminApi('/api/admin/requests');

    const box = $('#adminRequests');

    if (!box) return;

    if (!data.length) {
      box.innerHTML =
        `<div class="mini">No requests found.</div>`;
      return;
    }

    box.innerHTML = data.map(request => `
      <div class="adminrow">

        <b>
          ${esc(request.type)}
        </b>

        <div class="small">
          User:
          ${esc(request.user_code || '—')}
        </div>

        <div class="small">
          Phone:
          ${esc(request.phone || '—')}
        </div>

        <div class="small">
          Amount:
          ₹${(
            Number(request.amount || 0) / 100
          ).toFixed(2)}
        </div>

        <div class="small">
          Status:
          ${esc(request.status)}
        </div>

        ${
          request.utr
            ? `
              <div class="small">
                UTR: ${esc(request.utr)}
              </div>
            `
            : ''
        }

        ${
          request.status === 'Pending'
            ? `
              <div
                class="row"
                style="margin-top:9px">

                <button
                  class="btn primary"
                  data-request-action="Approve"
                  data-request-id="${request.id}">
                  Approve
                </button>

                <button
                  class="btn danger"
                  data-request-action="Reject"
                  data-request-id="${request.id}">
                  Reject
                </button>

              </div>
            `
            : ''
        }

      </div>
    `).join('');

  } catch (error) {
    toast(error.message);
  }
}


async function loadAdminGifts() {
  try {
    const data =
      await adminApi('/api/admin/gifts');

    const box = $('#adminGiftsList');

    if (!box) return;

    if (!data.length) {
      box.innerHTML =
        `<div class="mini">No gift codes.</div>`;
      return;
    }

    box.innerHTML = data.map(gift => `
      <div class="adminrow">

        <b>${esc(gift.code)}</b>

        <div class="small">
          Amount:
          ₹${(
            Number(gift.amount || 0) / 100
          ).toFixed(2)}
        </div>

        <div class="small">
          Claims:
          ${esc(gift.claims)}
        </div>

        <div class="small">
          Status:
          ${
            gift.active
              ? 'Active'
              : 'Inactive'
          }
        </div>

      </div>
    `).join('');

  } catch (error) {
    toast(error.message);
  }
}


async function adminBind() {
  if (state.adminTab === 'overview') {
    await loadAdminOverview();
  }

  if (state.adminTab === 'requests') {
    await loadAdminRequests();
  }

  if (state.adminTab === 'gifts') {
    await loadAdminGifts();
  }
}


/* =========================
   NORMAL APP ACTIONS
========================= */

async function loadGame() {
  if (!state.user) return;

  try {
    state.game =
      await api(
        `/api/game/${state.mode}`
      );

    render();
  } catch (error) {
    if (
      error.message === 'Unauthorized'
    ) {
      logout();
      return;
    }

    toast(error.message);
  }
}


async function sendOtp() {
  const phone =
    $('#ident')?.value?.trim();

  if (!phone) {
    toast('Enter phone number');
    return;
  }

  const button = $('#send');

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending...';
    }

    await api('/api/send-otp', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        purpose: 'register'
      })
    });

    state.otpSent = true;
    state.otpVerified = false;
    state.otpProof = null;
    state.otpPhone = phone;

    const status =
      $('#otpStatus');

    if (status) {
      status.textContent =
        'OTP sent. Enter the 6-digit code and verify.';
    }

    toast('OTP sent successfully');

  } catch (error) {
    toast(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Send';
    }
  }
}


async function verifyOtp() {
  const phone =
    $('#ident')?.value?.trim();

  const otp =
    $('#otp')?.value?.trim();

  if (!phone) {
    toast('Enter phone number');
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    toast('Enter exactly 6 digits');
    return;
  }

  if (
    state.otpPhone &&
    state.otpPhone !== phone
  ) {
    toast('Phone number changed. Send OTP again.');
    return;
  }

  const button =
    $('#verifyOtp');

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Verifying...';
    }

    const data =
      await api('/api/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          otp,
          purpose: 'register'
        })
      });

    state.otpVerified = true;
    state.otpProof = data.proof;
    state.otpPhone = phone;

    const status =
      $('#otpStatus');

    if (status) {
      status.textContent =
        '✓ Mobile number verified successfully.';
      status.style.color = '#07884f';
      status.style.fontWeight = '800';
    }

    toast('OTP verified');

  } catch (error) {
    toast(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Verify OTP';
    }
  }
}


async function registerUser() {
  const phone =
    $('#ident')?.value?.trim();

  const password =
    $('#pass')?.value || '';

  const password2 =
    $('#pass2')?.value || '';

  const invite =
    $('#invite')?.value?.trim() || '';

  const agree =
    $('#agree')?.checked;

  if (!phone) {
    toast('Enter phone number');
    return;
  }

  if (password.length < 6) {
    toast('Password must be at least 6 characters');
    return;
  }

  if (password !== password2) {
    toast('Passwords do not match');
    return;
  }

  if (!state.otpVerified || !state.otpProof) {
    toast('Verify OTP first');
    return;
  }

  if (!agree) {
    toast('Please accept Privacy Agreement');
    return;
  }

  try {
    const data =
      await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          password,
          otpProof: state.otpProof,
          invite
        })
      });

    localStorage.setItem(
      'token',
      data.token
    );

    state.user = data.user;
    state.page = 'home';
    state.otpSent = false;
    state.otpVerified = false;
    state.otpProof = null;
    state.otpPhone = '';

    toast('Account created successfully');

    await loadGame();

  } catch (error) {
    toast(error.message);
  }
}


async function loginUser() {
  const identifier =
    $('#ident')?.value?.trim();

  const password =
    $('#pass')?.value || '';

  if (!identifier || !password) {
    toast('Enter login details');
    return;
  }

  try {
    const data =
      await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password
        })
      });

    localStorage.setItem(
      'token',
      data.token
    );

    state.user = data.user;
    state.page = 'home';

    await loadGame();

  } catch (error) {
    toast(error.message);
  }
}


function logout() {
  localStorage.removeItem('token');

  state.user = null;
  state.page = 'login';
  state.game = null;

  render();
}


async function redeemGift() {
  const code =
    $('#gift')?.value?.trim();

  if (!code) {
    toast('Enter gift code');
    return;
  }

  try {
    const data =
      await api('/api/gift/redeem', {
        method: 'POST',
        body: JSON.stringify({
          code
        })
      });

    state.user = data.user;

    toast(
      `Received ₹${(
        Number(data.amount || 0) / 100
      ).toFixed(2)}`
    );

    render();

  } catch (error) {
    toast(error.message);
  }
}


async function loadGiftHistory() {
  try {
    const data =
      await api('/api/gift/history');

    const box = $('#gh');

    if (!box) return;

    if (!data.length) {
      box.innerHTML =
        `<div class="mini">No gift history.</div>`;
      return;
    }

    box.innerHTML = data.map(item => `
      <div class="adminrow">
        <b>${esc(item.code)}</b>
        <div class="small">
          ₹${(
            Number(item.amount || 0) / 100
          ).toFixed(2)}
        </div>
      </div>
    `).join('');

  } catch (error) {
    toast(error.message);
  }
}


/* =========================
   BET
========================= */

async function placeBet() {
  if (!state.selection) {
    toast('Choose a selection');
    return;
  }

  try {
    const data =
      await api('/api/bet', {
        method: 'POST',
        body: JSON.stringify({
          mode: state.mode,
          betType: state.betType,
          selection: state.selection,
          amount: state.amount
        })
      });

    state.user = data.user;
    state.selection = null;

    toast('Virtual bet placed');

    await loadGame();

  } catch (error) {
    toast(error.message);
  }
}


/* =========================
   WALLET
========================= */

async function depositRequest() {
  const amount =
    Number($('#depamt')?.value || 0);

  const utr =
    $('#utr')?.value?.trim();

  if (!Number.isInteger(amount) || amount < 100) {
    toast('Minimum amount is ₹100');
    return;
  }

  if (!/^\d{12}$/.test(utr)) {
    toast('Enter 12-digit test UTR');
    return;
  }

  try {
    await api('/api/deposit-request', {
      method: 'POST',
      body: JSON.stringify({
        amount: amount * 100,
        utr
      })
    });

    toast('Deposit request submitted');

  } catch (error) {
    toast(error.message);
  }
}


async function withdrawRequest() {
  const amount =
    Number($('#wamt')?.value || 0);

  if (!Number.isInteger(amount) || amount < 100) {
    toast('Minimum amount is ₹100');
    return;
  }

  try {
    const data =
      await api('/api/withdraw-request', {
        method: 'POST',
        body: JSON.stringify({
          amount: amount * 100,
          bankName: $('#bank')?.value || '',
          accountNumber: $('#acc')?.value || '',
          ifsc: $('#ifsc')?.value || '',
          upiId: $('#upi')?.value || ''
        })
      });

    state.user = data.user;

    toast('Withdrawal request submitted');

    render();

  } catch (error) {
    toast(error.message);
  }
}


/* =========================
   EVENT BINDING
========================= */

function bind() {

  /* Auth tabs */

  document
    .querySelectorAll('[data-auth]')
    .forEach(button => {
      button.onclick = () => {
        state.authTab =
          button.dataset.auth;

        render();
      };
    });


  /* Navigation */

  document
    .querySelectorAll('[data-page]')
    .forEach(button => {
      button.onclick = () => {

        const page =
          button.dataset.page;

        if (page === 'home') {
          state.page = 'home';
        } else {
          state.page = page;
        }

        render();

        if (page === 'gift') {
          loadGiftHistory();
        }
      };
    });


  /* Register page */

  $('#send')?.addEventListener(
    'click',
    sendOtp
  );

  $('#verifyOtp')?.addEventListener(
    'click',
    verifyOtp
  );

  $('#register')?.addEventListener(
    'click',
    registerUser
  );

  $('#backLogin')?.addEventListener(
    'click',
    () => {
      state.page = 'login';
      state.otpSent = false;
      state.otpVerified = false;
      state.otpProof = null;
      state.otpPhone = '';
      render();
    }
  );


  /* OTP input: numbers only */

  $('#otp')?.addEventListener(
    'input',
    event => {
      event.target.value =
        event.target.value
          .replace(/\D/g, '')
          .slice(0, 6);
    }
  );


  /* Phone input */

  $('#ident')?.addEventListener(
    'input',
    event => {

      if (
        state.page === 'register' &&
        state.otpPhone &&
        event.target.value.trim() !==
          state.otpPhone
      ) {
        state.otpVerified = false;
        state.otpProof = null;

        const status =
          $('#otpStatus');

        if (status) {
          status.textContent =
            'Phone changed. Send a new OTP.';
          status.style.color = '';
        }
      }
    }
  );


  /* Login */

  $('#login')?.addEventListener(
    'click',
    loginUser
  );


  /* Show password */

  $('#show')?.addEventListener(
    'click',
    () => {
      const pass = $('#pass');

      if (!pass) return;

      pass.type =
        pass.type === 'password'
          ? 'text'
          : 'password';
    }
  );


  /* Register */

  $('#toRegister')?.addEventListener(
    'click',
    () => {
      state.page = 'register';
      render();
    }
  );


  /* Forgot password */

  $('#forgot')?.addEventListener(
    'click',
    () => {
      toast(
        'Password reset can be added next.'
      );
    }
  );


  /* Game modes */

  document
    .querySelectorAll('[data-mode]')
    .forEach(button => {
      button.onclick = async () => {
        state.mode =
          button.dataset.mode;

        await loadGame();
      };
    });


  /* Bet type */

  document
    .querySelectorAll('[data-bettype]')
    .forEach(button => {
      button.onclick = () => {

        state.betType =
          button.dataset.bettype;

        state.selection =
          button.dataset.select;

        render();
      };
    });


  /* Amount */

  document
    .querySelectorAll('[data-amt]')
    .forEach(button => {
      button.onclick = () => {

        state.amount =
          Number(button.dataset.amt);

        render();
      };
    });


  /* Place bet */

  $('#place')?.addEventListener(
    'click',
    placeBet
  );


  /* Gift */

  $('#receive')?.addEventListener(
    'click',
    redeemGift
  );


  /* Wallet */

  $('#dep')?.addEventListener(
    'click',
    depositRequest
  );

  $('#wd')?.addEventListener(
    'click',
    withdrawRequest
  );


  /* Logout */

  $('#logout')?.addEventListener(
    'click',
    logout
  );
}


/* =========================
   ADMIN BINDING
========================= */

document.addEventListener(
  'click',
  async event => {

    const tab =
      event.target.closest(
        '[data-admin-tab]'
      );

    if (tab) {
      state.adminTab =
        tab.dataset.adminTab;

      render();

      return;
    }

    const action =
      event.target.closest(
        '[data-request-action]'
      );

    if (action) {

      try {

        await adminApi(
          `/api/admin/request/${action.dataset.requestId}`,
          {
            method: 'POST',
            body: JSON.stringify({
              action:
                action.dataset.requestAction
            })
          }
        );

        toast('Request updated');

        await loadAdminRequests();

      } catch (error) {
        toast(error.message);
      }

      return;
    }

  }
);


/* =========================
   ADMIN LOGIN BINDING
========================= */

document.addEventListener(
  'click',
  async event => {

    if (
      event.target.closest('#adminLogin')
    ) {

      const username =
        $('#au')?.value?.trim();

      const password =
        $('#ap')?.value || '';

      if (!username || !password) {
        toast('Enter admin credentials');
        return;
      }

      try {

        const data =
          await fetch(
            '/api/admin/login',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body: JSON.stringify({
                username,
                password
              })
            }
          );

        const result =
          await data.json();

        if (!data.ok) {
          throw new Error(
            result.error ||
            'Admin login failed'
          );
        }

        state.adminToken =
          result.token;

        state.page = 'admin';

        render();

      } catch (error) {
        toast(error.message);
      }

      return;
    }


    if (
      event.target.closest('#adminLogout')
    ) {
      state.adminToken = null;
      state.page = 'login';
      render();
    }


    if (
      event.target.closest('#backUser')
    ) {
      state.page = 'login';
      render();
    }


    if (
      event.target.closest('#createGift')
    ) {

      const code =
        $('#giftCode')?.value?.trim();

      const amount =
        Number(
          $('#giftAmount')?.value || 0
        );

      if (!code || !Number.isInteger(amount)) {
        toast('Enter gift code and amount');
        return;
      }

      try {

        await adminApi(
          '/api/admin/gifts',
          {
            method: 'POST',
            body: JSON.stringify({
              code,
              amount: amount * 100
            })
          }
        );

        toast('Gift created');

        await loadAdminGifts();

      } catch (error) {
        toast(error.message);
      }
    }
  }
);


/* =========================
   STARTUP
========================= */

async function start() {

  const token =
    localStorage.getItem('token');

  if (!token) {
    state.page = 'login';
    render();
    return;
  }

  try {

    state.user =
      await api('/api/me');

    state.page = 'home';

    render();

    await loadGame();

  } catch {

    localStorage.removeItem('token');

    state.user = null;
    state.page = 'login';

    render();
  }
}


start();
