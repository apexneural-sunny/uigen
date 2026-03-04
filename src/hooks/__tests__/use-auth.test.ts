import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// --- Mocks ---

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

// --- Helpers ---

const PROJECT_STUB = { id: "proj-123", name: "Test Project" } as any;

function renderAuth() {
  return renderHook(() => useAuth());
}

// --- Setup / Teardown ---

beforeEach(() => {
  vi.clearAllMocks();

  // Safe defaults so tests that don't care about post-sign-in flow don't throw
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([PROJECT_STUB]);
  mockCreateProject.mockResolvedValue(PROJECT_STUB);
});

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

describe("initial state", () => {
  test("exposes signIn, signUp and isLoading", () => {
    const { result } = renderAuth();

    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signIn
// ─────────────────────────────────────────────────────────────────────────────

describe("signIn", () => {
  test("calls signIn action with provided credentials", async () => {
    mockSignIn.mockResolvedValue({ success: true });

    const { result } = renderAuth();

    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the result from the signIn action on success", async () => {
    mockSignIn.mockResolvedValue({ success: true });

    const { result } = renderAuth();

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@example.com", "pass");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns the result from the signIn action on failure", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderAuth();

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("bad@example.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("sets isLoading to true while signing in then false afterwards", async () => {
    let resolveSignIn!: (v: any) => void;
    mockSignIn.mockReturnValue(
      new Promise((res) => { resolveSignIn = res; })
    );
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([PROJECT_STUB]);

    const { result } = renderAuth();

    let pendingAct: Promise<void>;
    act(() => {
      pendingAct = result.current.signIn("u@e.com", "pass") as any;
    });

    // isLoading should be true immediately after calling signIn
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: true });
      await pendingAct!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signIn action throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));

    const { result } = renderAuth();

    await act(async () => {
      try {
        await result.current.signIn("u@e.com", "pass");
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does NOT trigger post-sign-in logic when signIn fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Wrong password" });

    const { result } = renderAuth();

    await act(async () => {
      await result.current.signIn("u@e.com", "wrong");
    });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signUp
// ─────────────────────────────────────────────────────────────────────────────

describe("signUp", () => {
  test("calls signUp action with provided credentials", async () => {
    mockSignUp.mockResolvedValue({ success: true });

    const { result } = renderAuth();

    await act(async () => {
      await result.current.signUp("new@example.com", "securepass");
    });

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "securepass");
  });

  test("returns the result from the signUp action on success", async () => {
    mockSignUp.mockResolvedValue({ success: true });

    const { result } = renderAuth();

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("new@example.com", "securepass");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns the result from the signUp action on failure", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderAuth();

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("exists@example.com", "pass");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
  });

  test("sets isLoading to true during signUp then resets to false", async () => {
    let resolveSignUp!: (v: any) => void;
    mockSignUp.mockReturnValue(
      new Promise((res) => { resolveSignUp = res; })
    );
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([PROJECT_STUB]);

    const { result } = renderAuth();

    let pendingAct: Promise<void>;
    act(() => {
      pendingAct = result.current.signUp("u@e.com", "pass") as any;
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: true });
      await pendingAct!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when signUp action throws", async () => {
    mockSignUp.mockRejectedValue(new Error("Server error"));

    const { result } = renderAuth();

    await act(async () => {
      try {
        await result.current.signUp("u@e.com", "pass");
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does NOT trigger post-sign-in logic when signUp fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderAuth();

    await act(async () => {
      await result.current.signUp("exists@example.com", "pass");
    });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Post-sign-in flow (shared by both signIn and signUp)
// ─────────────────────────────────────────────────────────────────────────────

describe("post-sign-in flow", () => {
  describe("when anonymous work exists", () => {
    const anonMessages = [{ role: "user", content: "build me a button" }];
    const anonFsData = { "/App.jsx": "export default function App() {}" };

    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonFsData,
      });
    });

    test("creates a project with the anonymous work", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "anon-proj-1" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: anonMessages,
        data: anonFsData,
      });
    });

    test("clears anonymous work after creating the project", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "anon-proj-1" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockClearAnonWork).toHaveBeenCalledTimes(1);
    });

    test("navigates to the newly created project", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "anon-proj-1" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-proj-1");
    });

    test("does NOT call getProjects when anonymous work is present", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "anon-proj-1" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    test("works the same way after signUp with anon work", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "anon-proj-2" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signUp("new@example.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalled();
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-proj-2");
    });
  });

  describe("when anonymous work has no messages (empty)", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    });

    test("falls through to existing projects when messages array is empty", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "existing-1" } as any]);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-1");
    });
  });

  describe("when no anonymous work exists", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(null);
    });

    test("navigates to the most recent existing project", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([
        { id: "recent-proj" } as any,
        { id: "older-proj" } as any,
      ]);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    });

    test("does NOT create a new project when existing projects are found", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "existing-proj" } as any]);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("creates a new project when the user has no existing projects", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-proj" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #/),
        messages: [],
        data: {},
      });
    });

    test("navigates to the newly created project when user has no existing projects", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-proj" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signIn("u@e.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
    });

    test("works the same way for signUp with no existing projects", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "signup-new-proj" } as any);

      const { result } = renderAuth();

      await act(async () => {
        await result.current.signUp("brand@new.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/signup-new-proj");
    });
  });
});
