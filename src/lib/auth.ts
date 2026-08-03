import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import {
  clearLoginAttempts,
  isLoginRateLimited,
  registerFailedLoginAttempt,
} from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";
import { extractClientIp, recordSecurityEvent } from "@/lib/security-events";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/logout",
  },
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: {
          label: "Adresse e-mail",
          type: "email",
        },
        password: {
          label: "Mot de passe",
          type: "password",
        },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        const ipAddress = extractClientIp(req?.headers ?? {});
        const userAgent =
          (req?.headers as Record<string, string | undefined> | undefined)?.[
            "user-agent"
          ] ?? null;

        if (!email || !password) {
          return null;
        }

        if (isLoginRateLimited(email)) {
          await recordSecurityEvent({
            type: "LOGIN_FAILURE",
            email,
            ipAddress,
            userAgent,
            detail: "Bloqué par le rate limiting",
          });
          throw new Error(
            "Trop de tentatives échouées. Réessayez dans quelques minutes.",
          );
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (
          !user ||
          user.disabled ||
          !(await compare(password, user.passwordHash))
        ) {
          registerFailedLoginAttempt(email);
          await recordSecurityEvent({
            type: "LOGIN_FAILURE",
            email,
            userId: user?.id,
            ipAddress,
            userAgent,
            detail: !user
              ? "Compte inconnu"
              : user.disabled
                ? "Compte désactivé"
                : "Mot de passe invalide",
          });
          return null;
        }

        clearLoginAttempts(email);
        await recordSecurityEvent({
          type: "LOGIN_SUCCESS",
          email,
          userId: user.id,
          ipAddress,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    },
  },
};
