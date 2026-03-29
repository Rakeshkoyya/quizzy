export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/exams/:path*",
    "/api/exams/:path*",
    "/api/attempts/:path*",
  ],
};
