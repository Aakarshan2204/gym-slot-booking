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
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return !payload.exp || (payload.exp * 1000) <= Date.now();
  } catch (_) {
    return true;
  }
}

let savedToken = localStorage.getItem("pulse_token") || null;
let savedUser = null;
if (savedToken && isTokenExpired(savedToken)) {
  savedToken = null;
  localStorage.removeItem("pulse_token");
  localStorage.removeItem("pulse_user");
} else {
  try {
    const rawUser = localStorage.getItem("pulse_user");
    if (rawUser && rawUser !== "undefined" && rawUser !== "null") {
      savedUser = JSON.parse(rawUser);
    }
  } catch (_) {
    savedUser = null;
  }
}

// ============================================================================
// Weekly Muscle Target Split & Workout Media Configuration
// ============================================================================
const WEEKLY_SPLIT = {
  Monday: {
    day: "Monday",
    muscle: "Chest",
    badge: "Chest Day",
    tagline: "Pectoral Hypertrophy & Upper Body Power",
    icon: "💥",
    color: "#00F076",
    poster: "/images/poster_chest.jpg",
    exercisePhoto: "/images/exercise_chest.jpg",
    primaryExercise: "Flat Barbell Bench Press",
    exercises: [
      { name: "Flat Barbell Bench Press", sets: "4 Sets x 8-10 Reps", note: "Explosive press, controlled 3-second negative descent" },
      { name: "Incline Dumbbell Press", sets: "3 Sets x 10-12 Reps", note: "Target upper clavicular pectoral head at 30° incline" },
      { name: "Cable Standing Chest Flyes", sets: "3 Sets x 12-15 Reps", note: "Constant tension with full peak contraction at center" },
      { name: "Weighted Dips / Pushups", sets: "3 Sets to Failure", note: "Lean torso forward 15° to recruit lower pecs" }
    ],
    targetMuscles: ["Pectoralis Major", "Pectoralis Minor", "Anterior Deltoids", "Triceps Brachii"],
    intensity: "Very High (85-90% 1RM)",
    estimatedBurn: "520 - 680 kcal",
    isHoliday: false
  },
  Tuesday: {
    day: "Tuesday",
    muscle: "Back",
    badge: "Back Day",
    tagline: "V-Taper Lat Width, Trap Density & Spine Stability",
    icon: "🦅",
    color: "#38bdf8",
    poster: "/images/poster_back.jpg",
    exercisePhoto: "/images/exercise_back.jpg",
    primaryExercise: "Bent-Over Barbell Rows",
    exercises: [
      { name: "Conventional Deadlifts", sets: "4 Sets x 5-6 Reps", note: "Full posterior chain drive with neutral spine lock" },
      { name: "Bent-Over Barbell Rows", sets: "4 Sets x 8-10 Reps", note: "Pull to lower sternum, flare elbows slightly" },
      { name: "Wide-Grip Lat Pulldowns", sets: "3 Sets x 10-12 Reps", note: "Drive elbows down and back for maximum lat stretch" },
      { name: "Seated Cable Rows", sets: "3 Sets x 12-15 Reps", note: "Squeeze rhomboids and middle traps for 2 seconds" }
    ],
    targetMuscles: ["Latissimus Dorsi", "Trapezius", "Rhomboids", "Erector Spinae"],
    intensity: "Extreme (90% 1RM)",
    estimatedBurn: "580 - 750 kcal",
    isHoliday: false
  },
  Wednesday: {
    day: "Wednesday",
    muscle: "Biceps and Triceps",
    badge: "Biceps & Triceps",
    tagline: "Arm Hypertrophy & Antagonist Super-Sets",
    icon: "💪",
    color: "#c084fc",
    poster: "/images/poster_arms.jpg",
    exercisePhoto: "/images/exercise_arms.jpg",
    primaryExercise: "Standing Dumbbell Bicep Curls",
    exercises: [
      { name: "Standing Dumbbell Bicep Curls", sets: "4 Sets x 10-12 Reps", note: "Strict supination at top of movement with zero body swing" },
      { name: "Cable Tricep Rope Pushdowns", sets: "4 Sets x 12-15 Reps", note: "Spread ropes at bottom to lock out tricep lateral head" },
      { name: "Incline Dumbbell Hammer Curls", sets: "3 Sets x 10-12 Reps", note: "Build brachialis and forearm thickness" },
      { name: "EZ-Bar Skull Crushers", sets: "3 Sets x 10-12 Reps", note: "Lower behind head to emphasize triceps long head" }
    ],
    targetMuscles: ["Biceps Brachii", "Triceps Brachii", "Brachialis", "Forearm Flexors"],
    intensity: "High (Hypertrophy / High Volume)",
    estimatedBurn: "450 - 580 kcal",
    isHoliday: false
  },
  Thursday: {
    day: "Thursday",
    muscle: "Shoulders",
    badge: "Shoulders Day",
    tagline: "3D Deltoid Caps & Overhead Power",
    icon: "🛡️",
    color: "#fbbf24",
    poster: "/images/poster_shoulders.jpg",
    exercisePhoto: "/images/exercise_shoulders.jpg",
    primaryExercise: "Seated Dumbbell Shoulder Press",
    exercises: [
      { name: "Seated Overhead Dumbbell Press", sets: "4 Sets x 8-10 Reps", note: "Full range of motion, press slightly inward at lockout" },
      { name: "Dumbbell Lateral Raises", sets: "4 Sets x 12-15 Reps", note: "Lead with elbows for targeted lateral delt isolation" },
      { name: "Rear Delt Face Pulls", sets: "3 Sets x 15 Reps", note: "External rotation at finish for healthy rotator cuffs" },
      { name: "Barbell Shrugs", sets: "3 Sets x 12 Reps", note: "Controlled vertical contraction of upper trapezius"}
    ],
    targetMuscles: ["Anterior Deltoids", "Lateral Deltoids", "Posterior Deltoids", "Rotator Cuffs"],
    intensity: "High (Strength & Shape)",
    estimatedBurn: "480 - 620 kcal",
    isHoliday: false
  },
  Friday: {
    day: "Friday",
    muscle: "Cardio",
    badge: "Cardio & HIIT",
    tagline: "Cardiovascular Endurance, V02 Max & Fat Oxidation",
    icon: "⚡",
    color: "#f43f5e",
    poster: "/images/poster_cardio.jpg",
    exercisePhoto: "/images/exercise_cardio.jpg",
    primaryExercise: "Curved Treadmill Interval Sprints",
    exercises: [
      { name: "Woodway Curved Treadmill Sprints", sets: "8 Rounds x 30s Sprint / 30s Rest", note: "Maximum anaerobic wattage and posterior propulsion" },
      { name: "Assault Fan Bike Tabata", sets: "6 Rounds x 20s Max / 10s Low", note: "Total body metabolic output and oxygen depletion" },
      { name: "Concept2 Rowing Ergometer", sets: "5 x 500m Intervals", note: "Keep stroke rate at 28-30 spm with powerful hip drive" },
      { name: "High-Speed Battle Ropes & Box Jumps", sets: "4 Sets x 45s", note: "Core stability, agility and explosive fast-twitch endurance" }
    ],
    targetMuscles: ["Heart & Lungs (VO2 Max)", "Calves & Hamstrings", "Core & Diaphragm"],
    intensity: "Maximum (Heart Rate Zone 4 - 5)",
    estimatedBurn: "650 - 900 kcal",
    isHoliday: false
  },
  Saturday: {
    day: "Saturday",
    muscle: "Legs",
    badge: "Legs Day",
    tagline: "Quad Sweeps, Hamstring Power & Glute Strength",
    icon: "🦵",
    color: "#a3e635",
    poster: "/images/poster_legs.jpg",
    exercisePhoto: "/images/exercise_legs.jpg",
    primaryExercise: "Heavy Barbell Back Squats",
    exercises: [
      { name: "Barbell Back Squats", sets: "5 Sets x 6-8 Reps", note: "Deep hip crease below parallel, drive through whole foot" },
      { name: "Romanian Deadlifts (RDLs)", sets: "4 Sets x 8-10 Reps", note: "Hinge at hips for deep hamstring stretch and glute recruitment" },
      { name: "Leg Press Machine", sets: "4 Sets x 10-12 Reps", note: "High foot placement for glutes or close stance for quad sweep" },
      { name: "Standing Calf Raises", sets: "4 Sets x 15-20 Reps", note: "Full 2-second stretch at bottom and 1-second peak flex" }
    ],
    targetMuscles: ["Quadriceps", "Hamstrings", "Gluteus Maximus", "Gastrocnemius"],
    intensity: "Brutal (Heavy Compound Lifting)",
    estimatedBurn: "650 - 850 kcal",
    isHoliday: false
  },
  Sunday: {
    day: "Sunday",
    muscle: "Holiday",
    badge: "Gym Holiday - Rest & Recovery",
    tagline: "Active Recovery, Central Nervous System Reset & Nutrition",
    icon: "🧘",
    color: "#38bdf8",
    poster: "/images/poster_sunday_rest.jpg",
    exercisePhoto: "/images/exercise_sunday_rest.jpg",
    primaryExercise: "Foam Rolling, Mobility & Hydration",
    exercises: [
      { name: "Full Body Myofascial Foam Rolling", sets: "15-20 Minutes", note: "Target tight IT bands, lats, thoracic spine and calves" },
      { name: "Dynamic Mobility & Hip Openers", sets: "10-15 Minutes", note: "Improve joint lubrication and prepare body for Monday" },
      { name: "Gentle 30-min Outdoor Walk", sets: "Zone 1 Aerobic", note: "Flush metabolic waste without inducing fatigue" },
      { name: "Electrolyte Hydration & High-Protein Meal Prep", sets: "All Day", note: "Replenish muscle glycogen and repair microtears" }
    ],
    targetMuscles: ["Central Nervous System (CNS)", "Connective Tissue", "Mind & Spirit"],
    intensity: "Restorative (Active Recovery & Rest)",
    estimatedBurn: "Maintenance Baseline",
    isHoliday: true
  }
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getSplitForDate(dateStr) {
  if (!dateStr) return WEEKLY_SPLIT.Monday;
  try {
    const parts = dateStr.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayName = DAY_NAMES[d.getDay()];
    return WEEKLY_SPLIT[dayName] || WEEKLY_SPLIT.Monday;
  } catch (_) {
    return WEEKLY_SPLIT.Monday;
  }
}

const currentDayName = DAY_NAMES[new Date().getDay()] || "Thursday";

const state = {
  token: savedToken,
  user: savedUser,
  sessions: [],
  selectedDate: null,
  filterStatus: "all",
  selectedMuscle: "all",
  activeSplitDay: currentDayName,
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

  // Highlight active demo persona chip if logged in; lock other chips to enforce privacy
  document.querySelectorAll(".demo-chip").forEach(chip => {
    if (state.user && chip.getAttribute("data-email") === state.user.email) {
      chip.classList.add("active-user");
      chip.classList.remove("restricted");
      chip.title = `Current Active Persona: ${state.user.name}`;
    } else if (state.user) {
      chip.classList.remove("active-user");
      chip.classList.add("restricted");
      chip.title = "Profile privacy active: Please log out first to switch accounts.";
    } else {
      chip.classList.remove("active-user", "restricted");
      chip.title = `Click to test as ${chip.textContent.trim()}`;
    }
  });

  if (!state.token || !state.user) {
    // Keep Sessions tab visible for guests so anyone can explore available slots
    navSessions.classList.remove("hidden");
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

  // Show or hide admin link strictly based on role
  if (state.user.role === "admin") {
    navAdmin.classList.remove("hidden");
  } else {
    navAdmin.classList.add("hidden");
  }

  navUserPanel.innerHTML = `
    <div class="user-badge" id="btn-open-profile" title="View Private Member Profile">
      <span class="user-name">${escapeHtml(state.user.name)}</span>
      <span class="user-role ${state.user.role === 'admin' ? 'admin' : ''}">${state.user.role}</span>
    </div>
    <button type="button" class="btn btn-secondary btn-sm" id="btn-logout" title="Log Out">Log Out</button>
  `;

  document.getElementById("btn-logout")?.addEventListener("click", () => logout(true));
  document.getElementById("btn-open-profile")?.addEventListener("click", openProfileModal);
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
    if (hash === "#my-bookings") {
      showToast("Please log in to view your bookings.", "info");
      hash = "#login";
    } else if (hash === "#admin") {
      showToast("Admin access requires logging in.", "info");
      hash = "#login";
    } else if (hash !== "#login" && hash !== "#sessions") {
      hash = "#sessions";
    }
  } else if (hash === "#login") {
    // Already logged in, direct straight to sessions
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

  // Quick Demo Persona switcher chips (strictly isolated: members cannot hop into other profiles)
  document.querySelectorAll(".demo-chip").forEach(chip => {
    chip.addEventListener("click", async () => {
      const email = chip.getAttribute("data-email");
      const pass = chip.getAttribute("data-pass");

      // Profile Isolation: If already logged in as a member, prevent accessing another member's profile
      if (state.user && state.user.email.toLowerCase() !== email.toLowerCase()) {
        showToast("Profile privacy active: Please log out before switching member accounts.", "info", 4000);
        sounds.playClick();
        return;
      }

      try {
        const data = await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password: pass })
        });
        setAuth(data.token, data.user);
        showToast(`Authenticated as: ${data.user.name} (${data.user.role})`, "success");
        navigateTo(data.user.role === "admin" ? "#admin" : "#sessions");
      } catch (err) {
        showToast(`Login error: ${err.message}`, "error");
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

let _fetchSessionsRetryCount = 0;

async function fetchSessions(isPolling = false) {
  const loading = document.getElementById("sessions-loading");
  const errorBox = document.getElementById("sessions-error");
  const emptyBox = document.getElementById("sessions-empty");

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
    _fetchSessionsRetryCount = 0;

    loading.style.display = "none";
    errorBox.style.display = "none";

    renderSessionsCards();
  } catch (err) {
    loading.style.display = "none";
    if (!isPolling) {
      // Auto-retry once after 1s during cold boot to guarantee 100% seamless startup
      if (_fetchSessionsRetryCount < 2) {
        _fetchSessionsRetryCount++;
        setTimeout(() => fetchSessions(false), 1000);
        return;
      }
      errorBox.style.display = "flex";
      document.getElementById("sessions-error-msg").textContent = err.message || "Failed to load sessions.";
    }
  }
}

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderSessionsCards() {
  const container = document.getElementById("sessions-container");
  const emptyBox = document.getElementById("sessions-empty");
  const sundayNotice = document.getElementById("sunday-holiday-notice");

  // Check if Sunday is filtered or selected (either via date filter or today is Sunday)
  const isSundaySelected = state.selectedMuscle === "Holiday" || 
    (state.selectedDate ? new Date(state.selectedDate + "T00:00:00").getDay() === 0 : new Date().getDay() === 0);
  if (sundayNotice) {
    sundayNotice.style.display = isSundaySelected ? "block" : "none";
  }

  // Apply filter status
  let filtered = state.sessions;
  if (state.filterStatus === "available") {
    filtered = filtered.filter(s => s.seats_remaining > 0);
  } else if (state.filterStatus === "full") {
    filtered = filtered.filter(s => s.seats_remaining === 0);
  }

  // Apply muscle target filter
  if (state.selectedMuscle !== "all") {
    if (state.selectedMuscle === "Holiday") {
      filtered = filtered.filter(s => {
        const split = s.muscle_target || getSplitForDate(s.date);
        return split.isHoliday || split.muscle === "Holiday";
      });
    } else {
      filtered = filtered.filter(s => {
        const split = s.muscle_target || getSplitForDate(s.date);
        return split.muscle === state.selectedMuscle;
      });
    }
  }

  if (filtered.length === 0) {
    if (!isSundaySelected) {
      emptyBox.style.display = "block";
    } else {
      emptyBox.style.display = "none";
    }
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

    // Daily Muscle Split Data with complete fallbacks
    const muscleInfo = session.muscle_target || getSplitForDate(session.date);
    const primaryExercise = muscleInfo.primaryExercise || muscleInfo.primary_exercise || "General Training";
    const exercisePhoto = muscleInfo.exercisePhoto || muscleInfo.exercise_photo || "";
    const badgeName = muscleInfo.badge || muscleInfo.muscle || "Gym Training";
    const badgeColor = muscleInfo.color || "#00F076";
    const badgeIcon = muscleInfo.icon || "⚡";
    const dayName = muscleInfo.day || "";

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
          <!-- Muscle Target Strip -->
          <div class="session-card-muscle-strip">
            <span class="muscle-badge-pill" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}55;">
              ${badgeIcon} ${dayName}: ${badgeName}
            </span>
            <button type="button" class="muscle-thumb-btn btn-open-exercise-preview"
              data-day="${dayName}"
              title="Click to view ${badgeName} exercise guide & poster">
              <img src="${exercisePhoto}" alt="${badgeName}">
            </button>
          </div>

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

          <!-- Movement Focus Tag -->
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin: 6px 0 10px; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span>
            <span><strong>Target:</strong> ${escapeHtml(primaryExercise)}</span>
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
      if (!state.token) {
        if (typeof sounds !== "undefined") sounds.playClick();
        showToast("Please log in or select a demo account to reserve a session.", "info", 4000);
        navigateTo("#login");
        return;
      }

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
      if (!state.token) {
        if (typeof sounds !== "undefined") sounds.playClick();
        showToast("Please log in or select a demo account to join the waitlist.", "info", 4000);
        navigateTo("#login");
        return;
      }

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

  // 4. Exercise Preview / Lightbox Modal Click from session card
  document.querySelectorAll(".btn-open-exercise-preview").forEach(btn => {
    btn.addEventListener("click", () => {
      const day = btn.getAttribute("data-day");
      const split = WEEKLY_SPLIT[day] || WEEKLY_SPLIT.Monday;
      state.activeSplitDay = day;
      renderWeeklySplitSection(day);
      openLightbox(
        split.exercisePhoto,
        `${split.day} Exercise: ${split.primaryExercise}`,
        `${split.badge} Focus & Routine`,
        split.badge,
        `
        <div style="margin-bottom: 8px;"><strong>Recommended Movements for ${split.day}:</strong></div>
        <ul style="padding-left: 20px; margin: 0; line-height: 1.6;">
          ${split.exercises.map(ex => `<li><strong>${escapeHtml(ex.name)}</strong>: ${escapeHtml(ex.sets)} — <em>${escapeHtml(ex.note)}</em></li>`).join("")}
        </ul>
        `
      );
    });
  });
}

// ============================================================================
// Lightbox Modal Functions (High-Resolution Visual Inspection)
// ============================================================================
function openLightbox(imgSrc, title, subtitle, badgeText, detailsHtml = "") {
  const modal = document.getElementById("lightbox-modal");
  const img = document.getElementById("lightbox-img");
  const titleEl = document.getElementById("lightbox-title");
  const capEl = document.getElementById("lightbox-caption");
  const badgeEl = document.getElementById("lightbox-badge");
  const detailsEl = document.getElementById("lightbox-details");

  if (!modal) return;
  if (img) img.src = imgSrc;
  if (titleEl) titleEl.textContent = title || "Workout Visual";
  if (capEl) capEl.textContent = subtitle || "";
  if (badgeEl) badgeEl.textContent = badgeText || "Workout";
  if (detailsEl) detailsEl.innerHTML = detailsHtml || "";

  modal.classList.add("open");
  if (typeof sounds !== "undefined") sounds.playClick();
}

function closeLightbox() {
  const modal = document.getElementById("lightbox-modal");
  if (modal) modal.classList.remove("open");
}

// ============================================================================
// Weekly Training Split Section & Day Switching
// ============================================================================
function renderWeeklySplitSection(dayName = state.activeSplitDay) {
  const container = document.getElementById("split-detail-container");
  const todayBadge = document.getElementById("split-today-text");
  if (!container) return;

  state.activeSplitDay = dayName;
  const split = WEEKLY_SPLIT[dayName] || WEEKLY_SPLIT.Monday;

  // Update nav buttons active state
  document.querySelectorAll(".split-day-btn").forEach(btn => {
    const btnDay = btn.getAttribute("data-day");
    btn.classList.toggle("active", btnDay === dayName);
  });

  // Update today indicator
  const todayStrName = DAY_NAMES[new Date().getDay()] || "Thursday";
  const todaySplit = WEEKLY_SPLIT[todayStrName] || WEEKLY_SPLIT.Thursday;
  if (todayBadge) {
    todayBadge.textContent = `Today: ${todaySplit.day} ${todaySplit.badge}`;
  }

  // Render detail card
  container.innerHTML = `
    <!-- Column 1: Cinematic Workout Poster -->
    <div class="split-poster-side">
      <div class="split-poster-wrapper" id="btn-split-poster-zoom" title="Click to view full-resolution poster">
        <img src="${split.poster}" alt="${split.badge} Poster" class="split-poster-img">
        <div class="split-poster-overlay">
          <div class="split-poster-top">
            <span class="split-poster-badge" style="border-color: ${split.color}; color: ${split.color};">
              ${split.icon} ${split.badge.toUpperCase()}
            </span>
            <span class="split-zoom-hint">🔍 View Poster</span>
          </div>
          <div class="split-poster-bottom">
            <div class="split-poster-title">${escapeHtml(split.day)}: ${escapeHtml(split.muscle)}</div>
            <div class="split-poster-tagline">${escapeHtml(split.tagline)}</div>
          </div>
        </div>
      </div>

      <!-- Training Specs Metadata Bar -->
      <div class="split-meta-row">
        <div class="split-meta-pill">
          <span class="split-meta-label">Intensity Target</span>
          <span class="split-meta-val" style="color: ${split.color};">${escapeHtml(split.intensity)}</span>
        </div>
        <div class="split-meta-pill">
          <span class="split-meta-label">Est. Caloric Burn</span>
          <span class="split-meta-val">${escapeHtml(split.estimatedBurn)}</span>
        </div>
        <div class="split-meta-pill">
          <span class="split-meta-label">Primary Movement</span>
          <span class="split-meta-val">${escapeHtml(split.primaryExercise)}</span>
        </div>
      </div>

      <!-- Target Anatomy Pills -->
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
        ${(split.targetMuscles || []).map(m => `
          <span style="font-size: 0.73rem; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); padding: 3px 8px; border-radius: var(--radius-full); color: var(--text-secondary);">
            📍 ${escapeHtml(m)}
          </span>
        `).join("")}
      </div>
    </div>

    <!-- Column 2: User Action Photo & Exercise Protocol -->
    <div class="split-exercise-side">
      <div>
        <div class="split-exercise-hero">
          <div class="split-exercise-img-wrap" id="btn-split-exercise-zoom" title="Click to view full-resolution exercise photo">
            <img src="${split.exercisePhoto}" alt="${split.primaryExercise}" class="split-exercise-img">
          </div>
          <div class="split-exercise-info">
            <h4>${split.isHoliday ? '🏖️ Active Recovery & Nutrition' : '🏋️ Form Cue & Execution'}</h4>
            <p>
              ${split.isHoliday 
                ? 'Hydrate with minerals, perform full myofascial foam rolling, and fuel up with high-protein meals for the upcoming week.'
                : `Key movement for ${split.day}: <strong>${escapeHtml(split.primaryExercise)}</strong>. Focus on full stretch at bottom and explosive mind-muscle contraction.`}
            </p>
          </div>
        </div>

        <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">
            ${split.isHoliday ? 'Sunday Restoration Protocol' : 'Structured Daily Routine'}
          </h4>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">4 Stations</span>
        </div>

        <!-- Exercise Routine Items -->
        <div class="exercise-routine-list">
          ${split.exercises.map(ex => `
            <div class="exercise-item">
              <div class="exercise-name-block">
                <strong>${escapeHtml(ex.name)}</strong>
                <small>${escapeHtml(ex.note)}</small>
              </div>
              <span class="exercise-sets-badge" style="color: ${split.color}; border-color: ${split.color}55; background: ${split.color}15;">
                ${escapeHtml(ex.sets)}
              </span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="split-action-row">
        ${split.isHoliday ? `
          <span style="font-size: 0.85rem; color: var(--text-secondary);">
            🏖️ Gym is closed on Sunday for holiday recovery.
          </span>
          <button type="button" class="btn btn-primary btn-sm" id="btn-quick-filter-monday">
            💥 Book Monday Chest
          </button>
        ` : `
          <button type="button" class="btn btn-primary btn-sm" id="btn-quick-filter-split">
            🔍 Filter ${split.day} Sessions
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-view-poster-modal">
            🖼️ View Full Poster
          </button>
        `}
      </div>
    </div>
  `;

  // Attach zoom clicks
  document.getElementById("btn-split-poster-zoom")?.addEventListener("click", () => {
    openLightbox(
      split.poster,
      `${split.day} Poster: ${split.badge}`,
      split.tagline,
      split.badge,
      `<strong>Target Anatomy:</strong> ${split.targetMuscles.join(", ")} | <strong>Intensity:</strong> ${split.intensity}`
    );
  });

  document.getElementById("btn-view-poster-modal")?.addEventListener("click", () => {
    openLightbox(
      split.poster,
      `${split.day} Poster: ${split.badge}`,
      split.tagline,
      split.badge,
      `<strong>Target Anatomy:</strong> ${split.targetMuscles.join(", ")} | <strong>Intensity:</strong> ${split.intensity}`
    );
  });

  document.getElementById("btn-split-exercise-zoom")?.addEventListener("click", () => {
    openLightbox(
      split.exercisePhoto,
      `${split.day} Exercise: ${split.primaryExercise}`,
      `Key Exercise for ${split.badge}`,
      split.badge,
      `
      <div style="margin-top: 8px;">
        <strong>Routine:</strong>
        <ul style="padding-left: 20px; margin: 4px 0 0;">
          ${split.exercises.map(e => `<li>${escapeHtml(e.name)} — <strong>${escapeHtml(e.sets)}</strong></li>`).join("")}
        </ul>
      </div>
      `
    );
  });

  document.getElementById("btn-quick-filter-split")?.addEventListener("click", () => {
    state.selectedMuscle = split.muscle;
    document.querySelectorAll(".muscle-pill-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-muscle") === split.muscle);
    });
    renderSessionsCards();
    const grid = document.getElementById("sessions-container");
    if (grid) {
      grid.scrollIntoView({ behavior: "smooth" });
    }
  });

  document.getElementById("btn-quick-filter-monday")?.addEventListener("click", () => {
    state.selectedMuscle = "Chest";
    state.activeSplitDay = "Monday";
    renderWeeklySplitSection("Monday");
    document.querySelectorAll(".muscle-pill-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-muscle") === "Chest");
    });
    renderSessionsCards();
  });
}

function setupSessionsFilterListeners() {
  const filterDate = document.getElementById("filter-date");
  const filterStatus = document.getElementById("filter-status");
  const btnToday = document.getElementById("btn-today");
  const btnTomorrow = document.getElementById("btn-tomorrow");
  const btnClearDate = document.getElementById("btn-clear-date");
  const btnRetry = document.getElementById("btn-retry-sessions");

  filterDate.addEventListener("change", (e) => {
    state.selectedDate = e.target.value || null;
    fetchSessions();
  });

  filterStatus.addEventListener("change", (e) => {
    state.filterStatus = e.target.value;
    renderSessionsCards();
  });

  // Quick Muscle Filter Pills
  document.querySelectorAll(".muscle-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".muscle-pill-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedMuscle = btn.getAttribute("data-muscle") || "all";
      if (typeof sounds !== "undefined") sounds.playClick();
      renderSessionsCards();
    });
  });

  // Sunday Notice Monday Button
  document.getElementById("btn-view-monday-chest")?.addEventListener("click", () => {
    const fd = document.getElementById("filter-date");
    if (fd) fd.value = "";
    state.selectedDate = null;
    state.selectedMuscle = "Chest";
    state.activeSplitDay = "Monday";
    renderWeeklySplitSection("Monday");
    document.querySelectorAll(".muscle-pill-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-muscle") === "Chest");
    });
    if (typeof sounds !== "undefined") sounds.playClick();
    renderSessionsCards();
  });

  // Sunday Poster Click in Notice
  document.getElementById("sunday-poster-click")?.addEventListener("click", () => {
    const split = WEEKLY_SPLIT.Sunday;
    openLightbox(
      split.poster,
      "Sunday Gym Holiday - Active Rest & Recovery",
      "Recharge and refresh before Monday Chest Day",
      "Gym Holiday",
      `<p>PULSE Gym is dedicated to athletic longevity. Rest today, optimize nutrition and hydration, and return Monday at peak capacity.</p>`
    );
  });

  btnToday.addEventListener("click", () => {
    const todayStr = getTodayISO();
    filterDate.value = todayStr;
    state.selectedDate = todayStr;
    fetchSessions();
  });

  btnTomorrow.addEventListener("click", () => {
    const tomorrowStr = getTomorrowISO();
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

  // Setup Weekly Split Selector Days
  document.querySelectorAll(".split-day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const day = btn.getAttribute("data-day");
      if (typeof sounds !== "undefined") sounds.playClick();
      renderWeeklySplitSection(day);
    });
  });

  // Lightbox Close Listeners
  document.getElementById("lightbox-close")?.addEventListener("click", closeLightbox);
  document.getElementById("btn-lightbox-done")?.addEventListener("click", closeLightbox);
  document.getElementById("lightbox-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "lightbox-modal") closeLightbox();
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
    if (err.status !== 401) {
      errorBox.style.display = "flex";
      document.getElementById("my-bookings-error-msg").textContent = err.message || "Failed to load bookings.";
    }
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
    const muscleInfo = b.muscle_target || getSplitForDate(b.date);

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

          <!-- Muscle Target Badge on Ticket -->
          <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px;">
            <span class="muscle-badge-pill" style="background: ${muscleInfo.color}22; color: ${muscleInfo.color}; border: 1px solid ${muscleInfo.color}55;">
              ${muscleInfo.icon} ${muscleInfo.day}: ${muscleInfo.badge}
            </span>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">
              Target: <strong>${escapeHtml(muscleInfo.primaryExercise)}</strong>
            </span>
          </div>

          <h3 class="ticket-title" style="margin-top: 6px;">${timeFormatted} Gym Session</h3>
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
    const muscleInfo = w.muscle_target || getSplitForDate(w.date);

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span class="badge badge-waitlist">Position #${w.position} in line</span>
            <span class="muscle-badge-pill" style="background: ${muscleInfo.color}22; color: ${muscleInfo.color}; border: 1px solid ${muscleInfo.color}55;">
              ${muscleInfo.icon} ${muscleInfo.badge}
            </span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">${formatDate(w.date)}</span>
          </div>
          <h4 style="font-size: 1.1rem; margin-top: 6px;">${timeFormatted} Session</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
            Target: <strong>${escapeHtml(muscleInfo.primaryExercise)}</strong> • Joined: ${new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Auto-promotion active
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

  // Security: Staff reception check-in desk button is ONLY visible if user is an Admin
  const btnStaffDesk = document.getElementById("btn-test-checkin-modal");
  if (btnStaffDesk) {
    btnStaffDesk.style.display = state.user?.role === "admin" ? "inline-flex" : "none";
  }

  modal.classList.add("open");
  sounds.playClick();
}

function closeQRModal() {
  const modal = document.getElementById("qr-modal");
  modal.classList.remove("open");
}

// ============================================================================
// Member Profile Modal & Strict Privacy Handlers
// ============================================================================
async function openProfileModal() {
  if (!state.user) return;
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  document.getElementById("profile-modal-title").textContent = state.user.name;
  document.getElementById("profile-modal-email").textContent = state.user.email;
  document.getElementById("profile-role").textContent = state.user.role.toUpperCase();
  document.getElementById("profile-role-badge").textContent = state.user.role === "admin" ? "🛡️ Staff Admin" : "👤 Member";
  document.getElementById("profile-id").textContent = `#${state.user.id}`;
  document.getElementById("profile-avatar").textContent = state.user.role === "admin" ? "🛡️" : "👤";

  try {
    const data = await apiRequest("/api/my-bookings");
    const activeConfirmed = (data.bookings || []).filter(b => b.status === "confirmed" && !b.has_ended).length;
    const waitlistCount = (data.waitlist || []).length;
    document.getElementById("profile-bookings-count").textContent = activeConfirmed;
    document.getElementById("profile-waitlist-count").textContent = waitlistCount > 0 ? `#${waitlistCount} In Line` : "None";
  } catch (_) {}

  modal.classList.add("open");
  sounds.playClick();
}

function closeProfileModal() {
  document.getElementById("profile-modal")?.classList.remove("open");
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
  if (dateInput) {
    dateInput.value = tomorrow.toISOString().split("T")[0];
    const updateTargetNotice = () => {
      const val = dateInput.value;
      const split = getSplitForDate(val);
      let noticeEl = document.getElementById("admin-date-muscle-notice");
      if (!noticeEl) {
        noticeEl = document.createElement("div");
        noticeEl.id = "admin-date-muscle-notice";
        noticeEl.style.fontSize = "0.8rem";
        noticeEl.style.marginTop = "6px";
        dateInput.parentElement.appendChild(noticeEl);
      }
      if (split.isHoliday) {
        noticeEl.innerHTML = `<span style="color: #38bdf8; font-weight: 700;">🏖️ Note: ${split.day} is a Gym Holiday (Rest & Recovery Day).</span>`;
      } else {
        noticeEl.innerHTML = `<span style="color: ${split.color}; font-weight: 700;">${split.icon} Scheduled: ${split.day} - ${split.badge} (${split.muscle})</span>`;
      }
    };
    dateInput.addEventListener("change", updateTargetNotice);
    updateTargetNotice();
  }

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

  // Initialize Weekly Muscle Target Split Showcase
  renderWeeklySplitSection(state.activeSplitDay);

  // Weekly Split Nav link scroll
  document.getElementById("nav-split")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (window.location.hash !== "#sessions") {
      navigateTo("#sessions");
    }
    setTimeout(() => {
      document.getElementById("weekly-split-section")?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  });

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

  // Staff Check-In Desk Button (Strictly restricted to Admin role; cannot be used by regular members)
  document.getElementById("btn-test-checkin-modal")?.addEventListener("click", () => {
    const code = state.currentQRModalCode;
    if (!code) return;
    closeQRModal();

    if (state.user?.role !== "admin") {
      showToast("Access restricted: Regular members cannot access administrative check-in desk.", "error", 4000);
      return;
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

  // Profile Modal listeners
  document.getElementById("profile-modal-close")?.addEventListener("click", closeProfileModal);
  document.getElementById("profile-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "profile-modal") closeProfileModal();
  });
  document.getElementById("btn-profile-logout")?.addEventListener("click", () => {
    closeProfileModal();
    logout(true);
  });
  document.getElementById("btn-profile-view-tickets")?.addEventListener("click", () => {
    closeProfileModal();
  });

  // Router listener
  window.addEventListener("hashchange", handleRouting);

  // Initialize first route
  handleRouting();
});
