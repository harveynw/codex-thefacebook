const PB_URL = window.location.origin;
const storeKey = "thefacebook_auth";
const pageSize = 5;

const state = {
  auth: readAuth(),
  route: location.hash || "#/",
  people: [],
  friendships: [],
  pokes: [],
  currentPage: 1
};

const app = document.querySelector("#app");
const leftNav = document.querySelector("#left-nav");
const topLinks = document.querySelector("#top-links");
const logoutButton = document.querySelector("#logout-button");
const quickSearch = document.querySelector("#quick-search");
const quickSearchInput = document.querySelector("#quick-search-input");
const notificationLink = document.querySelector("#notification-link");
const notificationCount = document.querySelector("#notification-count");

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(storeKey));
  } catch (_) {
    return null;
  }
}

function saveAuth(auth) {
  state.auth = auth;
  if (auth) localStorage.setItem(storeKey, JSON.stringify(auth));
  else localStorage.removeItem(storeKey);
  syncChrome();
}

function syncChrome() {
  const signedIn = Boolean(state.auth?.token);
  leftNav.hidden = !signedIn;
  topLinks.hidden = !signedIn;
  if (!signedIn) updateNotificationBadge(0);
}

function headers(extra = {}) {
  return {
    ...(state.auth?.token ? { Authorization: `Bearer ${state.auth.token}` } : {}),
    ...extra
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...options,
    headers: headers(options.headers)
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.message || body?.data?.email?.message || res.statusText;
    throw new Error(message);
  }
  return body;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEditor(value = "") {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function fileUrl(record, filename, thumb = "") {
  if (!record || !filename) return "";
  const query = thumb ? `?thumb=${encodeURIComponent(thumb)}` : "";
  return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${filename}${query}`;
}

function avatarHtml(user, className = "mini") {
  if (user?.profile_picture) {
    const cls = className === "large" ? "avatar" : "mini-avatar";
    const thumb = className === "large" ? "300x300" : "120x120";
    return `<img class="${cls}" src="${fileUrl(user, user.profile_picture, thumb)}" alt="${escapeHtml(user.name)}">`;
  }
  return className === "large"
    ? document.querySelector("#default-avatar-template").innerHTML
    : '<div class="mini-default" aria-label="default profile picture"></div>';
}

function routeTo(path) {
  location.hash = path;
}

function flash(message, kind = "notice") {
  return `<div class="notice ${kind === "error" ? "error" : ""}">${escapeHtml(message)}</div>`;
}

function setHtml(html) {
  app.innerHTML = html;
}

async function loadSocial() {
  if (!state.auth?.token) return;
  const [people, friendships, pokes] = await Promise.all([
    api("/api/collections/users/records?perPage=200&sort=name"),
    api("/api/collections/friend_requests/records?perPage=200&sort=-created&expand=requester,recipient"),
    api("/api/collections/pokes/records?perPage=50&sort=-created&expand=from,to")
  ]);
  state.people = people.items;
  state.friendships = friendships.items;
  state.pokes = pokes.items;
  updateNotificationBadge(notificationTotal());
}

function currentUser() {
  return state.auth?.record;
}

function userById(id) {
  if (id === currentUser()?.id) return currentUser();
  return state.people.find((person) => person.id === id);
}

function acceptedFriendIds() {
  const me = currentUser()?.id;
  return state.friendships
    .filter((friendship) => friendship.status === "accepted")
    .map((friendship) => friendship.requester === me ? friendship.recipient : friendship.requester);
}

function incomingFriendRequests() {
  return state.friendships.filter((item) => item.status === "pending" && item.recipient === currentUser()?.id);
}

function incomingPokes() {
  return state.pokes.filter((poke) => poke.to === currentUser()?.id);
}

function notificationTotal() {
  return incomingFriendRequests().length + incomingPokes().length;
}

function updateNotificationBadge(count = notificationTotal()) {
  if (!notificationLink || !notificationCount) return;
  notificationLink.classList.toggle("has-notifications", count > 0);
  notificationLink.setAttribute("aria-label", count > 0 ? `${count} notifications` : "notifications");
  notificationCount.hidden = count === 0;
  notificationCount.textContent = String(count);
}

function relationshipWith(userId) {
  const me = currentUser()?.id;
  if (userId === me) return { label: "This is you", action: "" };
  const request = state.friendships.find((item) => {
    return (item.requester === me && item.recipient === userId) || (item.requester === userId && item.recipient === me);
  });
  if (!request) return { label: "Not connected", action: `<button data-action="friend" data-id="${userId}">Add as Friend</button>` };
  if (request.status === "accepted") return { label: "Friends", action: `<button data-action="poke" data-id="${userId}">Poke</button>` };
  if (request.status === "pending" && request.recipient === me) {
    return { label: "Friend request received", action: `<button data-action="accept" data-id="${request.id}">Confirm</button> <button class="secondary" data-action="reject" data-id="${request.id}">Reject</button>` };
  }
  if (request.status === "pending") return { label: "Friend request sent", action: "" };
  return { label: "Request declined", action: `<button data-action="friend" data-id="${userId}">Add as Friend</button>` };
}

function shell(title, body) {
  return `<div class="blue-title">${escapeHtml(title)}</div><div class="box">${body}</div>`;
}

function authView(error = "") {
  setHtml(`
    ${error ? flash(error, "error") : ""}
    <div class="grid-two">
      <section>
        <div class="blue-title">Log In</div>
        <form id="login-form" class="box form-grid">
          <label for="login-email">Email:</label>
          <input id="login-email" name="email" type="email" required autocomplete="email">
          <label for="login-password">Password:</label>
          <input id="login-password" name="password" type="password" required autocomplete="current-password">
          <div></div>
          <button type="submit">Log In</button>
        </form>
      </section>
      <section>
        <div class="blue-title">Register for thefacebook</div>
        <form id="signup-form" class="box form-grid">
          <label for="signup-name">Name:</label>
          <input id="signup-name" name="name" required>
          <label for="signup-email">Email:</label>
          <input id="signup-email" name="email" type="email" required>
          <label for="signup-password">Password:</label>
          <input id="signup-password" name="password" type="password" minlength="8" required>
          <label for="signup-school">School:</label>
          <input id="signup-school" name="school" value="Harvard University">
          <label for="signup-year">Class Year:</label>
          <input id="signup-year" name="class_year" type="number" min="1900" max="2100">
          <div></div>
          <button type="submit">Register</button>
        </form>
      </section>
    </div>
  `);

  document.querySelector("#login-form").addEventListener("submit", handleLogin);
  document.querySelector("#signup-form").addEventListener("submit", handleSignup);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const auth = await api("/api/collections/users/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: form.get("email"), password: form.get("password") })
    });
    saveAuth(auth);
    await loadSocial();
    routeTo("#/");
    render();
  } catch (error) {
    authView(error.message);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    email: form.get("email"),
    password: form.get("password"),
    passwordConfirm: form.get("password"),
    name: form.get("name"),
    school: form.get("school"),
    class_year: Number(form.get("class_year")) || null,
    emailVisibility: true
  };
  try {
    await api("/api/collections/users/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const auth = await api("/api/collections/users/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: payload.email, password: payload.password })
    });
    saveAuth(auth);
    await loadSocial();
    routeTo("#/profile");
    render();
  } catch (error) {
    authView(error.message);
  }
}

async function homeView(page = 1) {
  await loadSocial();
  const friends = acceptedFriendIds();
  const authorIds = [currentUser().id, ...friends];
  const filter = encodeURIComponent(authorIds.map((id) => `author.id="${id}"`).join(" || "));
  const posts = await api(`/api/collections/posts/records?page=${page}&perPage=${pageSize}&sort=-created&expand=author&filter=${filter}`);
  state.currentPage = posts.page;
  setHtml(`
    ${shell("Update Your Status", `
      <form id="post-form" class="post-form">
        <textarea name="body" placeholder="What are you doing right now?"></textarea>
        <div class="form-actions">
          <input name="image" type="file" accept="image/*">
          <button type="submit">Post</button>
        </div>
      </form>
    `)}
    ${shell("News Feed", `
      ${posts.items.length ? posts.items.map(postHtml).join("") : '<div class="empty">No posts yet. Add a friend or write the first update.</div>'}
      <div class="pager">
        <button class="secondary" data-page="${posts.page - 1}" ${posts.page <= 1 ? "disabled" : ""}>Previous</button>
        <span>Page ${posts.page} of ${posts.totalPages || 1}</span>
        <button class="secondary" data-page="${posts.page + 1}" ${posts.page >= posts.totalPages ? "disabled" : ""}>Next</button>
      </div>
    `)}
  `);
  document.querySelector("#post-form").addEventListener("submit", handlePost);
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.disabled) homeView(Number(button.dataset.page));
    });
  });
}

function postHtml(post) {
  const author = post.expand?.author || userById(post.author) || {};
  const image = post.image ? `<div><img class="post-image" src="${fileUrl(post, post.image, "300x300")}" alt=""></div>` : "";
  return `
    <article class="post">
      <a href="#/profile/${author.id}">${avatarHtml(author)}</a>
      <div>
        <a href="#/profile/${author.id}">${escapeHtml(author.name || "Someone")}</a>
        <div class="meta">${new Date(post.created).toLocaleString()}</div>
        <p>${normalizeEditor(post.body || "")}</p>
        ${image}
      </div>
    </article>
  `;
}

async function handlePost(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  form.set("author", currentUser().id);
  form.set("visibility", "friends");
  try {
    await api("/api/collections/posts/records", { method: "POST", body: form });
    await homeView(1);
  } catch (error) {
    setHtml(flash(error.message, "error") + app.innerHTML);
  }
}

async function profileView(id = currentUser().id) {
  await loadSocial();
  const user = id === currentUser().id ? currentUser() : await api(`/api/collections/users/records/${id}`);
  const relation = relationshipWith(user.id);
  const isMe = user.id === currentUser().id;
  setHtml(`
    <div class="blue-title">${escapeHtml(user.name)}'s Profile</div>
    <div class="box profile-layout">
      <aside>
        <div class="photo-box">
          ${avatarHtml(user, "large")}
          ${isMe ? '<form id="picture-form" class="form-actions"><input name="profile_picture" type="file" accept="image/*"><button type="submit">Upload Picture</button></form>' : ""}
        </div>
      </aside>
      <section>
        ${!isMe ? `<div class="notice">${escapeHtml(relation.label)} <span class="row-actions">${relation.action}</span></div>` : ""}
        <table class="details-table">
          <tr><th>Name</th><td>${escapeHtml(user.name)}</td></tr>
          <tr><th>School</th><td>${escapeHtml(user.school || "Harvard University")}</td></tr>
          <tr><th>Class Year</th><td>${escapeHtml(user.class_year || "")}</td></tr>
          <tr><th>Concentration</th><td>${escapeHtml(user.concentration || "")}</td></tr>
          <tr><th>Residence</th><td>${escapeHtml(user.residence || "")}</td></tr>
          <tr><th>Relationship</th><td>${escapeHtml(user.relationship_status || "")}</td></tr>
          <tr><th>Bio</th><td>${normalizeEditor(user.bio || "")}</td></tr>
        </table>
        ${isMe ? editProfileForm(user) : ""}
      </section>
    </div>
  `);
  bindSocialActions();
  document.querySelector("#picture-form")?.addEventListener("submit", handlePicture);
  document.querySelector("#edit-profile-form")?.addEventListener("submit", handleProfileUpdate);
}

function editProfileForm(user) {
  return `
    <div class="blue-title" style="margin-top:12px">Edit Profile</div>
    <form id="edit-profile-form" class="box form-grid">
      <label>Name:</label><input name="name" value="${escapeHtml(user.name || "")}" required>
      <label>School:</label><input name="school" value="${escapeHtml(user.school || "")}">
      <label>Class Year:</label><input name="class_year" type="number" value="${escapeHtml(user.class_year || "")}">
      <label>Concentration:</label><input name="concentration" value="${escapeHtml(user.concentration || "")}">
      <label>Residence:</label><input name="residence" value="${escapeHtml(user.residence || "")}">
      <label>Relationship:</label><input name="relationship_status" value="${escapeHtml(user.relationship_status || "")}">
      <label>Bio:</label><textarea name="bio">${escapeHtml(user.bio || "")}</textarea>
      <div></div><button type="submit">Save Changes</button>
    </form>
  `;
}

async function handlePicture(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const record = await api(`/api/collections/users/records/${currentUser().id}`, { method: "PATCH", body: form });
    saveAuth({ ...state.auth, record });
    profileView();
  } catch (error) {
    setHtml(flash(error.message, "error") + app.innerHTML);
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.class_year = Number(payload.class_year) || null;
  try {
    const record = await api(`/api/collections/users/records/${currentUser().id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    saveAuth({ ...state.auth, record });
    profileView();
  } catch (error) {
    setHtml(flash(error.message, "error") + app.innerHTML);
  }
}

async function friendsView() {
  await loadSocial();
  const incoming = incomingFriendRequests();
  const friends = acceptedFriendIds().map(userById).filter(Boolean);
  setHtml(`
    ${shell("Friend Requests", incoming.length ? incoming.map(requestHtml).join("") : '<div class="empty">No pending friend requests.</div>')}
    ${shell("My Friends", friends.length ? friends.map(personHtml).join("") : '<div class="empty">No friends yet. Search for classmates to add them.</div>')}
  `);
  bindSocialActions();
}

async function notificationsView() {
  await loadSocial();
  const requests = incomingFriendRequests();
  const pokes = incomingPokes();
  const body = [
    ...requests.map(notificationRequestHtml),
    ...pokes.map(notificationPokeHtml)
  ].join("");

  setHtml(`
    ${shell("Notifications", body || '<div class="empty">No new pokes or friend requests.</div>')}
  `);
  bindSocialActions();
}

function notificationRequestHtml(request) {
  const requester = request.expand?.requester || userById(request.requester) || {};
  return `
    <div class="notification-row">
      <a href="#/profile/${requester.id}">${avatarHtml(requester)}</a>
      <div>
        <div class="notification-kind">Friend Request</div>
        <a href="#/profile/${requester.id}">${escapeHtml(requester.name || "Someone")}</a>
        <div class="meta">wants to be your friend</div>
        <div class="row-actions">
          <button data-action="accept" data-id="${request.id}">Confirm</button>
          <button class="secondary" data-action="reject" data-id="${request.id}">Reject</button>
        </div>
      </div>
    </div>
  `;
}

function notificationPokeHtml(poke) {
  const sender = poke.expand?.from || userById(poke.from) || {};
  return `
    <div class="notification-row">
      <a href="#/profile/${sender.id}">${avatarHtml(sender)}</a>
      <div>
        <div class="notification-kind">Poke</div>
        <a href="#/profile/${sender.id}">${escapeHtml(sender.name || "Someone")}</a>
        <div class="meta">poked you on ${new Date(poke.created).toLocaleString()}</div>
        <div class="row-actions">
          <button data-action="poke" data-id="${sender.id}">Poke Back</button>
          <a href="#/pokes">View Pokes</a>
        </div>
      </div>
    </div>
  `;
}

function requestHtml(request) {
  const requester = request.expand?.requester || userById(request.requester) || {};
  return `
    <div class="person-row">
      <a href="#/profile/${requester.id}">${avatarHtml(requester)}</a>
      <div>
        <a href="#/profile/${requester.id}">${escapeHtml(requester.name)}</a>
        <div class="meta">wants to be your friend</div>
        <div class="row-actions">
          <button data-action="accept" data-id="${request.id}">Confirm</button>
          <button class="secondary" data-action="reject" data-id="${request.id}">Reject</button>
        </div>
      </div>
    </div>
  `;
}

function personHtml(person) {
  const relation = relationshipWith(person.id);
  return `
    <div class="person-row">
      <a href="#/profile/${person.id}">${avatarHtml(person)}</a>
      <div>
        <a href="#/profile/${person.id}">${escapeHtml(person.name)}</a>
        <div class="meta">${escapeHtml(person.school || "Harvard University")} ${person.class_year ? `, '${String(person.class_year).slice(-2)}` : ""}</div>
        <div class="row-actions">${relation.action || `<span>${escapeHtml(relation.label)}</span>`}</div>
      </div>
    </div>
  `;
}

async function searchView(query = "") {
  await loadSocial();
  const lower = query.trim().toLowerCase();
  const results = state.people.filter((person) => {
    if (person.id === currentUser().id) return false;
    if (!lower) return true;
    return [person.name, person.email, person.school, person.concentration].some((value) => String(value || "").toLowerCase().includes(lower));
  });
  setHtml(`
    <div class="blue-title">Search thefacebook</div>
    <div class="box">
      <form id="search-form" class="quick-search">
        <input name="q" type="search" value="${escapeHtml(query)}" placeholder="name, email, school">
        <button type="submit">Search</button>
      </form>
    </div>
    ${shell("Search Results", results.length ? results.map(personHtml).join("") : '<div class="empty">No people matched your search.</div>')}
  `);
  document.querySelector("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    routeTo(`#/search?q=${encodeURIComponent(q)}`);
  });
  bindSocialActions();
}

async function pokesView() {
  await loadSocial();
  const incoming = state.pokes.filter((poke) => poke.to === currentUser().id);
  const outgoing = state.pokes.filter((poke) => poke.from === currentUser().id);
  setHtml(`
    ${shell("Pokes Received", incoming.length ? incoming.map(pokeHtml).join("") : '<div class="empty">Nobody has poked you yet.</div>')}
    ${shell("Pokes Sent", outgoing.length ? outgoing.map(pokeHtml).join("") : '<div class="empty">You have not poked anyone yet.</div>')}
  `);
}

function pokeHtml(poke) {
  const otherId = poke.from === currentUser().id ? poke.to : poke.from;
  const other = poke.expand?.from?.id === otherId ? poke.expand.from : poke.expand?.to || userById(otherId) || {};
  return `
    <div class="poke-row">
      <a href="#/profile/${other.id}">${avatarHtml(other)}</a>
      <div>
        <a href="#/profile/${other.id}">${escapeHtml(other.name || "Someone")}</a>
        <div class="meta">${poke.from === currentUser().id ? "You poked them" : "Poked you"} on ${new Date(poke.created).toLocaleString()}</div>
      </div>
    </div>
  `;
}

async function sendFriend(userId) {
  const existing = state.friendships.find((item) => {
    return (item.requester === currentUser().id && item.recipient === userId) || (item.requester === userId && item.recipient === currentUser().id);
  });
  if (existing && existing.status === "rejected") {
    await api(`/api/collections/friend_requests/records/${existing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending", requester: currentUser().id, recipient: userId })
    });
  } else {
    await api("/api/collections/friend_requests/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requester: currentUser().id, recipient: userId, status: "pending" })
    });
  }
  render();
}

async function updateFriendRequest(id, status) {
  await api(`/api/collections/friend_requests/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  render();
}

async function poke(userId) {
  await api("/api/collections/pokes/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: currentUser().id, to: userId, message: "poke" })
  });
  render();
}

function bindSocialActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        if (button.dataset.action === "friend") await sendFriend(button.dataset.id);
        if (button.dataset.action === "accept") await updateFriendRequest(button.dataset.id, "accepted");
        if (button.dataset.action === "reject") await updateFriendRequest(button.dataset.id, "rejected");
        if (button.dataset.action === "poke") await poke(button.dataset.id);
      } catch (error) {
        setHtml(flash(error.message, "error") + app.innerHTML);
      }
    });
  });
}

async function render() {
  syncChrome();
  if (!state.auth?.token) {
    authView();
    return;
  }

  try {
    const hash = location.hash || "#/";
    const [path, queryString = ""] = hash.slice(1).split("?");
    const params = new URLSearchParams(queryString);
    if (path === "/" || path === "") return homeView(Number(params.get("page")) || 1);
    if (path === "/profile") return profileView();
    if (path.startsWith("/profile/")) return profileView(path.split("/")[2]);
    if (path === "/friends") return friendsView();
    if (path === "/notifications") return notificationsView();
    if (path === "/search") return searchView(params.get("q") || "");
    if (path === "/pokes") return pokesView();
    return homeView();
  } catch (error) {
    if (String(error.message).toLowerCase().includes("unauthorized")) {
      saveAuth(null);
      authView("Please log in again.");
      return;
    }
    setHtml(flash(error.message, "error"));
  }
}

logoutButton.addEventListener("click", () => {
  saveAuth(null);
  routeTo("#/");
  render();
});

quickSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  const q = quickSearchInput.value.trim();
  if (state.auth?.token) routeTo(`#/search?q=${encodeURIComponent(q)}`);
});

window.addEventListener("hashchange", render);
syncChrome();
render();
