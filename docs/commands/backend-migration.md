# 1. Delete the placeholder migration folder

rm -rf server/prisma/migrations

# 2. Reset the DB (drops all tables — safe, no real data)

pnpm --filter server exec prisma migrate reset --force --skip-seed

# 3. Create the real initial migration

pnpm --filter server exec prisma migrate dev --name init
