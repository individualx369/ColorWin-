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

        <h2>
          Secure admin login
        </h2>

        <input
          id="au"
          class="field"
          placeholder="Username">

        <input
          id="ap"
          class="field"
          type="password"
          placeholder="Password">

        <button
          id="adminLogin"
          class="btn primary"
          style="width:100%">
          Enter
        </button>

        <p class="mini">
          Admin authentication is handled
          by the server.
        </p>

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

      <div class="row">

        <div>

          <h1>
            ColorWin Admin
          </h1>

          <div class="mini">
            Virtual-credit demo controls
          </div>

        </div>

        <button
          id="adminOut"
          class="btn outline">
          Exit
        </button>

      </div>

      <div class="adminnav">

        ${[
          'overview',
          'requests',
          'gifts'
        ]
          .map(
            tab => `
              <button
                class="admintab ${
                  state.adminTab === tab
                    ? 'active'
                    : ''
                }"
                data-admintab="${tab}">
                ${tab}
              </button>
            `
          )
          .join('')}

      </div>

      <div id="adminbody">
        Loading…
      </div>

    </div>
  `;
}

/* =========================
   GAME
========================= */

async function loadGame() {
  try {
    state.game =
      await api(
        `/api/game/${state.mode}`
      );

    render();
  } catch (error) {
    localStorage.removeItem(
      'token'
    );

    state.user = null;
    state.game = null;
    state.page = 'login';

    render();

    toast(
      error.message ||
      'Session expired'
    );
  }
}

/* =========================
   BIND
========================= */

function bind() {

  document
    .querySelectorAll('[data-page]')
    .forEach(button => {

      button.onclick = () => {

        state.page =
          button.dataset.page === 'home'
            ? 'home'
            : button.dataset.page;

        render();

        if (
          state.page === 'home'
        ) {
          loadGame();
        }

      };

    });

  document
    .querySelectorAll('[data-mode]')
    .forEach(button => {

      button.onclick = () => {

        state.mode =
          button.dataset.mode;

        state.selection = null;

        loadGame();

      };

    });

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

  document
    .querySelectorAll('[data-amt]')
    .forEach(button => {

      button.onclick = () => {

        state.amount =
          Number(
            button.dataset.amt
          );

        render();

      };

    });

  /* BET */

  if ($('#place')) {

    $('#place').onclick =
      async () => {

        try {

          const data =
            await api(
              '/api/bet',
              {
                method: 'POST',
                body: JSON.stringify({
                  mode: state.mode,
                  betType:
                    state.betType,
                  selection:
                    state.selection,
                  amount:
                    state.amount
                })
              }
            );

          state.user =
            data.user;

          state.selection = null;

          toast(
            'Virtual bet placed'
          );

          await loadGame();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  /* LOGIN */

  if ($('#login')) {

    $('#login').onclick =
      async () => {

        const identifier =
          $('#ident')
            .value
            .trim();

        const password =
          $('#pass').value;

        if (
          !identifier ||
          !password
        ) {
          toast(
            'Enter login details'
          );

          return;
        }

        try {

          const data =
            await api(
              '/api/login',
              {
                method: 'POST',
                body: JSON.stringify({
                  identifier,
                  password
                })
              }
            );

          localStorage.setItem(
            'token',
            data.token
          );

          state.user =
            data.user;

          state.page = 'home';

          await loadGame();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  /* REGISTER */

  if ($('#toRegister')) {

    $('#toRegister').onclick =
      () => {

        state.page =
          'register';

        state.otpSent = false;
        state.otpVerified = false;
        state.otpProof = null;

        render();

      };

  }

  if ($('#backLogin')) {

    $('#backLogin').onclick =
      () => {

        state.page =
          'login';

        render();

      };

  }

  /* LOGIN TAB */

  document
    .querySelectorAll('[data-auth]')
    .forEach(button => {

      button.onclick = () => {

        state.authTab =
          button.dataset.auth;

        render();

      };

    });

  /* SHOW PASSWORD */

  if ($('#show')) {

    $('#show').onclick =
      () => {

        const input =
          $('#pass');

        input.type =
          input.type === 'password'
            ? 'text'
            : 'password';

      };

  }

  /* FORGOT PASSWORD */

  if ($('#forgot')) {

    $('#forgot').onclick =
      () => {

        toast(
          'Password reset: verify OTP first'
        );

        state.page =
          'register';

        render();

      };

  }

  /* SEND OTP */

  if ($('#send')) {

    $('#send').onclick =
      async () => {

        const phone =
          $('#ident')
            .value
            .trim();

        if (!phone) {

          toast(
            'Enter your phone number'
          );

          return;

        }

        try {

          await api(
            '/api/send-otp',
            {
              method: 'POST',
              body: JSON.stringify({
                phone,
                purpose:
                  'register'
              })
            }
          );

          state.otpSent = true;
          state.otpVerified = false;
          state.otpProof = null;
          state.otpPhone = phone;

          if ($('#otpStatus')) {
            $('#otpStatus')
              .textContent =
              'OTP sent. Enter the code and verify.';
          }

          toast(
            'OTP sent successfully'
          );

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  /* VERIFY OTP */

  if ($('#verifyOtp')) {

    $('#verifyOtp').onclick =
      async () => {

        const phone =
          $('#ident')
            .value
            .trim();

        const otp =
          $('#otp')
            .value
            .trim();

        if (!phone) {

          toast(
            'Enter phone number'
          );

          return;

        }

        if (!/^\d{6}$/.test(otp)) {

          toast(
            'Enter 6-digit OTP'
          );

          return;

        }

        try {

          const data =
            await api(
              '/api/verify-otp',
              {
                method: 'POST',
                body: JSON.stringify({
                  phone,
                  otp,
                  purpose:
                    'register'
                })
              }
            );

          state.otpVerified =
            true;

          state.otpProof =
            data.proof;

          state.otpPhone =
            phone;

          if ($('#otpStatus')) {
            $('#otpStatus')
              .textContent =
              '✓ Phone verified successfully';
          }

          toast(
            'OTP verified'
          );

        } catch (error) {

          state.otpVerified =
            false;

          state.otpProof = null;

          toast(
            error.message
          );

        }

      };

  }

  /* CREATE ACCOUNT */

  if ($('#register')) {

    $('#register').onclick =
      async () => {

        const phone =
          $('#ident')
            .value
            .trim();

        const password =
          $('#pass').value;

        const password2 =
          $('#pass2').value;

        if (!phone) {

          toast(
            'Enter phone number'
          );

          return;

        }

        if (
          password.length < 6
        ) {

          toast(
            'Password must be at least 6 characters'
          );

          return;

        }

        if (
          password !==
          password2
        ) {

          toast(
            'Passwords do not match'
          );

          return;

        }

        if (
          !state.otpVerified ||
          !state.otpProof
        ) {

          toast(
            'Please verify OTP first'
          );

          return;

        }

        if (
          !$('#agree').checked
        ) {

          toast(
            'Please accept Privacy Agreement'
          );

          return;

        }

        try {

          const data =
            await api(
              '/api/register',
              {
                method: 'POST',
                body: JSON.stringify({
                  phone,
                  password,
                  otpProof:
                    state.otpProof
                })
              }
            );

          localStorage.setItem(
            'token',
            data.token
          );

          state.user =
            data.user;

          state.page =
            'home';

          toast(
            'Account created successfully'
          );

          await loadGame();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  /* LOGOUT */

  if ($('#logout')) {

    $('#logout').onclick =
      () => {

        localStorage.removeItem(
          'token'
        );

        state.user = null;
        state.game = null;
        state.selection = null;
        state.page = 'login';

        render();

      };

  }

  /* DEPOSIT */

  if ($('#dep')) {

    $('#dep').onclick =
      async () => {

        const amount =
          Number(
            $('#depamt').value
          );

        const utr =
          $('#utr')
            .value
            .trim();

        try {

          await api(
            '/api/deposit-request',
            {
              method: 'POST',
              body: JSON.stringify({
                amount:
                  Math.round(
                    amount * 100
                  ),
                utr
              })
            }
          );

          toast(
            'Deposit request sent'
          );

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  /* WITHDRAW */

  if ($('#wd')) {

    $('#wd').onclick =
      async () => {

        try {

          const data =
            await api(
              '/api/withdraw-request',
              {
                method: 'POST',
                body: JSON.stringify({
                  amount:
                    Math.round(
                      Number(
                        $('#wamt').value
                      ) * 100
                    ),
                  bankName:
                    $('#bank').value,
                  accountNumber:
                    $('#acc').value,
                  ifsc:
                    $('#ifsc').value,
                  upiId:
                    $('#upi').value
                })
              }
            );

          state.user =
            data.user;

          toast(
            'Withdrawal request sent'
          );

          render();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  /* GIFT */

  if ($('#receive')) {

    $('#receive').onclick =
      async () => {

        const code =
          $('#gift')
            .value
            .trim();

        if (!code) {

          toast(
            'Enter gift code'
          );

          return;

        }

        try {

          const data =
            await api(
              '/api/gift/redeem',
              {
                method: 'POST',
                body: JSON.stringify({
                  code
                })
              }
            );

          state.user =
            data.user;

          toast(
            `${data.message} +₹${(
              data.amount / 100
            ).toFixed(2)}`
          );

          giftHistory();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }

  if ($('#gh')) {
    giftHistory();
  }

  /* ADMIN LOGIN */

  if ($('#adminLogin')) {

    $('#adminLogin').onclick =
      async () => {

        const username =
          $('#au').value;

        const password =
          $('#ap').value;

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
                body:
                  JSON.stringify({
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

          state.page =
            'admin';

          render();

          adminBody();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  }
}

/* =========================
   GIFT HISTORY
========================= */

async function giftHistory() {

  const element = $('#gh');

  if (!element) return;

  try {

    const history =
      await api(
        '/api/gift/history'
      );

    element.innerHTML =
      history.length
        ? history
            .map(
              item => `
                <p>

                  <b>
                    Successfully received
                  </b>

                  <br>

                  <span class="mini">
                    ${new Date(
                      item.claimed_at
                    ).toLocaleString()}
                    •
                    ${esc(item.code)}
                    •
                    +₹${(
                      item.amount / 100
                    ).toFixed(2)}
                  </span>

                </p>
              `
            )
            .join('')
        : `
          <div class="mini">
            No gift claims yet.
          </div>
        `;

  } catch {
    element.innerHTML = `
      <div class="mini">
        Unable to load gift history.
      </div>
    `;
  }
}

/* =========================
   ADMIN API
========================= */

async function adminFetch(
  url,
  options = {}
) {

  if (!state.adminToken) {
    throw new Error(
      'Admin session expired'
    );
  }

  const response =
    await fetch(
      url,
      {
        ...options,
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            `Bearer ${state.adminToken}`,
          ...(options.headers || {})
        }
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {

    if (
      response.status === 401 ||
      response.status === 403
    ) {

      state.adminToken = null;
      state.page =
        'admin-login';

      render();

    }

    throw new Error(
      data.error ||
      'Admin request failed'
    );

  }

  return data;
}

/* =========================
   ADMIN BODY
========================= */

async function adminBody() {

  const element =
    $('#adminbody');

  if (!element) return;

  element.innerHTML = `
    <div class="card">
      Loading…
    </div>
  `;

  try {

    if (
      state.adminTab ===
      'overview'
    ) {

      const data =
        await adminFetch(
          '/api/admin/overview'
        );

      element.innerHTML = `
        <div class="card">

          <h3>
            Admin Overview
          </h3>

          <div class="row">

            <div>
              <h3>
                Active users
              </h3>

              <div class="balance">
                ${data.users}
              </div>
            </div>

            <div>
              <h3>
                Approved deposits
              </h3>

              <div class="balance">
                ₹${(
                  data.deposits / 100
                ).toFixed(2)}
              </div>
            </div>

            <div>
              <h3>
                Approved withdrawals
              </h3>

              <div class="balance">
                ₹${(
                  data.withdrawals / 100
                ).toFixed(2)}
              </div>
            </div>

            <div>
              <h3>
                Gross difference
              </h3>

              <div class="balance">
                ₹${(
                  data.profit / 100
                ).toFixed(2)}
              </div>
            </div>

          </div>

        </div>
      `;

      return;
    }

    if (
      state.adminTab ===
      'requests'
    ) {

      const requests =
        await adminFetch(
          '/api/admin/requests'
        );

      element.innerHTML = `
        <div
          class="card tablewrap">

          <table class="history">

            <thead>

              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Details</th>
                <th>Status</th>
                <th>Action</th>
              </tr>

            </thead>

            <tbody>

              ${
                requests.length
                  ? requests
                      .map(
                        request => `
                          <tr>

                            <td>
                              ${esc(
                                request.user_code
                              )}

                              <br>

                              <span class="mini">
                                ${esc(
                                  request.phone
                                )}
                              </span>
                            </td>

                            <td>
                              ${esc(
                                request.type
                              )}
                            </td>

                            <td>
                              ₹${(
                                request.amount /
                                100
                              ).toFixed(2)}
                            </td>

                            <td>
                              ${
                                request.utr
                                  ? `UTR:
                                    ${esc(
                                      request.utr
                                    )}`
                                  : ''
                              }

                              ${
                                request.bank_name
                                  ? `<br>Bank:
                                    ${esc(
                                      request.bank_name
                                    )}`
                                  : ''
                              }

                              ${
                                request.account_number
                                  ? `<br>A/C:
                                    ${esc(
                                      request.account_number
                                    )}`
                                  : ''
                              }

                              ${
                                request.ifsc
                                  ? `<br>IFSC:
                                    ${esc(
                                      request.ifsc
                                    )}`
                                  : ''
                              }

                              ${
                                request.upi_id
                                  ? `<br>UPI:
                                    ${esc(
                                      request.upi_id
                                    )}`
                                  : ''
                              }
                            </td>

                            <td>
                              ${esc(
                                request.status
                              )}
                            </td>

                            <td>

                              ${
                                request.status ===
                                'Pending'
                                  ? `
                                    <button
                                      class="btn primary"
                                      data-req="${request.id}"
                                      data-action="Approve">
                                      Approve
                                    </button>

                                    <button
                                      class="btn danger"
                                      data-req="${request.id}"
                                      data-action="Reject">
                                      Reject
                                    </button>
                                  `
                                  : '—'
                              }

                            </td>

                          </tr>
                        `
                      )
                      .join('')
                  : `
                    <tr>
                      <td colspan="6">
                        No requests found.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>
      `;

      document
        .querySelectorAll(
          '[data-req]'
        )
        .forEach(button => {

          button.onclick =
            async () => {

              button.disabled =
                true;

              try {

                await adminFetch(
                  `/api/admin/request/${button.dataset.req}`,
                  {
                    method: 'POST',
                    body:
                      JSON.stringify({
                        action:
                          button.dataset
                            .action
                      })
                  }
                );

                toast(
                  'Request updated'
                );

                adminBody();

              } catch (error) {

                button.disabled =
                  false;

                toast(
                  error.message
                );

              }

            };

        });

      return;
    }

    /* GIFTS */

    const gifts =
      await adminFetch(
        '/api/admin/gifts'
      );

    element.innerHTML = `
      <div class="card">

        <h3>
          Create gift code
        </h3>

        <div class="row">

          <input
            id="gc"
            class="field"
            maxlength="32"
            placeholder="CODE">

          <input
            id="ga"
            class="field"
            type="number"
            min="1"
            placeholder="₹ amount">

          <button
            id="gcreate"
            class="btn primary">
            Create
          </button>

        </div>

      </div>

      <div
        class="card tablewrap">

        <table class="history">

          <thead>

            <tr>
              <th>Code</th>
              <th>Value</th>
              <th>Active</th>
              <th>Claims</th>
            </tr>

          </thead>

          <tbody>

            ${
              gifts.length
                ? gifts
                    .map(
                      gift => `
                        <tr>

                          <td>
                            ${esc(
                              gift.code
                            )}
                          </td>

                          <td>
                            ₹${(
                              gift.amount /
                              100
                            ).toFixed(2)}
                          </td>

                          <td>
                            ${
                              gift.active
                                ? 'Yes'
                                : 'No'
                            }
                          </td>

                          <td>
                            ${gift.claims}
                          </td>

                        </tr>
                      `
                    )
                    .join('')
                : `
                  <tr>
                    <td colspan="4">
                      No gifts found.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;

    $('#gcreate').onclick =
      async () => {

        const code =
          $('#gc')
            .value
            .trim();

        const rupees =
          Number(
            $('#ga').value
          );

        if (!code) {

          toast(
            'Enter gift code'
          );

          return;

        }

        if (
          !Number.isFinite(
            rupees
          ) ||
          rupees <= 0
        ) {

          toast(
            'Enter valid amount'
          );

          return;

        }

        try {

          await adminFetch(
            '/api/admin/gifts',
            {
              method: 'POST',
              body:
                JSON.stringify({
                  code,
                  amount:
                    Math.round(
                      rupees * 100
                    )
                })
            }
          );

          toast(
            'Gift code created'
          );

          adminBody();

        } catch (error) {

          toast(
            error.message
          );

        }

      };

  } catch (error) {

    element.innerHTML = `
      <div class="card">
        <p>
          ${esc(
            error.message
          )}
        </p>
      </div>
    `;

  }
}

/* =========================
   ADMIN BIND
========================= */

function adminBind() {

  document
    .querySelectorAll(
      '[data-admintab]'
    )
    .forEach(button => {

      button.onclick = () => {

        state.adminTab =
          button.dataset
            .admintab;

        render();

        adminBody();

      };

    });

  if ($('#adminOut')) {

    $('#adminOut').onclick =
      () => {

        state.adminToken = null;
        state.page =
          'admin-login';

        render();

      };

  }
}

/* =========================
   START
========================= */

async function start() {

  const path =
    location.pathname;

  if (
    path ===
    '/admin-login'
  ) {

    state.page =
      'admin-login';

    render();

    return;
  }

  const token =
    localStorage.getItem(
      'token'
    );

  if (token) {

    try {

      state.user =
        await api('/api/me');

      state.page =
        'home';

      await loadGame();

      return;

    } catch {

      localStorage.removeItem(
        'token'
      );

      state.user = null;

    }

  }

  render();
}

/* =========================
   TIMER
========================= */

setInterval(
  () => {

    if (
      state.page === 'home' &&
      state.game
    ) {

      state.game.secondsLeft =
        Math.max(
          0,
          Number(
            state.game.secondsLeft
          ) - 1
        );

      const timer =
        $('.timer');

      if (timer) {

        timer.textContent =
          formatTime(
            state.game.secondsLeft
          );

      }

      if (
        state.game.secondsLeft ===
        0
      ) {

        loadGame();

      }

    }

  },
  1000
);

start();
