import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Pure label function tests (no rendering needed)
// ---------------------------------------------------------------------------

test("getToolLabel: str_replace_editor create", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "src/App.jsx" })).toBe("Creating App.jsx");
});

test("getToolLabel: str_replace_editor str_replace", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "src/components/Card.tsx" })).toBe("Editing Card.tsx");
});

test("getToolLabel: str_replace_editor insert", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "src/components/Card.tsx" })).toBe("Editing Card.tsx");
});

test("getToolLabel: str_replace_editor view", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "src/lib/index.ts" })).toBe("Reading index.ts");
});

test("getToolLabel: str_replace_editor undo_edit", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "src/App.jsx" })).toBe("Undoing changes to App.jsx");
});

test("getToolLabel: str_replace_editor unknown command falls back to Editing", () => {
  expect(getToolLabel("str_replace_editor", { command: "unknown", path: "src/App.jsx" })).toBe("Editing App.jsx");
});

test("getToolLabel: str_replace_editor missing path uses 'file' fallback", () => {
  expect(getToolLabel("str_replace_editor", { command: "create" })).toBe("Creating file");
});

test("getToolLabel: str_replace_editor missing args uses 'file' fallback", () => {
  expect(getToolLabel("str_replace_editor", {})).toBe("Editing file");
});

test("getToolLabel: file_manager rename", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "src/old.jsx", new_path: "src/new.jsx" })).toBe("Renaming old.jsx to new.jsx");
});

test("getToolLabel: file_manager delete", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "src/lib/utils.ts" })).toBe("Deleting utils.ts");
});

test("getToolLabel: file_manager unknown command falls back to Managing", () => {
  expect(getToolLabel("file_manager", { command: "unknown", path: "src/App.jsx" })).toBe("Managing App.jsx");
});

test("getToolLabel: unknown tool name returns raw toolName", () => {
  expect(getToolLabel("some_other_tool", { command: "create", path: "foo.js" })).toBe("some_other_tool");
});

// ---------------------------------------------------------------------------
// Component rendering tests
// ---------------------------------------------------------------------------

test("ToolCallBadge renders friendly label", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "src/App.jsx" },
        state: "call",
      }}
    />
  );
  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("ToolCallBadge shows spinner when pending (state: call)", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "src/App.jsx" },
        state: "call",
      }}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows green dot when done (state: result with truthy result)", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "src/App.jsx" },
        state: "result",
        result: "Success",
      }}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolCallBadge shows spinner when result is falsy", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "src/App.jsx" },
        state: "result",
        result: "",
      }}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("ToolCallBadge renders file_manager rename label", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "2",
        toolName: "file_manager",
        args: { command: "rename", path: "src/Old.jsx", new_path: "src/New.jsx" },
        state: "call",
      }}
    />
  );
  expect(screen.getByText("Renaming Old.jsx to New.jsx")).toBeDefined();
});

test("ToolCallBadge renders file_manager delete label", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "3",
        toolName: "file_manager",
        args: { command: "delete", path: "src/Unused.tsx" },
        state: "call",
      }}
    />
  );
  expect(screen.getByText("Deleting Unused.tsx")).toBeDefined();
});
