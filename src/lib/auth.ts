import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import {
  clearLoginAttempts,
  isLoginRateLimited,
  registerFailedLoginAttempt,
} from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";

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
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        if (isLoginRateLimited(email)) {
          throw new Error(
            "Trop de tentatives échouées. Réessayez dans quelques minutes.",
          );
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !(await compare(password, user.passwordHash))) {
          registerFailedLoginAttempt(email);
          return null;
        }

        clearLoginAttempts(email);

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
