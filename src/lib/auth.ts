// Copyright 2026 TheQuantAI
// NextAuth.js v5 configuration for QuantStudio
//
// Phase1_Implementation.md spec:
//   - GitHub OAuth (primary)
//   - Email/password (Keycloak in production, Credentials provider for v0.1 local dev)
//   - NextAuth.js + Keycloak provider

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

// In-memory user store for v0.1 local dev
// Will be replaced with PostgreSQL in Sprint 3
const users: Record<
  string,
  { id: string; name: string; email: string; password: string; image?: string }
> = {
  demo: {
    id: "user-demo",
    name: "Demo User",
    email: "demo@thequantcloud.com",
    password: "quantum123",
    image: undefined,
  },
};

export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Check in-memory store first
        const user = Object.values(users).find(
          (u) => u.email === email && u.password === password
        );
        if (user) {
          return { id: user.id, name: user.name, email: user.email, image: user.image };
        }

        // Auto-register new users in v0.1 (no email verification)
        const newId = `user-${Date.now().toString(36)}`;
        const newUser = {
          id: newId,
          name: email.split("@")[0],
          email,
          password,
        };
        users[newId] = newUser;
        return { id: newUser.id, name: newUser.name, email: newUser.email };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = nextUrl.pathname.startsWith("/dashboard");
      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
