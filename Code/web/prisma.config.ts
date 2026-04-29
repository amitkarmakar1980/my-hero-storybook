// @ts-nocheck
import { defineConfig } from "prisma/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local so DATABASE_URL / DIRECT_URL are available during migrations
config({ path: resolve(__dirname, ".env.local") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrate: {
    async adapter() {
      const pool = new Pool({
        connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
      });
      return new PrismaPg(pool);
    },
  },
});
