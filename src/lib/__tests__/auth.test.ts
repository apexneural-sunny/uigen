// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const inMemoryCookies: Record<string, string> = {};
const mockCookieStore = {
  get: vi.fn((name: string) =>
    inMemoryCookies[name] ? { value: inMemoryCookies[name] } : undefined
  ),
  set: vi.fn((name: string, value: string) => {
    inMemoryCookies[name] = value;
  }),
  delete: vi.fn((name: string) => {
    delete inMemoryCookies[name];
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

beforeEach(() => {
  Object.keys(inMemoryCookies).forEach((k) => delete inMemoryCookies[k]);
  vi.clearAllMocks();
});

function makeRequest(token?: string) {
  return {
    cookies: {
      get: (name: string) =>
        token && name === "auth-token" ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

// ─── createSession ────────────────────────────────────────────────────────────

test("createSession calls cookieStore.set with cookie name 'auth-token'", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  expect(mockCookieStore.set.mock.calls[0][0]).toBe("auth-token");
});

test("createSession sets httpOnly, sameSite lax, and path /", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2] as Record<string, unknown>;
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession sets secure:false when NODE_ENV is not production", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2] as Record<string, unknown>;
  expect(options.secure).toBe(false);
});

// ─── getSession ───────────────────────────────────────────────────────────────

test("getSession returns null when no cookie is present", async () => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns SessionPayload with correct userId and email after createSession", async () => {
  const { createSession, getSession } = await import("@/lib/auth");
  await createSession("user-42", "hello@example.com");

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-42");
  expect(session?.email).toBe("hello@example.com");
});

test("getSession returns null for a tampered JWT string", async () => {
  const { getSession } = await import("@/lib/auth");
  inMemoryCookies["auth-token"] = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.invalidsignature";

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a completely malformed token string", async () => {
  const { getSession } = await import("@/lib/auth");
  inMemoryCookies["auth-token"] = "not-a-jwt";

  const session = await getSession();
  expect(session).toBeNull();
});

// ─── deleteSession ────────────────────────────────────────────────────────────

test("deleteSession calls cookieStore.delete with 'auth-token'", async () => {
  const { deleteSession } = await import("@/lib/auth");
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

test("getSession returns null after deleteSession is called", async () => {
  const { createSession, deleteSession, getSession } = await import("@/lib/auth");
  await createSession("user-99", "gone@example.com");

  // Simulate cookie deletion by removing from in-memory store
  await deleteSession();

  const session = await getSession();
  expect(session).toBeNull();
});

// ─── verifySession ────────────────────────────────────────────────────────────

test("verifySession returns null when request has no auth-token cookie", async () => {
  const { verifySession } = await import("@/lib/auth");
  const session = await verifySession(makeRequest());
  expect(session).toBeNull();
});

test("verifySession returns SessionPayload with correct userId and email for a valid JWT", async () => {
  const { createSession, verifySession } = await import("@/lib/auth");
  await createSession("user-77", "verify@example.com");

  const token = inMemoryCookies["auth-token"];
  const session = await verifySession(makeRequest(token));

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-77");
  expect(session?.email).toBe("verify@example.com");
});

test("verifySession returns null for an invalid JWT in the request", async () => {
  const { verifySession } = await import("@/lib/auth");
  const session = await verifySession(
    makeRequest("eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.badsig")
  );
  expect(session).toBeNull();
});

test("verifySession returns null for a malformed token string in the request", async () => {
  const { verifySession } = await import("@/lib/auth");
  const session = await verifySession(makeRequest("totally-not-valid"));
  expect(session).toBeNull();
});

// ─── JWT_SECRET env var ───────────────────────────────────────────────────────

test("custom JWT_SECRET: token signed with custom secret is verifiable; default-secret token is not", async () => {
  // First create a token with the default secret
  const { createSession } = await import("@/lib/auth");
  await createSession("user-secret-test", "secret@example.com");
  const defaultToken = inMemoryCookies["auth-token"];

  // Now switch to a different secret and re-import auth module
  vi.resetModules();
  Object.keys(inMemoryCookies).forEach((k) => delete inMemoryCookies[k]);

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "my-custom-super-secret-key-for-testing";

  try {
    vi.mock("server-only", () => ({}));
    vi.mock("next/headers", () => ({
      cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
    }));

    const authWithCustomSecret = await import("@/lib/auth");

    // Create a token with the custom secret
    await authWithCustomSecret.createSession("user-custom", "custom@example.com");
    const customToken = inMemoryCookies["auth-token"];

    // Custom-secret token should verify successfully
    const validSession = await authWithCustomSecret.verifySession(makeRequest(customToken));
    expect(validSession).not.toBeNull();
    expect(validSession?.userId).toBe("user-custom");

    // Default-secret token should NOT verify with the custom secret
    const invalidSession = await authWithCustomSecret.verifySession(makeRequest(defaultToken));
    expect(invalidSession).toBeNull();
  } finally {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    vi.resetModules();
  }
});
