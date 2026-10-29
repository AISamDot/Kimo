import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { newId, readApp, updateApp } from "./store";
import type { User } from "./types";

// Simple email + password auth. Passwords are hashed with scrypt; the login
// cookie holds a random token, and only its SHA-256 hash is stored server-side.

export const SESSION_COOKIE = "mib_session";
const SESSION_DAYS = 30;

export type PublicUser = Pick<User, "id" | "email" | "name" | "role">;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const toPublic = (u: User): PublicUser => ({ id: u.id, email: u.email, name: u.name, role: u.role });
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

// Basic brute-force protection: 10 failed logins per email per 15 minutes.
const failures = new Map<string, number[]>();
function tooManyFailures(email: string) {
  const now = Date.now();
  const recent = (failures.get(email) ?? []).filter((t) => now - t < 15 * 60_000);
  failures.set(email, recent);
  return recent.length >= 10;
}

export async function signUp(input: { email: string; password: string; name: string }): Promise<PublicUser> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  return await updateApp((app) => {
    const first = app.users.length === 0;
    if (!first && !app.allowSignups) throw new Error("Sign-ups are closed. Ask the admin to open them.");
    if (app.users.some((u) => u.email === email)) throw new Error("An account with this email already exists.");
    const user: User = {
      id: newId("usr"),
      email,
      name: input.name.trim() || email.split("@")[0],
      role: first ? "admin" : "user",
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    app.users.push(user);
    return toPublic(user);
  });
}

export async function logIn(emailRaw: string, password: string): Promise<PublicUser> {
  const email = normalizeEmail(emailRaw);
  if (tooManyFailures(email)) throw new Error("Too many failed attempts. Try again in 15 minutes.");
  const user = (await readApp()).users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    failures.set(email, [...(failures.get(email) ?? []), Date.now()]);
    throw new Error("Wrong email or password.");
  }
  failures.delete(email);
  return toPublic(user);
}

/** Creates a login session and sets the cookie (Route Handlers / Server Functions only). */
export async function startSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  await updateApp((app) => {
    app.authSessions = app.authSessions.filter((s) => new Date(s.expiresAt) > now);
    app.authSessions.push({ tokenHash: sha256(token), userId, createdAt: now.toISOString(), expiresAt: expires.toISOString() });
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.BUDDY_INSECURE_COOKIES !== "1",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const h = sha256(token);
    await updateApp((app) => {
      app.authSessions = app.authSessions.filter((s) => s.tokenHash !== h);
    });
  }
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const app = await readApp();
  const h = sha256(token);
  const s = app.authSessions.find((x) => x.tokenHash === h && new Date(x.expiresAt) > new Date());
  if (!s) return null;
  const u = app.users.find((x) => x.id === s.userId);
  return u ? toPublic(u) : null;
}

/** For pages: returns the user or redirects to /login. */
export async function requireUser(): Promise<PublicUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** For route handlers: returns the user or throws a 401. */
export async function apiUser(): Promise<PublicUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not logged in");
  return u;
}

export async function apiAdmin(): Promise<PublicUser> {
  const u = await apiUser();
  if (u.role !== "admin") throw new HttpError(403, "Only the admin can change integrations.");
  return u;
}

export async function changePassword(userId: string, current: string, next: string) {
  if (next.length < 8) throw new Error("New password must be at least 8 characters.");
  await updateApp((app) => {
    const u = app.users.find((x) => x.id === userId);
    if (!u || !verifyPassword(current, u.passwordHash)) throw new Error("Current password is wrong.");
    u.passwordHash = hashPassword(next);
    app.authSessions = app.authSessions.filter((s) => s.userId !== userId);
  });
}
