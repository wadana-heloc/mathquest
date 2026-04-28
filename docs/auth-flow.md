# Auth flow

Scope: what happens end-to-end when a user signs up, logs in, and later
calls a protected endpoint. Cross-references the TDD and Permissions
Matrix line items this design satisfies.

Spec refs: `MathQuest_TDD_v1.1.docx` §9.1, §9.2; `MathQuest_Permissions_Matrix_v2.xlsx`
Server Constraints SC-06 and SC-13.

---

## Components

```
┌──────────────────┐       ┌────────────────────┐       ┌──────────────────────┐
│ Browser (Next.js)│  ───► │  FastAPI backend   │  ───► │ Supabase (GoTrue +    │
│  /auth page      │       │  /auth/*           │       │ Postgres + auth.users)│
└──────────────────┘       └────────────────────┘       └──────────────────────┘
         ▲                          │                           │
         │                          │  service_role key         │ RLS-enforced reads
         │                          ▼                           ▼
         │              auth.admin.create_user      public.users (trigger-populated)
         │              auth.sign_in_with_password
         │              auth.admin.sign_out
         │
         └── access_token (JWT) ◄───┘
              (client chooses storage; see "Token handling" below)
```

Keys by trust level:

| Key                          | Held by             | Bypasses RLS | Ships to browser |
| ---------------------------- | ------------------- | ------------ | ---------------- |
| `SUPABASE_SERVICE_ROLE_KEY`  | FastAPI only        | Yes          | **Never**        |
| `SUPABASE_ANON_KEY`          | FastAPI only today (browser later if we add a direct client) | No | Safe to        |
| Caller's access token (JWT)  | Browser → FastAPI   | No           | Yes              |

---

## Signup (parent only)

```
Browser                       FastAPI                     Supabase
───────                       ───────                     ────────
submit { email,
         password,
         display_name,
         terms_accepted }
          │
          ├───► POST /auth/signup
          │               │
          │               │ validate terms_accepted = true           (422 if not)
          │               │ pydantic validates email + len(password)  (422 if not)
          │               │
          │               ├───► admin.create_user({
          │               │       email_confirm: true,
          │               │       app_metadata: { role: "parent",
          │               │                       display_name },
          │               │       user_metadata: { display_name }
          │               │     })
          │               │                                           ┌─── INSERT INTO auth.users
          │               │                                           │      (… raw_app_meta_data,
          │               │                                           │       raw_user_meta_data)
          │               │                                           │    TRIGGER on_auth_user_created
          │               │                                           │      → handle_new_user()
          │               │                                           │        reads raw_app_meta_data for role (→ 'parent')
          │               │                                           │        reads raw_user_meta_data for display_name
          │               │                                           │    INSERT INTO public.users
          │               │                                           ▼
          │               │◄─── { user: { id, email, ... } }
          │               │
          │               │ SELECT * FROM public.users WHERE id = user.id
          │               │     (via admin client, bypasses RLS — we just inserted
          │               │      and want a consistent read)
          │               │
          │               │ sign_in_with_password(email, password)
          │               │     (dev-friendly: skip the "please log in" step.
          │               │      If email confirmation is enabled in prod,
          │               │      this returns an error — we catch it and
          │               │      return session=null.)
          │               │◄─── { user, session? }
          │               │
          │◄─── 201 { user, session }
```

**Why the admin API for signup, not `auth.sign_up()`?**

- `auth.sign_up()` writes `raw_user_meta_data`, which the end user
  controls. If our trigger read role from there, anyone could self-register
  as a child. So our trigger reads from `raw_app_meta_data` — and only
  `admin.create_user()` can set that field. See SC-06.

**Where is role 'parent' forced?**

1. The FastAPI handler only ever sets `app_metadata.role = "parent"`.
2. The DB trigger defaults role to `'parent'` when `raw_app_meta_data`
   has no role (defence-in-depth against a future handler bug).
3. The `users_role_check` + `users_parent_consistency` CHECK constraints
   reject any row that claims role='child' without a valid `parent_id`.

Three independent layers. Any one of them can fail without breaking the
invariant.

---

## Login (parent or child)

```
Browser                       FastAPI                     Supabase
submit { email, password }
          │
          ├───► POST /auth/login
          │               │
          │               ├───► auth.sign_in_with_password(email, password)
          │               │                                           ┌─── SELECT auth.users by email
          │               │                                           │    hash-compare password
          │               │                                           │    issue JWT pair
          │               │                                           ▼
          │               │◄─── AuthApiError
          │               │      │                       if credentials invalid (same msg for
          │               │      │                       "no such email" and "wrong password" —
          │               │      │                       do NOT special-case; leaking account
          │               │      │                       existence is a real vuln)
          │               │      │
          │               │      └─► raise InvalidCredentials ───► 401
          │               │
          │               │ SELECT * FROM public.users WHERE id = user.id   (read current role from DB)
          │               │
          │◄─── 200 { user, session }
```

**Why re-read role from `public.users` on every login?**

Because we must never trust role claims that a client-held token could
contain. See TDD §9.1: "role is derived from the users table on every
API request — never from client-supplied claims."

---

## Protected calls (`GET /auth/me` and later endpoints)

```
Browser                       FastAPI                     Supabase
───────                       ───────                     ────────
GET /auth/me
Authorization: Bearer <access_token>
          │
          ├───► dependency get_current_user:
          │               │ inspect JWT header → read `alg` and `kid`
          │               │
          │               │ if alg = ES256/RS256/EdDSA:
          │               │     fetch JWKS from
          │               │       <SUPABASE_URL>/auth/v1/.well-known/jwks.json
          │               │     (cached 10 min; refetch on unknown kid)
          │               │     pick key by kid, verify signature
          │               │
          │               │ if alg = HS256 (legacy):
          │               │     verify with SUPABASE_JWT_SECRET
          │               │
          │               │ extract UUID from 'sub' claim
          │               │
          │               │ SELECT from public.users via admin client
          │               │
          │◄─── 200 { id, email, role, display_name, ... }
```

**Why these two algorithms?**

Supabase projects default to asymmetric-key signing (ES256 / RS256 /
EdDSA depending on project config). The private key stays with
Supabase; the public key is published at
`<project>/auth/v1/.well-known/jwks.json`. We cache the JWKS for 10
minutes so `/auth/me` is not paying a network round-trip per call.
Cache miss still costs a single HTTP GET to Supabase, not a full
verification dialogue.

HS256 is kept as a fallback for legacy projects that still use the
single shared JWT secret.

Either way, verification is done entirely in this process — Supabase is
asked for the public key, not for a verdict.

---

## Logout

```
POST /auth/logout
Authorization: Bearer <access_token>
          │
          ├───► get_current_user (verify JWT)
          │
          │ admin.auth.admin.sign_out(user_id)
          │     ─► revokes ALL refresh tokens for this user across all devices.
          │        The currently-held access token is still valid until it
          │        expires on its own (JWTs are stateless). That's expected
          │        and matches Supabase's design — the stolen-token window
          │        is bounded by access_token TTL (1h default).
          │
          ◄── 204 No Content
```

---

## Error codes

| HTTP | Code                         | When                                                 |
| ---- | ---------------------------- | ---------------------------------------------------- |
| 401  | `not_authenticated`          | Missing/invalid bearer token on a protected route.   |
| 401  | `invalid_credentials`        | `/auth/login` with wrong password OR unknown email. |
| 409  | `email_already_registered`   | `/auth/signup` hits a duplicate.                    |
| 422  | `terms_not_accepted`         | Signup without the parent/guardian checkbox.         |
| 422  | `weak_password`              | Password fails Supabase or local policy.             |
| 422  | (pydantic default)           | Any other schema validation error.                   |

Shape (TDD §10.1): `{ "error": "...", "code": "...", "status": 4xx }`.

---

## Token handling (client-side guidance)

The API returns `session.access_token` + `session.refresh_token` in the
login/signup response body. The client chooses how to store them. Two
common paths:

- **`localStorage`** — simple, works across origins, but XSS-exposed.
- **httpOnly cookies** — requires same-origin deployment or
  CORS-with-credentials + cookie `SameSite=None; Secure`. Set by the
  backend on login response (not yet implemented; see Open items).

The API itself is stateless w.r.t. storage choice: every protected
endpoint takes `Authorization: Bearer <access_token>`.

## Open items (backend)

- **Email confirmation**: disabled in dev for iteration speed. Before
  prod, enable it in the Supabase dashboard; the `/auth/signup` handler
  already degrades gracefully (`session=null` in the response).
- **Password reset / forgot password**: `POST /auth/password-reset/request` +
  `POST /auth/password-reset/confirm` — not yet implemented.
- **httpOnly cookie mode**: optional future enhancement — set
  `Secure; HttpOnly; SameSite=Lax` cookies in the `/auth/login` response
  when requested. Requires same-origin deployment or a custom-domain
  CORS-with-credentials setup.
- **Rate limiting**: not yet on auth endpoints. Guards against
  credential stuffing; good candidate for the next iteration.
