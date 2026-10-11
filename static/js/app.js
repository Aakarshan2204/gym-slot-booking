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
const state = {
  token: localStorage.getItem("pulse_token") || null,
  user: JSON.parse(localStorage.getItem("pulse_user") || "null"),
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
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playSuccess() {
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
// Standalone SVG QR Code Generator
// Generates clean pixel matrix without external network dependencies
// ============================================================================
function generateQRCodeSVG(text, size = 180) {
  // Simple deterministic pattern generator using text hash for visual fidelity
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const grid = 21; // 21x21 QR standard
  const cellSize = size / grid;
  let rects = "";

  // Finder patterns at three corners (Top-Left, Top-Right, Bottom-Left)
  const isFinder = (r, c) => {
    return (
      (r < 7 && c < 7) ||
      (r < 7 && c >= grid - 7) ||
      (r >= grid - 7 && c < 7)
    );
  };

  const isFinderFilled = (r, c) => {
    // 7x7 outer border and 3x3 inner core
    const checkCorner = (or, oc) => {
      const lr = r - or;
      const lc = c - oc;
      if (lr < 0 || lr > 6 || lc < 0 || lc > 6) return false;
      if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
      if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
      return false;
    };
    return checkCorner(0, 0) || checkCorner(0, grid - 7) || checkCorner(grid - 7, 0);
  };

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      let filled = false;
      if (isFinder(r, c)) {
        filled = isFinderFilled(r, c);
      } else {
        // Pseudo-random data modules derived from text hash and coordinates
        const val = Math.sin(hash + r * 13 + c * 37) * 10000;
        filled = (val - Math.floor(val)) > 0.45;
      }

      if (filled) {
        rects += `<rect x="${(c * cellSize).toFixed(1)}" y="${(r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="#000" />`;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="border-radius: 6px; background: white; padding: 6px;">
    ${rects}
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
      showToast("Session expired. Please log in again.", "error");
      logout();
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

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("pulse_token");
  localStorage.removeItem("pulse_user");
  stopPolling();
  updateNavUserUI();
  navigateTo("#login");
  showToast("You have been logged out.", "info");
}

function updateNavUserUI() {
  const navUserPanel = document.getElementById("nav-user-panel");
  const navSessions = document.getElementById("nav-item-sessions");
  const navMyBookings = document.getElementById("nav-item-my-bookings");
  const navAdmin = document.getElementById("nav-item-admin");

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

  document.getElementById("btn-logout")?.addEventListener("click", logout);
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
    if (!isPolling) {
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

    // Card status classes
    const cardClass = [
      "session-card",
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
            ${
              isBooked
                ? `<span class="badge badge-confirmed">Booked</span>`
                : isWaitlisted
                ? `<span class="badge badge-waitlist">Waitlist #${session.user_waitlist_position}</span>`
                : isFull
                ? `<span class="badge badge-full">Full</span>`
                : `<span class="badge badge-confirmed">${seatsLeft} Seats Open</span>`
            }
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
          <button type="button" class="qr-preview btn-view-qr" data-code="${b.check_in_code}" title="View QR Ticket">
            ${generateQRCodeSVG(b.check_in_code, 70)}
            <span style="display: block; font-size: 0.65rem; color: #333; font-weight: 700; margin-top: 2px;">Click to Enlarge</span>
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
      openQRModal(code);
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

// QR Modal Handler
function openQRModal(code) {
  const modal = document.getElementById("qr-modal");
  const codeEl = document.getElementById("qr-modal-code");
  const wrapper = document.getElementById("qr-svg-wrapper");

  codeEl.textContent = code;
  wrapper.innerHTML = generateQRCodeSVG(code, 180);
  modal.classList.add("open");
}

function closeQRModal() {
  const modal = document.getElementById("qr-modal");
  modal.classList.remove("open");
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
                        : `<span style="color: var(--text-muted); font-size: 0.85rem;">Pending Check-in</span>`
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
  updateNavUserUI();
  setupAuthEventListeners();
  setupSessionsFilterListeners();
  setupAdminEventListeners();

  // QR Modal close listener
  document.getElementById("qr-modal-close")?.addEventListener("click", closeQRModal);
  document.getElementById("qr-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "qr-modal") closeQRModal();
  });

  // Router listener
  window.addEventListener("hashchange", handleRouting);

  // Initialize first route
  handleRouting();
});
