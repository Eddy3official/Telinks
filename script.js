const API_URL = "https://social-backend.message-eddy3.workers.dev";

// --- State ---
let currentUser = localStorage.getItem("ts_user");
let token = localStorage.getItem("ts_token");
let role = localStorage.getItem("ts_role");

// --- Init ---
checkAuth();
loadPosts();

// --- Helper: fetch JSON wrapper ---
async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  // Better error handling
  if (!res.ok) {
    try {
      const err = await res.json();
      throw new Error(err.error || err.msg || 'Request failed');
    } catch (e) {
      throw new Error('Network error or invalid response');
    }
  }
  return res.json();
}

// --- Toast system ---
function toast(msg, type = "success", timeout = 3500) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : "success"}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

// --- Auth / UI ---
function checkAuth() {
  currentUser = localStorage.getItem("ts_user");
  token = localStorage.getItem("ts_token");
  role = localStorage.getItem("ts_role");
  if (currentUser) {
    document.getElementById("auth-ui").style.display = "none";
    document.getElementById("user-ui").style.display = "block";
    document.getElementById("post-box").style.display = "block";
    document.getElementById("welcome-msg").textContent = `Hi, ${currentUser}`;
    if (role === "admin") document.getElementById("admin-panel").style.display = "block";
  }
}

// --- Load posts ---
async function loadPosts() {
  try {
    const res = await fetch(`${API_URL}/posts`);
    const posts = await res.json();
    const feed = document.getElementById("feed");
    feed.innerHTML = "";
    posts.forEach(p => {
      const div = document.createElement("div");
      div.className = "card";
      let badgeHtml = p.badge ? `<span class="badge">${p.badge}</span>` : "";
      let deleteBtn = role === "admin" ? `<button class="del-btn" data-id="${p.id}" onclick="deletePost('${p.id}')">Delete</button>` : "";
      div.innerHTML = `
        <div class="post-header">
          <span>${escapeHtml(p.username)} ${badgeHtml} ${deleteBtn}</span>
          <span style="color:#888; font-size:0.8em">${new Date(p.date).toLocaleString()}</span>
        </div>
        <p>${escapeHtml(p.text)}</p>
        <a href="${escapeUrl(p.link)}" target="_blank" class="link-btn">Join</a>
      `;
      feed.appendChild(div);
    });
  } catch (e) {
    document.getElementById("feed").innerHTML = '<p>Error loading posts.</p>';
  }
}

// --- Submit post ---
async function submitPost() {
  const text = document.getElementById("post-text").value.trim();
  const link = document.getElementById("post-link").value.trim();
  const msgEl = document.getElementById("post-msg");

  if (!link.includes("t.me")) { msgEl.textContent = "Must be a Telegram link"; return; }
  if (!text || text.length > 120) { msgEl.textContent = "Invalid text length"; return; }

  try {
    await apiPost('/post', { username: currentUser, token, text, link });
    msgEl.textContent = "";
    toast("Posted!", "success");
    loadPosts();
    document.getElementById("post-text").value = "";
  } catch (e) {
    msgEl.textContent = e.message;
    toast(e.message, "error");
  }
}

// --- Registration with auto-copy and auto-login ---
async function doRegister() {
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-pass").value;
  if (!email || !password) {
    document.getElementById("auth-msg").textContent = "Email and password required";
    return;
  }
  try {
    const data = await apiPost('/register', { email, password });
    // expected data: { success:true, username, token? }
    const username = data.username;
    // If backend returns token (recommended), set it too; otherwise just store username
    if (data.token) {
      localStorage.setItem("ts_user", data.username);
      localStorage.setItem("ts_token", data.token);
      localStorage.setItem("ts_role", data.role || "user");
    } else {
      // Save username so user can copy later
      localStorage.setItem("ts_created_username", username);
    }

    // Show persistent registration modal with copy button
    document.getElementById("created-username").textContent = username;
    document.getElementById("reg-success").style.display = "block";
    document.getElementById("login-modal").style.display = "none";

    // Auto copy if enabled
    if (navigator.clipboard && document.getElementById("auto-copy").checked) {
      try { await navigator.clipboard.writeText(username); toast("Username copied to clipboard"); }
      catch (e) { /* ignore */ }
    }

    toast("Account created", "success");
    checkAuth();
  } catch (e) {
    document.getElementById("auth-msg").textContent = e.message;
    toast(e.message, "error");
  }
}

function copyCreatedUsername() {
  const u = document.getElementById("created-username").textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(u).then(() => toast("Copied username"));
  } else {
    // fallback
    const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    toast("Copied username");
  }
}

function closeRegSuccess() {
  document.getElementById("reg-success").style.display = "none";
  // If we saved created username only, set it as current user in localStorage so user is logged in locally
  const created = localStorage.getItem("ts_created_username");
  if (created) {
    localStorage.setItem("ts_user", created);
    localStorage.setItem("ts_role", "user");
    localStorage.removeItem("ts_created_username");
    checkAuth();
  }
}
function hideRegSuccess(){ document.getElementById("reg-success").style.display = "none"; }

// --- Login ---
async function doLogin() {
  const inputName = document.getElementById("login-user").value.trim();
  const password = document.getElementById("login-pass").value;
  if (!inputName || !password) { document.getElementById("auth-msg").textContent = "Missing credentials"; return; }
  try {
    const data = await apiPost('/login', { inputName, password });
    localStorage.setItem("ts_user", data.username);
    localStorage.setItem("ts_token", data.token);
    localStorage.setItem("ts_role", data.role || "user");
    toast("Logged in", "success");
    location.reload();
  } catch (e) {
    document.getElementById("auth-msg").textContent = e.message;
    toast(e.message, "error");
  }
}

// --- Admin / delete ---
async function deletePost(id) {
  // Use custom confirm modal later. For now simple prompt
  if (!confirm("Delete this?")) return;
  try {
    await apiPost('/admin', { action: "delete", token, targetId: id });
    toast("Post deleted");
    loadPosts();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function adminAction(type) {
  const targetUser = document.getElementById("target-user").value.trim();
  const payloadVal = document.getElementById("admin-payload").value.trim();
  let payload = {};
  if (type === 'badge') payload = { username: targetUser, badgeText: payloadVal };
  if (type === 'rename') payload = { oldName: targetUser, newName: payloadVal };
  try {
    const data = await apiPost('/admin', { action: type, token, targetId: null, payload });
    toast(data.msg || "Done", "success");
    loadPosts();
  } catch (e) {
    toast(e.message, "error");
  }
}

function showLogin() { document.getElementById("login-modal").style.display = "block"; }
function closeModal() { document.getElementById("login-modal").style.display = "none"; }
function logout() { localStorage.clear(); location.reload(); }

// Character Count
document.getElementById("post-text").addEventListener("input", function() {
  document.getElementById("char-count").innerText = this.value.length + "/120";
});

// Small helpers to avoid XSS in feed
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeUrl(u) { try { const url = new URL(u); return url.href; } catch (e) { return '#'; } }
