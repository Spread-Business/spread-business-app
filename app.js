// Apna deployed Google Apps Script Web App URL yahan paste karein
const APPS_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

const state = {
  tab: "catalog",
  category: "All",
  search: "",
  catalog: [],
  orders: [],
  messages: [],
  businessInfo: {
    Company_Name: "Spread Business Private Limited",
    Address: "Sher Shah Colony, Raiwind Road, Lahore, Pakistan",
    Phone: "+92 322 410 9537",
    Email: "spreadbusines@gmail.com"
  },
  user: JSON.parse(localStorage.getItem("sb_user") || "null"),
  selectedItem: null,
  statusNotice: ""
};

function isConfigured() {
  return APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE");
}

async function apiGet(action, params = {}) {
  if (!isConfigured()) return null;
  const query = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${APPS_SCRIPT_URL}?${query}`);
  return res.json();
}

async function apiPost(payload) {
  if (!isConfigured()) {
    throw new Error("Pehle app.js mein APPS_SCRIPT_URL set karein.");
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function loadInitialData() {
  updateRoleBadge();
  if (!isConfigured()) {
    state.statusNotice = "Demo mode active: Google Sheet se jorne ke liye APPS_SCRIPT_URL daalein.";
    render();
    return;
  }

  try {
    const result = await apiGet("getAll");
    if (result && result.ok && result.data) {
      state.catalog = result.data.catalog || [];
      state.orders = result.data.orders || [];
      state.messages = result.data.messages || [];
      if (Array.isArray(result.data.businessInfo)) {
        result.data.businessInfo.forEach(row => {
          if (row.Key) state.businessInfo[row.Key] = row.Value;
        });
      }
      document.getElementById("headerCompanyName").textContent =
        state.businessInfo.Company_Name || "SPREAD BUSINESS";
    }
  } catch (err) {
    state.statusNotice = "Data load error: " + err.message;
  }
  render();
}

function updateRoleBadge() {
  const badge = document.getElementById("activeRoleBadge");
  badge.textContent = state.user ? `${state.user.Role}: ${state.user.Full_Name}` : "Guest";
}

function switchTab(tabName) {
  state.tab = tabName;
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  render();
}

function selectItemForOrder(item) {
  state.selectedItem = item;
  switchTab("order");
}

function render() {
  const container = document.getElementById("appContent");
  let html = "";

  if (state.statusNotice) {
    html += `<div class="alert-box">${escapeHtml(state.statusNotice)}</div>`;
  }

  if (state.tab === "catalog") html += renderCatalogView();
  if (state.tab === "order") html += renderOrderView();
  if (state.tab === "ordersList") html += renderOrdersListView();
  if (state.tab === "chat") html += renderChatView();
  if (state.tab === "account") html += renderAccountView();

  container.innerHTML = html;
  bindEvents();
}

function renderCatalogView() {
  const categories = ["All", ...new Set(state.catalog.map(i => i.Category).filter(Boolean))];
  const filtered = state.catalog.filter(item => {
    const matchesCat = state.category === "All" || item.Category === state.category;
    const q = state.search.toLowerCase();
    const matchesSearch =
      !q ||
      String(item.Title || "").toLowerCase().includes(q) ||
      String(item.Category || "").toLowerCase().includes(q) ||
      String(item.Provider_Name || "").toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return `
    <div class="promo-banner">
      <div>
        <div style="font-size:15px;font-weight:800;">Printing &amp; Packaging Catalog</div>
        <div style="font-size:12px;opacity:0.92;margin-top:3px;">Live rates from Google Sheets</div>
      </div>
      <div class="promo-badge">SB RATES</div>
    </div>

    <div class="card">
      <input id="searchBox" class="search-input" type="text" placeholder="Search cards, flex, boxes, stamps..." value="${escapeAttr(state.search)}" />
      <div class="cat-pills">
        ${categories.map(cat => `
          <button class="pill-btn ${state.category === cat ? "active" : ""}" onclick="setCategory('${escapeJs(cat)}')">
            ${escapeHtml(cat)}
          </button>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Catalog &amp; Rate List (${filtered.length})</div>
      ${filtered.length === 0 ? `<p class="item-meta">Koi item nahi mila. Google Sheet ke Catalog_Rates tab mein items add karein.</p>` : ""}
      ${filtered.map(item => `
        <div class="item-row">
          <div>
            <div class="item-title">${escapeHtml(item.Title || "Untitled")}</div>
            <div class="item-meta">${escapeHtml(item.Category || "General")} • Min: ${escapeHtml(item.Min_Qty || 1)} ${escapeHtml(item.Unit || "")}</div>
            <div class="item-meta">${escapeHtml(item.Description || "")}</div>
          </div>
          <div>
            <div class="rate-tag">Rs. ${escapeHtml(item.Base_Rate || 0)}</div>
            <div class="item-meta" style="text-align:right;">per ${escapeHtml(item.Unit || "unit")}</div>
            <button class="small-btn" onclick='selectItemForOrder(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Order Now</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderOrderView() {
  const item = state.selectedItem || {};
  return `
    <div class="card">
      <div class="card-title">Customized Printing Order</div>
      <form id="orderForm">
        <label class="item-meta">Buyer Name</label>
        <input class="input" name="Buyer_Name" required value="${escapeAttr(state.user ? state.user.Full_Name : "")}" placeholder="Your name" />

        <label class="item-meta">Phone / WhatsApp</label>
        <input class="input" name="Buyer_Phone" required value="${escapeAttr(state.user ? state.user.Phone : "")}" placeholder="03xx-xxxxxxx" />

        <label class="item-meta">Service / Item Title</label>
        <input class="input" name="Title" required value="${escapeAttr(item.Title || "")}" placeholder="e.g. Visiting Cards / Packaging Box" />

        <label class="item-meta">Size, Quantity &amp; Paper/Specs</label>
        <input class="input" name="Specs_Size_Qty" required placeholder="e.g. 1000 pcs, 350gsm matt lamination" />

        <label class="item-meta">Unit Rate (Rs.)</label>
        <input class="input" id="orderUnitRate" name="Unit_Rate" type="number" step="any" value="${escapeAttr(item.Base_Rate || 0)}" />

        <label class="item-meta">Total Amount (Rs.)</label>
        <input class="input" id="orderTotalAmount" name="Total_Amount" type="number" step="any" required placeholder="Total amount" />

        <label class="item-meta">Advance Paid (Rs.)</label>
        <input class="input" name="Advance" type="number" step="any" value="0" />

        <label class="item-meta">Notes / Design Instructions</label>
        <textarea class="textarea" name="Notes" placeholder="Color, delivery, or design notes..."></textarea>

        <button class="btn btn-primary" type="submit">Submit Order to Google Sheet</button>
      </form>
    </div>
  `;
}

function renderOrdersListView() {
  return `
    <div class="card">
      <div class="card-title">Orders &amp; Cargo Status (${state.orders.length})</div>
      ${state.orders.length === 0 ? `<p class="item-meta">Abhi tak koi order record nahi hai.</p>` : ""}
      ${state.orders.map(o => `
        <div class="item-row">
          <div>
            <div class="item-title">${escapeHtml(o.Order_ID || "")} — ${escapeHtml(o.Title || "")}</div>
            <div class="item-meta">Buyer: ${escapeHtml(o.Buyer_Name || "")} (${escapeHtml(o.Buyer_Phone || "")})</div>
            <div class="item-meta">Specs: ${escapeHtml(o.Specs_Size_Qty || "")}</div>
            <div class="item-meta">Total: Rs. ${escapeHtml(o.Total_Amount || 0)} | Balance: Rs. ${escapeHtml(o.Balance || 0)}</div>
          </div>
          <div style="text-align:right;">
            <span class="status-badge">${escapeHtml(o.Order_Status || "Pending")}</span>
            <div class="item-meta" style="margin-top:4px;">Cargo: ${escapeHtml(o.Cargo_Status || "Not Dispatched")}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderChatView() {
  const quickReplies = [
    "Rate confirm kar dein",
    "Design file bhej di hai",
    "Delivery kab tak hogi?",
    "Advance payment ready hai"
  ];

  return `
    <div class="card">
      <div class="card-title">Order &amp; Inquiry Chat</div>
      <div class="chat-box">
        ${state.messages.length === 0 ? `<p class="item-meta">Koi message nahi hai. Pehla message bhejein.</p>` : ""}
        ${state.messages.map(m => `
          <div class="msg-bubble">
            <div><strong>${escapeHtml(m.Sender_Name || "User")}</strong> (${escapeHtml(m.Sender_Role || "")})</div>
            <div style="margin-top:3px;">${escapeHtml(m.Message_Text || "")}</div>
            <div class="msg-meta">${escapeHtml(m.Created_At || "")}</div>
          </div>
        `).join("")}
      </div>

      <div class="quick-replies">
        ${quickReplies.map(q => `
          <button type="button" class="pill-btn" onclick="fillQuickReply('${escapeJs(q)}')">${escapeHtml(q)}</button>
        `).join("")}
      </div>

      <form id="chatForm">
        <input class="input" id="chatInput" name="Message_Text" required placeholder="Type message..." />
        <button class="btn btn-primary" type="submit">Send Message</button>
      </form>
    </div>
  `;
}

function renderAccountView() {
  return `
    <div class="card">
      <div class="card-title">Account &amp; Role</div>
      ${state.user ? `
        <p class="item-meta"><strong>Name:</strong> ${escapeHtml(state.user.Full_Name)}</p>
        <p class="item-meta"><strong>Role:</strong> ${escapeHtml(state.user.Role)}</p>
        <p class="item-meta"><strong>Business:</strong> ${escapeHtml(state.user.Business_Name || "-")}</p>
        <p class="item-meta"><strong>Phone:</strong> ${escapeHtml(state.user.Phone || "-")}</p>
        <button class="btn btn-secondary" onclick="logoutUser()">Logout</button>
      ` : `
        <form id="loginForm">
          <label class="item-meta">Select Role</label>
          <select class="select" name="Role">
            <option value="Buyer">Buyer</option>
            <option value="Service Provider">Service Provider</option>
          </select>
          <input class="input" name="Full_Name" required placeholder="Full Name" />
          <input class="input" name="Business_Name" placeholder="Business / Shop Name" />
          <input class="input" name="Phone" required placeholder="Phone Number" />
          <input class="input" name="City" value="Lahore" placeholder="City" />
          <button class="btn btn-primary" type="submit">Continue &amp; Save Profile</button>
        </form>
      `}
    </div>

    <div class="card">
      <div class="card-title">About &amp; Contact Us</div>
      <p class="item-meta"><strong>Company:</strong> ${escapeHtml(state.businessInfo.Company_Name)}</p>
      <p class="item-meta"><strong>Address:</strong> ${escapeHtml(state.businessInfo.Address)}</p>
      <p class="item-meta"><strong>Phone:</strong> ${escapeHtml(state.businessInfo.Phone)}</p>
      <p class="item-meta"><strong>Email:</strong> ${escapeHtml(state.businessInfo.Email)}</p>
    </div>
  `;
}

function setCategory(cat) {
  state.category = cat;
  render();
}

function fillQuickReply(text) {
  const input = document.getElementById("chatInput");
  if (input) input.value = text;
}

function logoutUser() {
  state.user = null;
  localStorage.removeItem("sb_user");
  updateRoleBadge();
  render();
}

function bindEvents() {
  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.addEventListener("input", e => {
      state.search = e.target.value;
      renderCatalogListOnly();
    });
  }

  const orderForm = document.getElementById("orderForm");
  if (orderForm) {
    orderForm.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(orderForm);
      const payload = Object.fromEntries(fd.entries());
      payload.action = "createOrder";
      payload.Item_ID = state.selectedItem ? state.selectedItem.Item_ID : "";
      try {
        const res = await apiPost(payload);
        if (res.ok) {
          state.statusNotice = `Order submit ho gaya! ID: ${res.orderId}`;
          state.selectedItem = null;
          await loadInitialData();
          switchTab("ordersList");
        } else {
          state.statusNotice = "Order error: " + res.error;
          render();
        }
      } catch (err) {
        state.statusNotice = err.message;
        render();
      }
    });
  }

  const chatForm = document.getElementById("chatForm");
  if (chatForm) {
    chatForm.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(chatForm);
      const payload = {
        action: "sendMessage",
        Order_ID: "GENERAL",
        Sender_Name: state.user ? state.user.Full_Name : "Guest",
        Sender_Role: state.user ? state.user.Role : "Buyer",
        Message_Text: fd.get("Message_Text"),
        Quick_Reply_Tag: ""
      };
      try {
        const res = await apiPost(payload);
        if (res.ok) {
          await loadInitialData();
          switchTab("chat");
        }
      } catch (err) {
        state.statusNotice = err.message;
        render();
      }
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const profile = Object.fromEntries(fd.entries());
      state.user = profile;
      localStorage.setItem("sb_user", JSON.stringify(profile));
      updateRoleBadge();

      try {
        await apiPost({ action: "registerUser", ...profile });
      } catch (_) {
        // Local session remains active even if offline
      }
      state.statusNotice = `Welcome ${profile.Full_Name} (${profile.Role})!`;
      render();
    });
  }
}

function renderCatalogListOnly() {
  const currentPos = searchBoxSelection();
  render();
  const box = document.getElementById("searchBox");
  if (box && currentPos !== null) {
    box.focus();
    box.setSelectionRange(currentPos, currentPos);
  }
}

function searchBoxSelection() {
  const box = document.getElementById("searchBox");
  return box ? box.selectionStart : null;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function escapeJs(str) {
  return String(str ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

loadInitialData();
