import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Migrations run as the owner; the app connects as the restricted quayzen_app role.
  datasource: { url: process.env.DATABASE_OWNER_URL! },
});
