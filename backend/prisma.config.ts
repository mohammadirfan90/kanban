// Prisma 7 configuration — replaces the datasource.url that lived in schema.prisma
// See https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference

import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in the environment');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  // Prisma 7 still needs the connection string here for CLI commands like `migrate dev`
  datasource: {
    url: connectionString,
  },
  adapter: async () => new PrismaPg({ connectionString }),
});