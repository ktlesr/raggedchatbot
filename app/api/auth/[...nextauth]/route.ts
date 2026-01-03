
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

interface CustomUser {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
    image?: string | null;
}

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const sql = neon(process.env.DATABASE_URL!);
                const users = await sql`SELECT * FROM users WHERE email = ${credentials.email} LIMIT 1`;

                if (users.length === 0) return null;
                const user = users[0];

                if (!user.password) return null; // No password for Google users

                const isValid = await bcrypt.compare(credentials.password, user.password);
                if (!isValid) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                } as any;
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (!user.email) return false;

            const sql = neon(process.env.DATABASE_URL!);

            if (account?.provider === "google") {
                // Upsert user into Neon
                await sql`
                    INSERT INTO users (id, name, email, image)
                    VALUES (${user.id}, ${user.name || ""}, ${user.email}, ${user.image || ""})
                    ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    image = EXCLUDED.image;
                `;
            }

            // Auto-promote specific email to admin
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail && user.email === adminEmail) {
                await sql`UPDATE users SET role = 'admin' WHERE email = ${user.email}`;
            }

            return true;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                const sql = neon(process.env.DATABASE_URL!);
                const result = await sql`SELECT role FROM users WHERE id = ${token.sub} LIMIT 1`;
                if (result.length > 0) {
                    (session.user as CustomUser).role = result[0].role;
                    (session.user as CustomUser).id = token.sub;
                }
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    pages: {
        signIn: "/login",
    },
});

export { handler as GET, handler as POST };
