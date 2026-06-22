import { useState } from "react";
import type { Account } from "@apex/shared";
import {
  useAddPosition,
  useDeleteAccount,
  useDeletePosition,
  useUpdateAccount,
  useUpdatePosition,
} from "../../lib/queries";
import { InlineNumber } from "./InlineNumber";

export function AccountCard({ account }: { account: Account }) {
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const addPosition = useAddPosition();
  const updatePosition = useUpdatePosition();
  const deletePosition = useDeletePosition();
  const [newPos, setNewPos] = useState("");
  const [newVal, setNewVal] = useState("");
  const isInvestment = account.type === "investment";

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-text">{account.name}</div>
          <div className="text-xs capitalize text-muted">
            {account.provider ?? account.type}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-text">
            AED {account.valueAed.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted">
            updated {new Date(account.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {!isInvestment && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Balance (AED)</span>
          <InlineNumber
            value={account.balanceAed}
            onSave={(v) =>
              updateAccount.mutate({ id: account.id, input: { balanceAed: v } })
            }
          />
        </div>
      )}

      {isInvestment && (
        <div className="mt-3 space-y-2">
          {account.positions.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-text">{p.name}</span>
              <div className="flex items-center gap-3">
                <InlineNumber
                  value={p.valueAed}
                  onSave={(v) =>
                    updatePosition.mutate({ id: p.id, input: { valueAed: v } })
                  }
                />
                <button
                  onClick={() => deletePosition.mutate(p.id)}
                  className="text-muted hover:text-bad"
                  aria-label="Remove holding"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPos.trim() || !newVal) return;
              addPosition.mutate({
                accountId: account.id,
                input: { name: newPos.trim(), valueAed: Number(newVal) },
              });
              setNewPos("");
              setNewVal("");
            }}
            className="flex gap-2 pt-1"
          >
            <input
              value={newPos}
              onChange={(e) => setNewPos(e.target.value)}
              placeholder="Holding (e.g. Aldar)"
              className="flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
            <input
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              type="number"
              inputMode="decimal"
              placeholder="AED"
              className="w-20 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
            <button className="rounded-lg bg-surface-2 px-3 text-muted active:text-text">
              +
            </button>
          </form>
        </div>
      )}

      <div className="mt-3 text-right">
        <button
          onClick={() => deleteAccount.mutate(account.id)}
          className="text-xs text-muted hover:text-bad"
        >
          Remove account
        </button>
      </div>
    </div>
  );
}
