# thefacebook 2005 prototype

A tiny PocketBase-backed SPA inspired by the early 2005 Facebook experience.

## Run it

```sh
npm run setup
npm run dev
```

In another terminal, seed the cofounder accounts:

```sh
npm run seed
```

The app runs at:

- Site: http://127.0.0.1:8091
- PocketBase admin: http://127.0.0.1:8091/_/

Use `PORT=8090 npm run dev` if you specifically want port 8090 and it is free.

## Seed Accounts

All seed users use the password `password123`.

- mark@thefacebook.test
- dustin@thefacebook.test
- chris@thefacebook.test
- eduardo@thefacebook.test
- andrew@thefacebook.test

The seed script also creates accepted friendships and a few posts so the news feed is useful immediately.

## Features

- Email/password sign up and login
- User search
- Friend requests and accepted friendships
- Pokes
- Status posts with optional image upload
- Profile pictures with a classic default silhouette placeholder
- Paginated friends-only news feed
- 2005-style blue header, left navigation, profile boxes, and footer copyright
