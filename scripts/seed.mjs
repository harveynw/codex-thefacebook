const baseUrl = process.env.PB_URL ?? "http://127.0.0.1:8091";
const password = "password123";

const founders = [
  {
    email: "mark@thefacebook.test",
    name: "Mark Zuckerberg",
    school: "Harvard University",
    class_year: 2006,
    concentration: "Computer Science",
    residence: "Kirkland House",
    relationship_status: "It's complicated",
    bio: "I am trying to make the world more open, one profile at a time."
  },
  {
    email: "dustin@thefacebook.test",
    name: "Dustin Moskovitz",
    school: "Harvard University",
    class_year: 2006,
    concentration: "Economics",
    residence: "Kirkland House",
    relationship_status: "Single",
    bio: "Working on the site and keeping the servers alive."
  },
  {
    email: "chris@thefacebook.test",
    name: "Chris Hughes",
    school: "Harvard University",
    class_year: 2006,
    concentration: "History and Literature",
    residence: "Kirkland House",
    relationship_status: "Single",
    bio: "Helping students find each other around campus."
  },
  {
    email: "eduardo@thefacebook.test",
    name: "Eduardo Saverin",
    school: "Harvard University",
    class_year: 2006,
    concentration: "Economics",
    residence: "Eliot House",
    relationship_status: "Single",
    bio: "Business things, ads things, and the occasional party listing."
  },
  {
    email: "andrew@thefacebook.test",
    name: "Andrew McCollum",
    school: "Harvard University",
    class_year: 2007,
    concentration: "Computer Science",
    residence: "Lowell House",
    relationship_status: "Single",
    bio: "Designing marks, icons, and whatever else this thing needs."
  }
];

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.message ?? res.statusText;
    const details = body?.data ? ` ${JSON.stringify(body.data)}` : "";
    throw new Error(`${options.method ?? "GET"} ${path}: ${message}${details}`);
  }
  return body;
}

async function list(path) {
  return request(path);
}

async function createUser(founder) {
  const existing = await list(`/api/collections/users/records?filter=${encodeURIComponent(`email="${founder.email}" || name="${founder.name}"`)}`);
  if (existing.items.length) return existing.items[0];

  try {
    return await request("/api/collections/users/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...founder,
        emailVisibility: true,
        password,
        passwordConfirm: password
      })
    });
  } catch (error) {
    if (!error.message.includes("validation_not_unique")) throw error;
    return (await login(founder.email)).record;
  }
}

async function login(email) {
  return request("/api/collections/users/auth-with-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password })
  });
}

async function authed(token, path, options = {}) {
  return request(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });
}

async function ensureFriendship(actor, recipient) {
  const filter = encodeURIComponent(`(requester.id="${actor.record.id}" && recipient.id="${recipient.id}") || (requester.id="${recipient.id}" && recipient.id="${actor.record.id}")`);
  const existing = await authed(actor.token, `/api/collections/friend_requests/records?filter=${filter}`);
  if (existing.items.length) return existing.items[0];

  return authed(actor.token, "/api/collections/friend_requests/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requester: actor.record.id,
      recipient: recipient.id,
      status: "accepted"
    })
  });
}

async function ensurePost(actor, text, visibility = "friends") {
  const filter = encodeURIComponent(`author.id="${actor.record.id}" && body="${text.replaceAll('"', '\\"')}"`);
  const existing = await authed(actor.token, `/api/collections/posts/records?filter=${filter}`);
  if (existing.items.length) return existing.items[0];

  return authed(actor.token, "/api/collections/posts/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author: actor.record.id,
      body: text,
      visibility
    })
  });
}

const users = [];
for (const founder of founders) {
  users.push(await createUser(founder));
}

const sessions = {};
for (const founder of founders) {
  sessions[founder.email] = await login(founder.email);
}

for (const user of users.slice(1)) {
  await ensureFriendship(sessions["mark@thefacebook.test"], user);
}
await ensureFriendship(sessions["dustin@thefacebook.test"], users.find((user) => user.email === "chris@thefacebook.test"));
await ensureFriendship(sessions["eduardo@thefacebook.test"], users.find((user) => user.email === "andrew@thefacebook.test"));

await ensurePost(sessions["mark@thefacebook.test"], "Thefacebook is now open for the spring semester. Tell your friends.");
await ensurePost(sessions["dustin@thefacebook.test"], "Added a few more schools to the list. Sleep is allegedly still optional.");
await ensurePost(sessions["chris@thefacebook.test"], "Profiles are better when you fill out the details. Just saying.");
await ensurePost(sessions["eduardo@thefacebook.test"], "Looking for people interested in campus advertising. Message me.");
await ensurePost(sessions["andrew@thefacebook.test"], "Trying out a new default profile picture. Very official.");

console.log("Seed complete. Founder accounts use password: password123");
