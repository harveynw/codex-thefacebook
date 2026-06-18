/// <reference path="../pb_data/types.d.ts" />

function addFields(collection, fields) {
  for (const field of fields) {
    collection.fields.add(field);
  }
}

function text(name, options = {}) {
  return new TextField({
    name,
    required: Boolean(options.required),
    max: options.max || 0,
    presentable: Boolean(options.presentable)
  });
}

function number(name) {
  return new NumberField({
    name,
    onlyInt: true
  });
}

function editor(name) {
  return new EditorField({
    name,
    maxSize: 2000
  });
}

function file(name, maxSize) {
  return new FileField({
    name,
    maxSelect: 1,
    maxSize,
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    thumbs: ["120x120", "300x300"]
  });
}

function relation(name, collectionId, required = true) {
  return new RelationField({
    name,
    collectionId,
    cascadeDelete: false,
    minSelect: required ? 1 : 0,
    maxSelect: 1,
    required
  });
}

function select(name, values, required = false) {
  return new SelectField({
    name,
    values,
    maxSelect: 1,
    required
  });
}

function timestamps() {
  return [
    new AutodateField({
      name: "created",
      system: true,
      onCreate: true
    }),
    new AutodateField({
      name: "updated",
      system: true,
      onCreate: true,
      onUpdate: true
    })
  ];
}

function findOrCreateUsers(app) {
  try {
    return app.findCollectionByNameOrId("users");
  } catch (_) {
    return new Collection({ name: "users", type: "auth" });
  }
}

migrate((app) => {
  const users = findOrCreateUsers(app);

  addFields(users, [
    text("name", { required: true, max: 80, presentable: true }),
    text("school", { max: 120 }),
    number("class_year"),
    text("concentration", { max: 120 }),
    text("residence", { max: 120 }),
    text("relationship_status", { max: 80 }),
    editor("bio"),
    file("profile_picture", 5242880)
  ]);

  users.listRule = "@request.auth.id != ''";
  users.viewRule = "@request.auth.id != ''";
  users.createRule = "";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";
  users.authRule = "";
  users.passwordAuth.enabled = true;
  users.passwordAuth.identityFields = ["email"];
  users.addIndex("idx_users_name", false, "name", "");
  users.addIndex("idx_users_school", false, "school", "");
  app.save(users);

  const userCollection = app.findCollectionByNameOrId("users");

  const friendRequests = new Collection({ name: "friend_requests", type: "base" });
  addFields(friendRequests, [
    ...timestamps(),
    relation("requester", userCollection.id),
    relation("recipient", userCollection.id),
    select("status", ["pending", "accepted", "rejected"], true)
  ]);
  friendRequests.listRule = "@request.auth.id != '' && (requester = @request.auth.id || recipient = @request.auth.id)";
  friendRequests.viewRule = "@request.auth.id != '' && (requester = @request.auth.id || recipient = @request.auth.id)";
  friendRequests.createRule = "@request.auth.id != '' && requester = @request.auth.id && requester != recipient";
  friendRequests.updateRule = "@request.auth.id != '' && (recipient = @request.auth.id || requester = @request.auth.id)";
  friendRequests.deleteRule = "@request.auth.id != '' && (recipient = @request.auth.id || requester = @request.auth.id)";
  friendRequests.addIndex("idx_friend_requests_pair", true, "requester, recipient", "");
  app.save(friendRequests);

  const posts = new Collection({ name: "posts", type: "base" });
  addFields(posts, [
    ...timestamps(),
    relation("author", userCollection.id),
    editor("body"),
    file("image", 10485760),
    select("visibility", ["friends", "public"], true)
  ]);
  posts.listRule = "@request.auth.id != ''";
  posts.viewRule = "@request.auth.id != ''";
  posts.createRule = "@request.auth.id != '' && author = @request.auth.id";
  posts.updateRule = "@request.auth.id != '' && author = @request.auth.id";
  posts.deleteRule = "@request.auth.id != '' && author = @request.auth.id";
  posts.addIndex("idx_posts_author_created", false, "author, created", "");
  app.save(posts);

  const pokes = new Collection({ name: "pokes", type: "base" });
  addFields(pokes, [
    ...timestamps(),
    relation("from", userCollection.id),
    relation("to", userCollection.id),
    text("message", { max: 120 })
  ]);
  pokes.listRule = "@request.auth.id != '' && (from = @request.auth.id || to = @request.auth.id)";
  pokes.viewRule = "@request.auth.id != '' && (from = @request.auth.id || to = @request.auth.id)";
  pokes.createRule = "@request.auth.id != '' && from = @request.auth.id && from != to";
  pokes.updateRule = null;
  pokes.deleteRule = "@request.auth.id != '' && (from = @request.auth.id || to = @request.auth.id)";
  pokes.addIndex("idx_pokes_to_created", false, "to, created", "");
  app.save(pokes);
}, (app) => {
  for (const name of ["pokes", "posts", "friend_requests"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {}
  }

  try {
    const users = app.findCollectionByNameOrId("users");
    for (const field of ["profile_picture", "bio", "relationship_status", "residence", "concentration", "class_year", "school"]) {
      users.fields.removeByName(field);
    }
    app.save(users);
  } catch (_) {}
});
