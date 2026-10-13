/**
 * PULSE GYM - Frontend Single Page Application
 * Features:
 * - Client-side router with route guards
 * - Optimistic instant booking with automatic rollback
 * - Live polling for real-time seat counts (4s cadence)
 * - Live check-in countdown timer (1s interval)
 * - Standalone SVG QR code generator
 * - Web Audio API feedback synthesizer
 * - Inline form validation & accessible text error messages
 */

// ============================================================================
// State Management & Constants
// ============================================================================
let savedUser = null;
try {
  const rawUser = localStorage.getItem("pulse_user");
  if (rawUser && rawUser !== "undefined" && rawUser !== "null") {
    savedUser = JSON.parse(rawUser);
  }
} catch (_) {
  savedUser = null;
}

const state = {
  token: localStorage.getItem("pulse_token") || null,
  user: savedUser,
  sessions: [],
  selectedDate: null,
  filterStatus: "all",
  pollingTimer: null,
  countdownTimer: null,
  adminRosterSessionId: null
};

// ============================================================================
// Web Audio Synthesizer (Zero-asset audio feedback)
// ============================================================================
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem("pulse_sound") !== "false";
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("pulse_sound", this.enabled ? "true" : "false");
    this.updateUI();
    return this.enabled;
  }

  updateUI() {
    const btn = document.getElementById("btn-sound-toggle");
    const label = document.getElementById("sound-toggle-label");
    if (btn && label) {
      if (this.enabled) {
        btn.classList.remove("muted");
        label.textContent = "Sound: ON";
      } else {
        btn.classList.add("muted");
        label.textContent = "Sound: OFF";
      }
    }
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playClick() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const now = this.ctx.currentTime;
      // High harmonic dual chime
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      osc2.frequency.setValueAtTime(880, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.15);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.45);
    } catch (_) {}
  }

  playError() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.1);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }
}
const sounds = new SoundEffects();

// ============================================================================
// Toast Notification System
// ============================================================================
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "alert");

  const icon = type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️";
  toast.innerHTML = `
    <span style="font-weight: 800; font-size: 1.1rem;">${icon}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
    <button type="button" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem;" aria-label="Close">&times;</button>
  `;

  toast.querySelector("button").addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  if (type === "success") sounds.playSuccess();
  if (type === "error") sounds.playError();

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => toast.remove(), 200);
    }
  }, duration);
}

// ============================================================================
// Real ISO/IEC 18004 Standard QR Code Generator Interface
// Connects to window.QRCodeEngine (pure JS, offline compliant, smartphone scannable)
// ============================================================================
function generateQRCodeSVG(text, size = 180) {
  if (window.QRCodeEngine && typeof window.QRCodeEngine.generateSVG === "function") {
    return window.QRCodeEngine.generateSVG(text, {
      size: size,
      margin: 2,
      darkColor: "#070b12",
      lightColor: "#ffffff"
    });
  }
  // Safe SVG fallback
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="border-radius: 8px; background: white; padding: 6px;">
    <rect width="${size}" height="${size}" fill="#fff"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#000" font-family="sans-serif">QR Loading...</text>
  </svg>`;
}

// ============================================================================
// API Client Layer
// ============================================================================
async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Structured error response
      const err = new Error(data.message || data.error || `HTTP error ${response.status}`);
      err.status = response.status;
      err.code = data.code || "UNKNOWN_ERROR";
      err.details = data.details;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.status === 401 && state.token) {
      // Token expired or invalid
      logout(false);
      showToast("Session expired. Please log in again.", "info");
    }
    throw error;
  }
}

// ============================================================================
// Authentication & Session Management
// ============================================================================
function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("pulse_token", token);
  localStorage.setItem("pulse_user", JSON.stringify(user));
  updateNavUserUI();
}

function logout(notify = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem("pulse_token");
  localStorage.removeItem("pulse_user");
  stopPolling();
  updateNavUserUI();
  navigateTo("#login");
  if (notify) {
    showToast("You have been logged out.", "info");
  }
}

function updateNavUserUI() {
  const navUserPanel = document.getElementById("nav-user-panel");
  const navSessions = document.getElementById("nav-item-sessions");
  const navMyBookings = document.getElementById("nav-item-my-bookings");
  const navAdmin = document.getElementById("nav-item-admin");

  // Highlight active demo persona chip if logged in
  document.querySelectorAll(".demo-chip").forEach(chip => {
    if (state.user && chip.getAttribute("data-email") === state.user.email) {
      chip.classList.add("active-user");
    } else {
      chip.classList.remove("active-user");
    }
  });

  if (!state.token || !state.user) {
    navSessions.classList.add("hidden");
    navMyBookings.classList.add("hidden");
    navAdmin.classList.add("hidden");
    navUserPanel.innerHTML = `
      <a href="#login" class="btn btn-primary btn-sm">Log In</a>
    `;
    return;
  }

  // Show member links
  navSessions.classList.remove("hidden");
  navMyBookings.classList.remove("hidden");

  // Show or hide admin link based on role
  if (state.user.role === "admin") {
    navAdmin.classList.remove("hidden");
  } else {
    navAdmin.classList.add("hidden");
  }

  navUserPanel.innerHTML = `
    <div class="user-badge">
      <span class="user-name">${escapeHtml(state.user.name)}</span>
      <span class="user-role ${state.user.role === 'admin' ? 'admin' : ''}">${state.user.role}</span>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" id="btn-logout" title="Log Out">Log Out</button>
  `;

  document.getElementById("btn-logout")?.addEventListener("click", () => logout(true));
}

// ============================================================================
// Client-Side Routing & Route Guard
// ============================================================================
const routes = {
  "#login": renderAuthView,
  "#sessions": renderSessionsView,
  "#my-bookings": renderMyBookingsView,
  "#admin": renderAdminView
};

function navigateTo(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    handleRouting();
  }
}

function handleRouting() {
  let hash = window.location.hash || "#sessions";

  // Route Guard: Authentication checks
  if (!state.token) {
    hash = "#login";
  } else if (hash === "#login") {
    hash = "#sessions";
  } else if (hash === "#admin" && state.user?.role !== "admin") {
    // "A member cannot open the admin page."
    showToast("Access forbidden: Admin privilege required.", "error");
    hash = "#sessions";
  }

  if (window.location.hash !== hash) {
    window.location.hash = hash;
    return;
  }

  // Highlight active nav item
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === hash);
  });

  // Hide all view pages
  document.querySelectorAll(".page-view").forEach(view => {
    view.style.display = "none";
  });

  // Stop polling if navigating away from sessions
  if (hash !== "#sessions") {
    stopPolling();
  }

  // Render view
  const renderFn = routes[hash] || renderSessionsView;
  renderFn();
}

// ============================================================================
// Page 1: Auth View (Login & Register)
// ============================================================================
function renderAuthView() {
  const view = document.getElementById("view-auth");
  view.style.display = "block";
  hideAuthErrors();
}

function setupAuthEventListeners() {
  const tabLogin = document.getElementById("tab-btn-login");
  const tabRegister = document.getElementById("tab-btn-register");
  const formLogin = document.getElementById("auth-form-login");
  const formRegister = document.getElementById("auth-form-register");

  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    formLogin.style.display = "block";
    formRegister.style.display = "none";
    hideAuthErrors();
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    formLogin.style.display = "none";
    formRegister.style.display = "block";
    hideAuthErrors();
  });

  // Login submission
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthErrors();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("btn-login-submit");

    // Inline validation
    let valid = true;
    if (!email || !email.includes("@")) {
      showInputError("login-email-error", "Please enter a valid email address.");
      valid = false;
    }
    if (!password) {
      showInputError("login-password-error", "Password is required.");
      valid = false;
    }
    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width: 18px; height: 18px; border-width: 2px;"></span> Logging in...`;

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setAuth(data.token, data.user);
      showToast(`Welcome back, ${data.user.name}!`, "success");
      navigateTo(data.user.role === "admin" ? "#admin" : "#sessions");
    } catch (err) {
      showAuthErrorBanner(err.message || "Invalid email or password.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Log In";
    }
  });

  // Register submission
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthErrors();

    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const btn = document.getElementById("btn-reg-submit");

    let valid = true;
    if (!name || name.length < 2) {
      showInputError("reg-name-error", "Name must be at least 2 characters.");
      valid = false;
    }
    if (!email || !email.includes("@")) {
      showInputError("reg-email-error", "Please enter a valid email address.");
      valid = false;
    }
    if (!password || password.length < 6) {
      showInputError("reg-password-error", "Password must be at least 6 characters.");
      valid = false;
    }
    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width: 18px; height: 18px; border-width: 2px;"></span> Registering...`;

    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      setAuth(data.token, data.user);
      showToast("Registration successful! Welcome to PULSE GYM.", "success");
      navigateTo("#sessions");
    } catch (err) {
      showAuthErrorBanner(err.message || "Registration failed.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Create Member Account";
    }
  });

  // Quick Demo Persona switcher chips
  document.querySelectorAll(".demo-chip").forEach(chip => {
    chip.addEventListener("click", async () => {
      const email = chip.getAttribute("data-email");
      const pass = chip.getAttribute("data-pass");
      try {
        const data = await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password: pass })
        });
        setAuth(data.token, data.user);
        showToast(`Switched persona to: ${data.user.name} (${data.user.role})`, "success");
        navigateTo(data.user.role === "admin" ? "#admin" : "#sessions");
      } catch (err) {
        showToast(`Demo login error: ${err.message}`, "error");
      }
    });
  });
}

function showInputError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.add("visible");
  }
}

function hideAuthErrors() {
  document.querySelectorAll(".form-error").forEach(el => el.classList.remove("visible"));
  const banner = document.getElementById("auth-error-banner");
  if (banner) banner.style.display = "none";
}

function showAuthErrorBanner(message) {
  const banner = document.getElementById("auth-error-banner");
  const text = document.getElementById("auth-error-text");
  if (banner && text) {
    text.textContent = message;
    banner.style.display = "flex";
  }
}

// ============================================================================
// Page 2: Sessions List View (with Optimistic UI & Polling)
// ============================================================================
async function renderSessionsView() {
  const view = document.getElementById("view-sessions");
  view.style.display = "block";

  await fetchSessions(false);
  startPolling();
}

async function fetchSessions(isPolling = false) {
  const loading = document.getElementById("sessions-loading");
  const errorBox = document.getElementById("sessions-error");
  const emptyBox = document.getElementById("sessions-empty");
  const container = document.getElementById("sessions-container");

  if (!isPolling) {
    loading.style.display = "flex";
    errorBox.style.display = "none";
    emptyBox.style.display = "none";
  }

  try {
    let url = "/api/sessions";
    if (state.selectedDate) {
      url += `?date=${encodeURIComponent(state.selectedDate)}`;
    }
    const data = await apiRequest(url);
    state.sessions = data.sessions || [];

    loading.style.display = "none";
    errorBox.style.display = "none";

    renderSessionsCards();
  } catch (err) {
    loading.style.display = "none";
    if (!isPolling && state.token) {
      errorBox.style.display = "flex";
      document.getElementById("sessions-error-msg").textContent = err.message || "Failed to load sessions.";
    }
  }
}

function renderSessionsCards() {
  const container = document.getElementById("sessions-container");
  const emptyBox = document.getElementById("sessions-empty");

  // Apply filter status
  let filtered = state.sessions;
  if (state.filterStatus === "available") {
    filtered = filtered.filter(s => s.seats_remaining > 0);
  } else if (state.filterStatus === "full") {
    filtered = filtered.filter(s => s.seats_remaining === 0);
  }

  if (filtered.length === 0) {
    emptyBox.style.display = "block";
    container.innerHTML = "";
    return;
  }

  emptyBox.style.display = "none";

  const nowIso = new Date().toISOString();

  container.innerHTML = filtered.map(session => {
    const isBooked = session.is_booked_by_user;
    const isWaitlisted = session.is_waitlisted_by_user;
    const isFull = session.is_full;
    const hasStarted = session.has_started;
    const hasEnded = session.has_ended;
    const seatsLeft = session.seats_remaining;
    const percent = Math.min(100, Math.round((session.confirmed_count / session.capacity) * 100));

    const todayStr = getTodayISO();
    const currentHour = new Date().getHours();
    const isHappeningNow = session.date === todayStr && session.start_hour === currentHour;

    // Card status classes
    const cardClass = [
      "session-card",
      isHappeningNow ? "active-now" : "",
      isBooked ? "booked" : "",
      isWaitlisted ? "waitlisted" : "",
      isFull ? "full-session" : ""
    ].filter(Boolean).join(" ");

    // Action button logic
    let actionHtml = "";
    if (hasEnded) {
      actionHtml = `<button class="btn btn-secondary btn-sm" disabled>Session Ended</button>`;
    } else if (hasStarted) {
      actionHtml = `<button class="btn btn-secondary btn-sm" disabled>In Progress</button>`;
    } else if (isBooked) {
      actionHtml = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-confirmed">✓ Booked</span>
          <a href="#my-bookings" class="btn btn-secondary btn-sm">View Ticket</a>
        </div>
      `;
    } else if (isWaitlisted) {
      actionHtml = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-waitlist">Waitlist #${session.user_waitlist_position || 1}</span>
          <button class="btn btn-danger btn-sm btn-leave-waitlist" data-session-id="${session.id}">Leave</button>
        </div>
      `;
    } else if (isFull) {
      actionHtml = `
        <button class="btn btn-secondary btn-sm btn-join-waitlist" data-session-id="${session.id}">
          Join Waitlist (${session.waitlist_count} waiting)
        </button>
      `;
    } else {
      // Free seats available
      actionHtml = `
        <button class="btn btn-primary btn-sm btn-book" data-session-id="${session.id}" data-seats="${seatsLeft}">
          Book Seat (${seatsLeft} free)
        </button>
      `;
    }

    const timeFormatted = `${String(session.start_hour).padStart(2, "0")}:00 - ${String((session.start_hour + 1) % 24).padStart(2, "0")}:00`;

    return `
      <article class="${cardClass}" id="session-card-${session.id}">
        <div>
          <div class="session-header">
            <div>
              <div class="session-time">
                <span>⏱️</span>
                <span>${timeFormatted}</span>
              </div>
              <div class="session-date">${formatDate(session.date)}</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
              ${isHappeningNow ? `<span class="badge badge-live">🔥 Active Now</span>` : ""}
              ${
                isBooked
                  ? `<span class="badge badge-confirmed">Booked</span>`
                  : isWaitlisted
                  ? `<span class="badge badge-waitlist">Waitlist #${session.user_waitlist_position}</span>`
                  : isFull
                  ? `<span class="badge badge-full">Sold Out</span>`
                  : `<span class="badge badge-confirmed">${seatsLeft} Seats Open</span>`
              }
            </div>
          </div>

          <!-- Capacity Meter -->
          <div class="capacity-box">
            <div class="capacity-info">
              <span class="seats-count ${seatsLeft === 0 ? 'zero' : seatsLeft <= 3 ? 'low' : ''}">
                ${session.confirmed_count} / ${session.capacity} Booked
              </span>
              <span style="color: var(--text-muted); font-size: 0.8rem;">
                ${seatsLeft === 0 ? 'Waitlist Open' : `${seatsLeft} available`}
              </span>
            </div>
            <div class="capacity-track">
              <div class="capacity-fill ${percent >= 100 ? 'full' : percent >= 80 ? 'high' : ''}" style="width: ${percent}%;"></div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            ${session.waitlist_count > 0 ? `<span>⏳ ${session.waitlist_count} on waitlist</span>` : `<span>⚡ Instant confirmation</span>`}
          </div>
          <div class="session-actions" id="session-actions-${session.id}">
            ${actionHtml}
          </div>
        </div>
      </article>
    `;
  }).join("");

  attachSessionButtonListeners();
}

function attachSessionButtonListeners() {
  // 1. Optimistic Booking Action
  document.querySelectorAll(".btn-book").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sessionId = parseInt(btn.getAttribute("data-session-id"), 10);
      const session = state.sessions.find(s => s.id === sessionId);
      if (!session) return;

      // Optimistic UI Update:
      // "Booking feels instant: the seat count updates straight away and rolls back if the server refuses."
      const prevSeats = session.seats_remaining;
      const prevConfirmed = session.confirmed_count;
      const prevIsBooked = session.is_booked_by_user;

      // Optimistically decrement seats and mark booked
      session.seats_remaining = Math.max(0, session.seats_remaining - 1);
      session.confirmed_count = session.confirmed_count + 1;
      session.is_booked_by_user = true;
      session.is_full = session.seats_remaining <= 0;

      // Re-render UI immediately
      renderSessionsCards();

      showToast("Reserving your seat...", "info", 1500);

      try {
        const response = await apiRequest(`/api/sessions/${sessionId}/book`, {
          method: "POST"
        });

        // Confirmation
        session.user_booking_id = response.booking.id;
        session.user_check_in_code = response.booking.check_in_code;
        showToast("Seat confirmed! Check-in code generated.", "success");
        renderSessionsCards();
      } catch (err) {
        // Rollback on server refusal!
        session.seats_remaining = prevSeats;
        session.confirmed_count = prevConfirmed;
        session.is_booked_by_user = prevIsBooked;
        session.is_full = prevSeats <= 0;
        renderSessionsCards();

        showToast(err.message || "Booking failed. Reverting seats.", "error", 5000);
      }
    });
  });

  // 2. Join Waitlist Action
  document.querySelectorAll(".btn-join-waitlist").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sessionId = parseInt(btn.getAttribute("data-session-id"), 10);
      btn.disabled = true;
      btn.textContent = "Joining...";

      try {
        const data = await apiRequest(`/api/sessions/${sessionId}/waitlist`, {
          method: "POST"
        });
        showToast(`Added to waitlist! Position: #${data.waitlist.position}`, "success");
        await fetchSessions(true);
      } catch (err) {
        showToast(err.message || "Could not join waitlist.", "error");
        btn.disabled = false;
        btn.textContent = "Join Waitlist";
      }
    });
  });

  // 3. Leave Waitlist Action
  document.querySelectorAll(".btn-leave-waitlist").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sessionId = parseInt(btn.getAttribute("data-session-id"), 10);
      btn.disabled = true;

      try {
        await apiRequest(`/api/sessions/${sessionId}/waitlist`, {
          method: "DELETE"
        });
        showToast("You have left the waitlist.", "info");
        await fetchSessions(true);
      } catch (err) {
        showToast(err.message || "Could not leave waitlist.", "error");
        btn.disabled = false;
      }
    });
  });
}

function setupSessionsFilterListeners() {
  const filterDate = document.getElementById("filter-date");
  const filterStatus = document.getElementById("filter-status");
  const btnToday = document.getElementById("btn-today");
  const btnTomorrow = document.getElementById("btn-tomorrow");
  const btnClearDate = document.getElementById("btn-clear-date");
  const btnRetry = document.getElementById("btn-retry-sessions");

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

  filterDate.addEventListener("change", (e) => {
    state.selectedDate = e.target.value || null;
    fetchSessions();
  });

  filterStatus.addEventListener("change", (e) => {
    state.filterStatus = e.target.value;
    renderSessionsCards();
  });

  btnToday.addEventListener("click", () => {
    filterDate.value = todayStr;
    state.selectedDate = todayStr;
    fetchSessions();
  });

  btnTomorrow.addEventListener("click", () => {
    filterDate.value = tomorrowStr;
    state.selectedDate = tomorrowStr;
    fetchSessions();
  });

  btnClearDate.addEventListener("click", () => {
    filterDate.value = "";
    state.selectedDate = null;
    fetchSessions();
  });

  btnRetry.addEventListener("click", () => {
    fetchSessions();
  });
}

// Background Polling for Live Seat Updates (4 second interval)
function startPolling() {
  stopPolling();
  state.pollingTimer = setInterval(() => {
    // Only poll if document is visible and user is on sessions page
    if (document.visibilityState === "visible" && window.location.hash === "#sessions") {
      fetchSessions(true);
    }
  }, 4000);
}

function stopPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

// ============================================================================
// Page 3: My Bookings & Waitlist View
// ============================================================================
async function renderMyBookingsView() {
  const view = document.getElementById("view-my-bookings");
  view.style.display = "block";

  const loading = document.getElementById("my-bookings-loading");
  const errorBox = document.getElementById("my-bookings-error");
  const content = document.getElementById("my-bookings-content");

  loading.style.display = "flex";
  errorBox.style.display = "none";
  content.style.display = "none";

  try {
    const data = await apiRequest("/api/my-bookings");
    loading.style.display = "none";
    content.style.display = "block";

    renderMyConfirmedList(data.bookings || []);
    renderMyWaitlist(data.waitlist || []);
    startCountdownUpdater();
  } catch (err) {
    loading.style.display = "none";
    errorBox.style.display = "flex";
    document.getElementById("my-bookings-error-msg").textContent = err.message || "Failed to load bookings.";
  }
}

function renderMyConfirmedList(bookings) {
  const container = document.getElementById("my-confirmed-list");

  if (bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No bookings yet</h3>
        <p>You haven't booked any sessions yet. Browse available slots to reserve your training hour.</p>
        <a href="#sessions" class="btn btn-primary btn-sm" style="margin-top: 14px;">Browse Sessions</a>
      </div>
    `;
    return;
  }

  container.innerHTML = bookings.map(b => {
    const isLive = b.is_check_in_open;
    const isCheckedIn = b.checked_in_at !== null;
    const isCancelled = b.status === "cancelled";
    const canCancel = b.can_cancel;

    const timeFormatted = `${String(b.start_hour).padStart(2, "0")}:00 - ${String((b.start_hour + 1) % 24).padStart(2, "0")}:00`;

    return `
      <article class="ticket-card ${isLive ? 'live-window' : ''}" id="booking-ticket-${b.id}" data-start="${b.start_time}" data-end="${b.end_time}">
        <div class="ticket-details">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            ${
              isCheckedIn
                ? `<span class="badge badge-confirmed">✓ Checked In at Door</span>`
                : isCancelled
                ? `<span class="badge badge-full">Cancelled</span>`
                : isLive
                ? `<span class="badge badge-live">● Check-in Open Now</span>`
                : b.has_ended
                ? `<span class="badge badge-full">Session Completed</span>`
                : `<span class="badge badge-confirmed">Confirmed Seat</span>`
            }
            <span style="font-size: 0.85rem; color: var(--text-muted);">${formatDate(b.date)}</span>
          </div>

          <h3 class="ticket-title">${timeFormatted} Gym Session</h3>
          <p class="ticket-time">1-Hour High Intensity Block • 20 Person Cap</p>

          <!-- Real-time Countdown Banner -->
          <div class="countdown-banner ${isLive ? 'open-now' : b.has_ended ? 'passed' : 'upcoming'}" id="countdown-${b.id}">
            Calculating window...
          </div>

          <!-- Cancellation Button -->
          ${
            canCancel
              ? `
              <div style="margin-top: 10px;">
                <button type="button" class="btn btn-danger btn-sm btn-cancel-booking" data-booking-id="${b.id}">
                  Cancel Booking
                </button>
                <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 8px;">
                  (First person on waitlist will be promoted automatically)
                </span>
              </div>
              `
              : ""
          }
        </div>

        <!-- Check-in Code Display Panel -->
        <div class="ticket-code-panel">
          <span class="ticket-code-label">Door Access Code</span>
          <div class="ticket-code">${escapeHtml(b.check_in_code)}</div>
          <button type="button" class="qr-preview btn-view-qr" data-code="${b.check_in_code}" data-date="${b.session_date}" data-hour="${b.session_start_hour}" title="View Scannable QR Ticket">
            ${generateQRCodeSVG(b.check_in_code, 74)}
            <span style="display: block; font-size: 0.65rem; color: #070b12; font-weight: 800; margin-top: 3px;">Open Pass</span>
          </button>
        </div>
      </article>
    `;
  }).join("");

  // Attach cancel listeners
  document.querySelectorAll(".btn-cancel-booking").forEach(btn => {
    btn.addEventListener("click", async () => {
      const bookingId = btn.getAttribute("data-booking-id");
      if (!confirm("Are you sure you want to cancel this booking? The first waitlisted member will be automatically booked in your place.")) {
        return;
      }

      btn.disabled = true;
      btn.textContent = "Cancelling...";

      try {
        const res = await apiRequest(`/api/bookings/${bookingId}`, {
          method: "DELETE"
        });

        if (res.promoted_waitlist_member) {
          showToast(`Booking cancelled. Waitlisted member ${res.promoted_waitlist_member.name} was automatically promoted!`, "success", 5000);
        } else {
          showToast("Booking cancelled successfully.", "info");
        }

        renderMyBookingsView();
      } catch (err) {
        showToast(err.message || "Failed to cancel booking.", "error");
        btn.disabled = false;
        btn.textContent = "Cancel Booking";
      }
    });
  });

  // Attach QR code view listeners
  document.querySelectorAll(".btn-view-qr").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      const date = btn.getAttribute("data-date");
      const hour = btn.getAttribute("data-hour");
      openQRModal(code, {
        userName: state.user?.name,
        date: date,
        time: hour ? `${String(hour).padStart(2, "0")}:00` : ""
      });
    });
  });
}

function renderMyWaitlist(waitlist) {
  const container = document.getElementById("my-waitlist-list");

  if (waitlist.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 18px; color: var(--text-muted); font-size: 0.9rem;">
        You are not currently on any session waitlists.
      </div>
    `;
    return;
  }

  container.innerHTML = waitlist.map(w => {
    const timeFormatted = `${String(w.start_hour).padStart(2, "0")}:00 - ${String((w.start_hour + 1) % 24).padStart(2, "0")}:00`;

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="badge badge-waitlist">Position #${w.position} in line</span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">${formatDate(w.date)}</span>
          </div>
          <h4 style="font-size: 1.1rem; margin-top: 4px;">${timeFormatted} Session</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
            Joined: ${new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Auto-promotion active until session start
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-leave-waitlist-page" data-waitlist-id="${w.id}">
          Leave Waitlist
        </button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".btn-leave-waitlist-page").forEach(btn => {
    btn.addEventListener("click", async () => {
      const wId = btn.getAttribute("data-waitlist-id");
      btn.disabled = true;
      try {
        await apiRequest(`/api/waitlist/${wId}`, { method: "DELETE" });
        showToast("Removed from waitlist.", "info");
        renderMyBookingsView();
      } catch (err) {
        showToast(err.message || "Failed to leave waitlist.", "error");
        btn.disabled = false;
      }
    });
  });
}

// Live Countdown Updater (recalculates every second)
function startCountdownUpdater() {
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  function update() {
    const now = new Date();
    document.querySelectorAll(".ticket-card").forEach(card => {
      const startIso = card.getAttribute("data-start");
      const endIso = card.getAttribute("data-end");
      const bookingId = card.id.replace("booking-ticket-", "");
      const banner = document.getElementById(`countdown-${bookingId}`);
      if (!banner || !startIso || !endIso) return;

      const startTime = new Date(startIso);
      const endTime = new Date(endIso);

      if (now < startTime) {
        const diffMs = startTime - now;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

        banner.className = "countdown-banner upcoming";
        banner.innerHTML = `⏱️ Check-in window opens in <strong>${diffHrs}h ${diffMins}m ${diffSecs}s</strong>`;
      } else if (now >= startTime && now <= endTime) {
        const leftMs = endTime - now;
        const leftMins = Math.floor(leftMs / (1000 * 60));
        const leftSecs = Math.floor((leftMs % (1000 * 60)) / 1000);

        banner.className = "countdown-banner open-now";
        banner.innerHTML = `🟢 <strong>CHECK-IN OPEN NOW!</strong> Closes in ${leftMins}m ${leftSecs}s`;
      } else {
        banner.className = "countdown-banner passed";
        banner.innerHTML = `🏁 Session completed`;
      }
    });
  }

  update();
  state.countdownTimer = setInterval(update, 1000);
}

// QR Modal & VIP Pass Handlers
function openQRModal(code, sessionInfo = null) {
  const modal = document.getElementById("qr-modal");
  const codeEl = document.getElementById("qr-modal-code");
  const wrapper = document.getElementById("qr-svg-wrapper");
  const subEl = document.getElementById("qr-modal-subtitle");

  state.currentQRModalCode = code;
  codeEl.textContent = code;

  if (subEl) {
    if (sessionInfo) {
      subEl.innerHTML = `Valid for <strong>${escapeHtml(sessionInfo.userName || state.user?.name || "Member")}</strong> • Session on <strong>${sessionInfo.date || ""} at ${sessionInfo.time || ""}</strong>`;
    } else {
      subEl.textContent = "Scan with your smartphone camera or turnstile reader during your 1-hour session window:";
    }
  }

  // Generate ISO/IEC 18004 Standard compliant QR Code (210px)
  wrapper.innerHTML = generateQRCodeSVG(code, 210);
  modal.classList.add("open");
  sounds.playClick();
}

function closeQRModal() {
  const modal = document.getElementById("qr-modal");
  modal.classList.remove("open");
}

function downloadPassTicket(code) {
  if (!window.QRCodeEngine) {
    showToast("QR Engine loading...", "info");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");

  // Dark background with gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 560);
  bgGrad.addColorStop(0, "#101827");
  bgGrad.addColorStop(1, "#070b12");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 420, 560);

  // Top Neon Accent Bar
  const barGrad = ctx.createLinearGradient(0, 0, 420, 0);
  barGrad.addColorStop(0, "#00f076");
  barGrad.addColorStop(1, "#00e5ff");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, 420, 6);

  // Border
  ctx.strokeStyle = "rgba(0, 240, 118, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 400, 540);

  // Header Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PULSE GYM // VIP PASS", 210, 48);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px sans-serif";
  ctx.fillText("Guaranteed 20-Person Max Capacity Slot", 210, 70);

  // Member & Pass Info
  ctx.fillStyle = "#00f076";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(`MEMBER: ${state.user?.name || "VIP Member"}`, 210, 100);

  // Render QR Code onto temporary canvas
  const qrCanvas = document.createElement("canvas");
  window.QRCodeEngine.renderToCanvas(qrCanvas, code, {
    size: 240,
    margin: 2,
    darkColor: "#070b12",
    lightColor: "#ffffff"
  });

  // White Card backing for QR
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(80, 125, 260, 260, 12);
  } else {
    ctx.rect(80, 125, 260, 260);
  }
  ctx.fill();

  ctx.drawImage(qrCanvas, 90, 135, 240, 240);

  // Access Code Box
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(40, 410, 340, 64);
  ctx.strokeStyle = "rgba(0, 240, 118, 0.4)";
  ctx.strokeRect(40, 410, 340, 64);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px sans-serif";
  ctx.fillText("DOOR CHECK-IN CODE", 210, 430);

  ctx.fillStyle = "#00f076";
  ctx.font = "bold 28px monospace";
  ctx.fillText(code, 210, 460);

  // Footer Note
  ctx.fillStyle = "#64748b";
  ctx.font = "10px sans-serif";
  ctx.fillText("Valid once only during session 1-hour window.", 210, 508);
  ctx.fillText("https://github.com/Aakarshan2204/gym-slot-booking", 210, 526);

  // Download Trigger
  const link = document.createElement("a");
  link.download = `pulse-pass-${code}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast(`VIP Door Pass saved to downloads!`, "success");
  sounds.playSuccess();
}

// ============================================================================
// Page 4: Admin Dashboard View
// ============================================================================
async function renderAdminView() {
  const view = document.getElementById("view-admin");
  view.style.display = "block";

  await loadAdminStats();
  await loadAdminSessionOptions();
}

async function loadAdminStats() {
  try {
    const stats = await apiRequest("/api/admin/stats");
    document.getElementById("stat-sessions").textContent = stats.total_sessions;
    document.getElementById("stat-confirmed").textContent = stats.total_confirmed_bookings;
    document.getElementById("stat-checked-in").textContent = stats.total_checked_in;
    document.getElementById("stat-waitlist").textContent = stats.active_waitlist_members;
    document.getElementById("stat-attendance-rate").textContent = `${stats.attendance_rate}% attendance rate • ${stats.utilization_rate}% capacity util`;
  } catch (_) {}
}

async function loadAdminSessionOptions() {
  const select = document.getElementById("admin-roster-session-select");
  try {
    const data = await apiRequest("/api/sessions");
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      select.innerHTML = `<option value="">No sessions available</option>`;
      return;
    }

    select.innerHTML = sessions.map(s => {
      const time = `${String(s.start_hour).padStart(2, "0")}:00`;
      return `<option value="${s.id}">${s.date} @ ${time} (${s.confirmed_count}/${s.capacity} booked)</option>`;
    }).join("");

    if (!state.adminRosterSessionId && sessions.length > 0) {
      state.adminRosterSessionId = sessions[0].id;
    }

    select.value = state.adminRosterSessionId;
    loadSessionRoster(state.adminRosterSessionId);
  } catch (_) {}
}

async function loadSessionRoster(sessionId) {
  const content = document.getElementById("admin-roster-content");
  const loading = document.getElementById("admin-roster-loading");

  if (!sessionId) return;
  loading.style.display = "flex";
  content.innerHTML = "";

  try {
    const data = await apiRequest(`/api/admin/sessions/${sessionId}/roster`);
    loading.style.display = "none";

    const bookings = data.bookings || [];
    const waitlist = data.waitlist || [];
    const stats = data.stats;

    content.innerHTML = `
      <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
        <span class="badge badge-confirmed">Confirmed: ${stats.confirmed_count} / ${stats.capacity}</span>
        <span class="badge badge-live">Checked In: ${stats.checked_in_count}</span>
        <span class="badge badge-waitlist">Waitlist: ${stats.waitlist_count}</span>
      </div>

      <h4 style="font-size: 1rem; margin-top: 14px; margin-bottom: 8px;">Attendee Roster</h4>
      ${
        bookings.length === 0
          ? `<p style="color: var(--text-muted); font-size: 0.85rem;">No members have booked this session yet.</p>`
          : `
          <table class="roster-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Email</th>
                <th>Check-in Code</th>
                <th>Door Status</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(b => `
                <tr>
                  <td style="font-weight: 600;">${escapeHtml(b.user_name)}</td>
                  <td style="color: var(--text-secondary);">${escapeHtml(b.user_email)}</td>
                  <td><code style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-lime);">${escapeHtml(b.check_in_code)}</code></td>
                  <td>
                    ${
                      b.checked_in_at
                        ? `<span class="badge badge-confirmed">✓ Present (${new Date(b.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>`
                        : b.status === "cancelled"
                        ? `<span class="badge badge-full">Cancelled</span>`
                        : `<button type="button" class="btn-quick-checkin" data-code="${b.check_in_code}">⚡ Check In</button>`
                    }
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          `
      }

      <h4 style="font-size: 1rem; margin-top: 24px; margin-bottom: 8px;">Waitlist Standby Queue</h4>
      ${
        waitlist.length === 0
          ? `<p style="color: var(--text-muted); font-size: 0.85rem;">Waitlist is empty.</p>`
          : `
          <table class="roster-table">
            <thead>
              <tr>
                <th>Queue Position</th>
                <th>Member Name</th>
                <th>Email</th>
                <th>Joined At</th>
              </tr>
            </thead>
            <tbody>
              ${waitlist.map(w => `
                <tr>
                  <td><span class="badge badge-waitlist">#${w.position} in line</span></td>
                  <td style="font-weight: 600;">${escapeHtml(w.user_name)}</td>
                  <td style="color: var(--text-secondary);">${escapeHtml(w.user_email)}</td>
                  <td style="color: var(--text-muted); font-size: 0.85rem;">${new Date(w.created_at).toLocaleTimeString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          `
      }
    `;

    // Attach quick check-in button listeners
    content.querySelectorAll(".btn-quick-checkin").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-code");
        const input = document.getElementById("admin-checkin-code");
        if (input) {
          input.value = code;
          sounds.playClick();
          document.getElementById("admin-checkin-form")?.requestSubmit();
        }
      });
    });
  } catch (err) {
    loading.style.display = "none";
    content.innerHTML = `<p style="color: #fb7185;">Failed to load roster: ${escapeHtml(err.message)}</p>`;
  }
}

function setupAdminEventListeners() {
  const formCheckin = document.getElementById("admin-checkin-form");
  const formCreateSession = document.getElementById("admin-create-session-form");
  const rosterSelect = document.getElementById("admin-roster-session-select");

  // Default new session date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById("new-session-date");
  if (dateInput) dateInput.value = tomorrow.toISOString().split("T")[0];

  // 1. Check-In Submission
  formCheckin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById("admin-checkin-code");
    const errorEl = document.getElementById("admin-checkin-error");
    const successBox = document.getElementById("checkin-success-box");
    const btn = document.getElementById("btn-checkin-submit");

    errorEl.classList.remove("visible");
    successBox.style.display = "none";

    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
      errorEl.textContent = "Please enter a valid code.";
      errorEl.classList.add("visible");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Validating...`;

    try {
      const res = await apiRequest("/api/admin/check-in", {
        method: "POST",
        body: JSON.stringify({ code })
      });

      // Show confirmed details
      document.getElementById("checkin-member-name").textContent = `✓ ${res.check_in.member.name} Marked Present!`;
      document.getElementById("checkin-member-details").textContent = `${res.check_in.member.email} • Session on ${res.check_in.session.date} at ${String(res.check_in.session.start_hour).padStart(2, "0")}:00`;
      successBox.style.display = "block";

      showToast(`Access granted for ${res.check_in.member.name}!`, "success");
      codeInput.value = "";

      // Refresh stats & current roster
      loadAdminStats();
      if (state.adminRosterSessionId) {
        loadSessionRoster(state.adminRosterSessionId);
      }
    } catch (err) {
      errorEl.textContent = err.message || "Invalid check-in code.";
      errorEl.classList.add("visible");
      showToast(err.message || "Check-in failed.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Mark Present";
    }
  });

  // 2. Create Session Submission
  formCreateSession.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("new-session-date").value;
    const hour = parseInt(document.getElementById("new-session-hour").value, 10);
    const capacity = parseInt(document.getElementById("new-session-capacity").value, 10) || 20;
    const btn = document.getElementById("btn-create-session-submit");

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Creating...`;

    try {
      await apiRequest("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ date, start_hour: hour, capacity })
      });

      showToast(`New session created for ${date} at ${String(hour).padStart(2, "0")}:00!`, "success");
      loadAdminStats();
      loadAdminSessionOptions();
    } catch (err) {
      showToast(err.message || "Failed to create session.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "+ Create Session";
    }
  });

  // 3. Roster Selection change
  rosterSelect.addEventListener("change", (e) => {
    state.adminRosterSessionId = parseInt(e.target.value, 10);
    loadSessionRoster(state.adminRosterSessionId);
  });
}

// ============================================================================
// Utilities
// ============================================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (_) {}
  return dateStr;
}

// ============================================================================
// Application Bootstrap
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  sounds.updateUI();
  updateNavUserUI();
  setupAuthEventListeners();
  setupSessionsFilterListeners();
  setupAdminEventListeners();

  // Sound toggle listener
  document.getElementById("btn-sound-toggle")?.addEventListener("click", () => {
    sounds.toggle();
    sounds.playClick();
  });

  // QR Modal close listener
  document.getElementById("qr-modal-close")?.addEventListener("click", closeQRModal);
  document.getElementById("qr-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "qr-modal") closeQRModal();
  });

  // QR Modal Action Buttons
  document.getElementById("btn-copy-qr-code")?.addEventListener("click", () => {
    const code = state.currentQRModalCode;
    if (!code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Access code ${code} copied to clipboard!`, "success");
        sounds.playClick();
      }).catch(() => {
        showToast(`Code: ${code}`, "info");
      });
    } else {
      showToast(`Code: ${code}`, "info");
    }
  });

  document.getElementById("btn-download-qr-ticket")?.addEventListener("click", () => {
    const code = state.currentQRModalCode;
    if (!code) return;
    downloadPassTicket(code);
  });

  document.getElementById("btn-test-checkin-modal")?.addEventListener("click", async () => {
    const code = state.currentQRModalCode;
    if (!code) return;
    closeQRModal();

    if (state.user?.role !== "admin") {
      try {
        const data = await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "admin@gympulse.com", password: "AdminPass123!" })
        });
        setAuth(data.token, data.user);
        showToast("Switched to Admin reception desk to test check-in...", "info");
      } catch (_) {}
    }

    navigateTo("#admin");
    setTimeout(() => {
      const input = document.getElementById("admin-checkin-code");
      if (input) {
        input.value = code;
        sounds.playClick();
        document.getElementById("admin-checkin-form")?.requestSubmit();
      }
    }, 250);
  });

  // Router listener
  window.addEventListener("hashchange", handleRouting);

  // Initialize first route
  handleRouting();
});
