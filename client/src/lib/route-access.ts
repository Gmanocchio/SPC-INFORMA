export type ProtectedRouteUser = {
  user: {
    mustChangePassword: boolean;
    role: string;
  };
};

export type ProtectedRouteDecision =
  | { status: "loading" }
  | { status: "redirect"; path: "/acesso" | "/app/primeiro-acesso" | "/app" }
  | { status: "allow" };

export function protectedRouteDecision(input: {
  loading: boolean;
  user: ProtectedRouteUser | null;
  spcOnly?: boolean;
}): ProtectedRouteDecision {
  if (input.loading) return { status: "loading" };
  if (!input.user) return { status: "redirect", path: "/acesso" };
  if (input.user.user.mustChangePassword) {
    return { status: "redirect", path: "/app/primeiro-acesso" };
  }
  if (input.spcOnly && input.user.user.role !== "SPC_ADMIN") {
    return { status: "redirect", path: "/app" };
  }
  return { status: "allow" };
}
