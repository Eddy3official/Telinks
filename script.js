const API_URL = "https://social-backend.message-eddy3.workers.dev/"; // PASTE YOUR URL HERE

// --- State ---
let currentUser = localStorage.getItem("ts_user");
let token = localStorage.getItem("ts_token");
let role = localStorage.getItem("ts_role");

// --- Init ---
checkAuth();
loadPosts();

// --- Functions ---
function checkAuth() {
    if (currentUser) {
        document.getElementById("auth-ui").style.display = "none";
        document.getElementById("user-ui").style.display = "block";
        document.getElementById("post-box").style.display = "block";
        document.getElementById("welcome-msg").textContent = `Hi, ${currentUser}`;
        
        if(role === "admin") document.getElementById("admin-panel").style.display = "block";
    }
}

async function loadPosts() {
    const res = await fetch(`${API_URL}/posts`);
    const posts = await res.json();
    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    posts.forEach(p => {
        const div = document.createElement("div");
        div.className = "card";
        
        let badgeHtml = p.badge ? `<span class="badge">${p.badge}</span>` : "";
        let deleteBtn = role === "admin" ? `<button class="del-btn" onclick="deletePost('${p.id}')">Delete</button>` : "";

        div.innerHTML = `
            <div class="post-header">
                <span>${p.username} ${badgeHtml} ${deleteBtn}</span>
                <span style="color:#888; font-size:0.8em">${new Date(p.date).toLocaleDateString()}</span>
            </div>
            <p>${p.text}</p>
            <a href="${p.link}" target="_blank" class="link-btn">Join Group ✈️</a>
        `;
        feed.appendChild(div);
    });
}

async function submitPost() {
    const text = document.getElementById("post-text").value;
    const link = document.getElementById("post-link").value;
    const msg = document.getElementById("post-msg");

    if(!link.includes("t.me")) { msg.textContent = "Must be a Telegram link"; return; }
    
    const res = await fetch(`${API_URL}/post`, {
        method: "POST",
        body: JSON.stringify({ username: currentUser, token, text, link })
    });
    const data = await res.json();
    
    if (data.success) {
        msg.textContent = "Posted!";
        loadPosts();
        document.getElementById("post-text").value = "";
    } else {
        msg.textContent = data.error;
    }
}

async function doRegister() {
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-pass").value;
    const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(data.success) {
        alert("Account Created! Username: " + data.username);
    } else {
        alert(data.error);
    }
}

async function doLogin() {
    const inputName = document.getElementById("login-user").value;
    const password = document.getElementById("login-pass").value;
    
    const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        body: JSON.stringify({ inputName, password })
    });
    const data = await res.json();
    
    if(data.success) {
        localStorage.setItem("ts_user", data.username);
        localStorage.setItem("ts_token", data.token);
        localStorage.setItem("ts_role", data.role);
        location.reload();
    } else {
        document.getElementById("auth-msg").textContent = data.error;
    }
}

// Admin Functions
async function deletePost(id) {
    if(!confirm("Delete this?")) return;
    await fetch(`${API_URL}/admin`, {
        method: "POST",
        body: JSON.stringify({ action: "delete", token, targetId: id })
    });
    loadPosts();
}

async function adminAction(type) {
    const targetUser = document.getElementById("target-user").value;
    const payloadVal = document.getElementById("admin-payload").value;
    
    let payload = {};
    if(type === 'badge') payload = { username: targetUser, badgeText: payloadVal };
    if(type === 'rename') payload = { oldName: targetUser, newName: payloadVal };

    const res = await fetch(`${API_URL}/admin`, {
        method: "POST",
        body: JSON.stringify({ action: type, token, targetId: null, payload })
    });
    const data = await res.json();
    alert(data.msg || data.error);
}

function showLogin() { document.getElementById("login-modal").style.display = "block"; }
function closeModal() { document.getElementById("login-modal").style.display = "none"; }
function logout() { localStorage.clear(); location.reload(); }

// Character Count
document.getElementById("post-text").addEventListener("input", function() {
    document.getElementById("char-count").innerText = this.value.length + "/120";
});
