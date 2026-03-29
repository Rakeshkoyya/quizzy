import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
});

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  return { id: session.user.id, email: session.user.email };
}
