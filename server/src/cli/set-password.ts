// Sets a staff member's password from the server shell — the way in for the first
// admin when OTP SMS isn't available. Ships compiled in dist/, so on the droplet:
//   cd /var/www/keyafe/current/server && sudo -u deploy node dist/cli/set-password.js 7003416278
import readline from "node:readline";
import { Writable } from "node:stream";
import { prisma } from "../config/db.js";
import { passwordSchema } from "../lib/password.js";
import { phoneLookupVariants } from "../lib/phone.js";
import { setStaffPassword } from "../modules/staff/staff.service.js";
import { CUSTOMER_ROLE_SLUG } from "../modules/staff/rbac.catalog.js";

function createPrompter() {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: process.stdin.isTTY ?? false,
  });
  // The iterator buffers lines, so piped input with both answers isn't lost.
  const lines = rl[Symbol.asyncIterator]();

  return {
    async askHidden(question: string): Promise<string> {
      process.stdout.write(question);
      muted = true;
      const { value } = await lines.next();
      muted = false;
      process.stdout.write("\n");
      return typeof value === "string" ? value : "";
    },
    close: () => rl.close(),
  };
}

async function findStaffByPhone(phone: string) {
  for (const variant of phoneLookupVariants(phone)) {
    const user = await prisma.user.findUnique({
      where: { phone: variant },
      include: { role: true },
    });
    if (user) return user;
  }
  return null;
}

async function main(): Promise<number> {
  const phone = process.argv[2]?.trim();
  if (!phone) {
    console.error("Usage: node dist/cli/set-password.js <staff phone number>");
    return 1;
  }

  const user = await findStaffByPhone(phone);
  if (!user || user.role.slug === CUSTOMER_ROLE_SLUG) {
    console.error(`No staff account found for ${phone}.`);
    return 1;
  }
  if (!user.isActive) {
    console.error(`${user.name} (${user.phone}) is disabled. Re-enable the account first.`);
    return 1;
  }

  console.log(`Setting a password for ${user.name} (${user.phone}, ${user.role.name}).`);
  const prompter = createPrompter();
  const password = await prompter.askHidden("New password: ");
  const confirm = await prompter.askHidden("Repeat password: ");
  prompter.close();

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    console.error(parsed.error.issues[0]?.message ?? "Invalid password");
    return 1;
  }
  if (password !== confirm) {
    console.error("Passwords don't match. Nothing was changed.");
    return 1;
  }

  await setStaffPassword(user.id, password);
  console.log("Password set. Sign in to the admin with this phone number and password.");
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
