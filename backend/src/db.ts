import { PrismaClient } from '@prisma/client';

// Une SEULE instance de PrismaClient pour tout le processus. En creer une par
// module ouvre autant de pools de connexions, et le pooler Supabase en mode
// transaction les compte toutes.
export const prisma = new PrismaClient();
