import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const username = "admin";
  const password = "ChangeMe123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    console.log(`User "${username}" already exists.`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
    },
  });

  console.log("Admin user created successfully.");
  console.log(`Username: ${user.username}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });