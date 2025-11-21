import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import type { WorkspaceRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const defaultWorkspaceName = (email?: string | null) => {
    if (!email) return 'My Workspace';
    const [username] = email.split('@');
    return `${username}'s Workspace`;
};

export const {
    handlers: authHandlers,
    signIn,
    signOut,
    auth,
} = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: 'jwt', // Changed to JWT for credentials provider compatibility
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            allowDangerousEmailAccountLinking: true,
        }),
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password required');
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user || !user.password) {
                    throw new Error('Invalid credentials');
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    throw new Error('Invalid credentials');
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async session({ session, user }) {
            if (session.user && user) {
                (session.user as typeof session.user & { id: string }).id = user.id;
                session.user.image = user.image;
                session.user.name = user.name;
                session.user.email = user.email;
            }
            return session;
        },
    },
    events: {
        async createUser({ user }) {
            const workspace = await prisma.workspace.create({
                data: {
                    name: defaultWorkspaceName(user.email),
                    slug: `workspace-${user.id.slice(0, 8)}`,
                    ownerId: user.id,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER' as WorkspaceRole,
                        },
                    },
                },
            });

            await prisma.board.create({
                data: {
                    title: 'Welcome Board',
                    userId: user.id,
                    workspaceId: workspace.id,
                    content: {},
                },
            });
        },
    },
});

