const API_URL = "https://social-backend.message-eddy3.workers.dev"; // set your worker URL here

// --- State ---
let currentUser = localStorage.getItem("ts_user");
let token = localStorage.getItem("ts_token");
let role = localStorage.getItem("ts_role");

// --- Init ---
checkAuth();
loadPosts();

// --- Helper: simple POST wrapper (keeps older behavior: try to parse JSON and return it)
async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  // Try to parse JSON like the older script did. If parsing fails, return a fallback error object
  try {
    const data = await res.json();
    return data;
  } catch (e) {
    // Parsing failed — return an object with error text so UI can show it instead of a generic toast
    const text = await res.text().catch(() => 'Invalid response');
    return { success: false, error: text || `HTTP ${res.status}` };
  }
}

// --- Toast system (keeps our upgrade)
function toast(msg, type = "success", timeout = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return; // defensive
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : "success"}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

// --- Functions ---
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

async function loadPosts() {
  try {
    const res = await fetch(`${API_URL}/posts`);
    const posts = await res.json();
    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    (posts || []).forEach(p => {
      const div = document.createElement("div");
      div.className = "card";

      let badgeHtml = p.badge ? `<span class="badge">${p.badge}</span>` : "";
      let deleteBtn = role === "admin" ? `<button class="del-btn" onclick="deletePost('${p.id}')">Delete</button>` : "";

      div.innerHTML = `
            <div class="post-header">
                <span>${escapeHtml(p.username)} ${badgeHtml} ${deleteBtn}</span>
                <span style="color:#888; font-size:0.8em">${new Date(p.date).toLocaleDateString()}</span>
            </div>
            <p>${escapeHtml(p.text)}</p>
            <a href="${escapeUrl(p.link)}" target="_blank" class="link-btn">Join Group ✈️</a>
        `;
      feed.appendChild(div);
    });
  } catch (e) {
    console.error('Failed to load posts', e);
    document.getElementById("feed").innerHTML = '<p>Error loading posts.</p>';
  }
}

async function submitPost() {
  const text = document.getElementById("post-text").value;
  const link = document.getElementById("post-link").value;
  const msg = document.getElementById("post-msg");

  if (!link.includes("t.me")) { msg.textContent = "Must be a Telegram link"; return; }

  // Use the simpler older-style handling: call postJson which tries to parse JSON and returns it
  try {
    const data = await postJson('/post', { username: currentUser, token, text, link });
    if (data.success) {
      msg.textContent = "Posted!";
      toast('Posted!', 'success');
      loadPosts();
      document.getElementById("post-text").value = "";
    } else {
      // Show backend error directly (older behavior)
      msg.textContent = data.error || 'Publish failed';
      toast(data.error || 'Publish failed', 'error');
    }
  } catch (e) {
    // As a final fallback, show the error but avoid the generic masked message
    console.error('submitPost error', e);
    msg.textContent = e.message || 'Network error';
    toast(e.message || 'Network error', 'error');
  }
}

async function doRegister() {
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-pass").value;
  try {
    const data = await postJson('/register', { email, password });
    if (data.success) {
      // keep upgraded UX: persistent reg success dialog & auto-copy if available
      document.getElementById("created-username").textContent = data.username;
      document.getElementById("reg-success").style.display = "block";
      document.getElementById("login-modal").style.display = "none";

      if (data.token) {
        localStorage.setItem('ts_user', data.username);
        localStorage.setItem('ts_token', data.token);
        localStorage.setItem('ts_role', data.role || 'user');
      } else {
        localStorage.setItem('ts_created_username', data.username);
      }

      if (navigator.clipboard && document.getElementById('auto-copy')?.checked) {
        try { await navigator.clipboard.writeText(data.username); toast('Username copied to clipboard'); } catch(e){}
      }

      toast('Account created', 'success');
      checkAuth();
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (e) {
    console.error('Registration failed', e);
    alert(e.message || 'Network error');
  }
}

function copyCreatedUsername() {
  const u = document.getElementById("created-username").textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(u).then(() => toast("Copied username"));
  } else {
    const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    toast("Copied username");
  }
}

function closeRegSuccess() {
  document.getElementById("reg-success").style.display = "none";
  const created = localStorage.getItem("ts_created_username");
  if (created) {
    localStorage.setItem("ts_user", created);
    localStorage.setItem("ts_role", "user");
    localStorage.removeItem("ts_created_username");
    checkAuth();
  }
}
function hideRegSuccess(){ document.getElementById("reg-success").style.display = "none"; }

async function doLogin() {
  const inputName = document.getElementById("login-user").value;
  const password = document.getElementById("login-pass").value;
  try {
    const data = await postJson('/login', { inputName, password });
    if (data.success) {
      localStorage.setItem("ts_user", data.username);
      localStorage.setItem("ts_token", data.token);
      localStorage.setItem("ts_role", data.role);
      toast('Logged in', 'success');
      location.reload();
    } else {
      document.getElementById("auth-msg").textContent = data.error;
      toast(data.error || 'Login failed', 'error');
    }
  } catch (e) {
    console.error('Login failed', e);
    document.getElementById("auth-msg").textContent = e.message || 'Network error';
    toast(e.message || 'Network error', 'error');
  }
}

// Admin Functions
async function deletePost(id) {
  if (!confirm("Delete this?")) return;
  try {
    const data = await postJson('/admin', { action: "delete", token, targetId: id });
    if (data.success) { toast('Deleted', 'success'); loadPosts(); }
    else { toast(data.error || 'Delete failed', 'error'); }
  } catch (e) {
    console.error('deletePost error', e);
    toast(e.message || 'Network error', 'error');
  }
}

async function adminAction(type) {
  const targetUser = document.getElementById("target-user").value;
  const payloadVal = document.getElementById("admin-payload").value;

  let payload = {};
  if (type === 'badge') payload = { username: targetUser, badgeText: payloadVal };
  if (type === 'rename') payload = { oldName: targetUser, newName: payloadVal };

  try {
    const data = await postJson('/admin', { action: type, token, targetId: null, payload });
    alert(data.msg || data.error);
  } catch (e) {
    console.error('adminAction error', e);
    alert(e.message || 'Network error');
  }
}

function showLogin() { document.getElementById("login-modal").style.display = "block"; }
function closeModal() { document.getElementById("login-modal").style.display = "none"; }
function logout() { localStorage.clear(); location.reload(); }

// Character Count
document.getElementById("post-text").addEventListener("input", function() {
  document.getElementById("char-count").innerText = this.value.length + "/120";
});

// helpers
function escapeHtml(s) {
  return String(s || "").replace(/[&<>\"'`]/g, function(m) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',"`":'&#96;' })[m];
  });
}
function escapeUrl(u) { try { const url = new URL(u); return url.href; } catch (e) { return '#'; } }
