import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3003";

export const auth = betterAuth({
  baseURL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
  }),
  user: {
    modelName: "User",
  },
  session: {
    modelName: "Session",
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: "AuthAccount",
  },
  emailAndPassword: {
    enabled: true,
  },
});
