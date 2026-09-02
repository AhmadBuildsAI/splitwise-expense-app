import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const password = await argon2.hash("Password123");

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { username: "alice", email: "alice@example.com", passwordHash: password },
  });
  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { username: "bob", email: "bob@example.com", passwordHash: password },
  });
  const charlie = await prisma.user.upsert({
    where: { email: "charlie@example.com" },
    update: {},
    create: { username: "charlie", email: "charlie@example.com", passwordHash: password },
  });

  const group = await prisma.group.create({
    data: {
      name: "Roommates",
      createdBy: alice.id,
      members: {
        create: [{ userId: alice.id }, { userId: bob.id }, { userId: charlie.id }],
      },
    },
  });

  const expense = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Groceries",
      totalAmount: 6000,
      paidByUserId: alice.id,
      splitType: "EQUAL",
      date: new Date(),
      createdBy: alice.id,
      splits: {
        create: [
          { userId: alice.id, amountOwed: 2000 },
          { userId: bob.id, amountOwed: 2000 },
          { userId: charlie.id, amountOwed: 2000 },
        ],
      },
    },
  });

  await prisma.activity.create({
    data: {
      groupId: group.id,
      actorUserId: alice.id,
      eventType: "EXPENSE_CREATED",
      entityId: expense.id,
      metadata: { description: expense.description, totalAmount: expense.totalAmount },
    },
  });

  console.log("Seed complete:");
  console.log("  alice@example.com / Password123");
  console.log("  bob@example.com / Password123");
  console.log("  charlie@example.com / Password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
