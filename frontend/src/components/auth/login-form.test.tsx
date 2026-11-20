import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/lib/api/auth", () => ({
  useLogin: () => ({ mutateAsync: mocks.mutateAsync }),
}));

import { LoginForm } from "./login-form";

beforeEach(() => {
  mocks.mutateAsync.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
  mocks.searchParams = new URLSearchParams();
});

describe("LoginForm", () => {
  it("rejects an invalid email before calling the API", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("fills the demo credentials with one click", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "admin" }));

    expect(screen.getByLabelText("Email")).toHaveValue("admin@demo.com");
    expect(screen.getByLabelText("Password")).toHaveValue("Password123!");
  });

  it("shows the server's authentication error", async () => {
    mocks.mutateAsync.mockRejectedValue(
      new ApiError("Invalid email or password", 401, "invalid_credentials"),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "member@demo.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("ignores an absolute next URL after sign-in (open-redirect guard)", async () => {
    mocks.searchParams = new URLSearchParams("next=//evil.example/phish");
    mocks.mutateAsync.mockResolvedValue({ id: 2, full_name: "Max", role: "member" });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "member@demo.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
  });
});
