import { Prisma } from "@prisma/client";
import type { Account, AccountType, Position } from "@apex/shared";
import { prisma } from "../db";
import { dayString } from "./time";

type AccountWithPositions = Prisma.AccountGetPayload<{
  include: { positions: true };
}>;

/** Effective value: sum of positions when present, else the account balance. */
export function serializeAccount(a: AccountWithPositions): Account {
  const positions: Position[] = [...a.positions]
    .sort((x, y) => y.valueAed - x.valueAed)
    .map((p) => ({
      id: p.id,
      name: p.name,
      valueAed: p.valueAed,
      updatedAt: p.updatedAt.toISOString(),
    }));
  const valueAed = positions.length
    ? positions.reduce((s, p) => s + p.valueAed, 0)
    : a.balanceAed;
  return {
    id: a.id,
    name: a.name,
    type: a.type as AccountType,
    provider: a.provider,
    balanceAed: a.balanceAed,
    valueAed: Math.round(valueAed * 100) / 100,
    sortOrder: a.sortOrder,
    updatedAt: a.updatedAt.toISOString(),
    positions,
  };
}

export async function loadAccounts(userId: string): Promise<Account[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { positions: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return accounts.map(serializeAccount);
}

export function netWorthTotal(accounts: Account[]): number {
  return Math.round(accounts.reduce((s, a) => s + a.valueAed, 0) * 100) / 100;
}

/** Recompute net worth and upsert today's snapshot (one row per local day). */
export async function recordSnapshot(userId: string): Promise<number> {
  const accounts = await loadAccounts(userId);
  const total = netWorthTotal(accounts);
  const day = dayString();
  await prisma.netWorthSnapshot.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, totalAed: total },
    update: { totalAed: total },
  });
  return total;
}
