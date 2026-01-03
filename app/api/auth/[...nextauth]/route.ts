
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { neon } from "@neondatabase/serverless";

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            const sql = neon(process.env.DATABASE_URL!);

            // Upsert user into Neon
            await sql`
        INSERT INTO users (id, name, email, image)
        VALUES (${user.id}, ${user.name || ""}, ${user.email}, ${user.image || ""})
        ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        image = EXCLUDED.image;
      `;

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
                    (session.user as any).role = result[0].role;
                    (session.user as any).id = token.sub;
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
