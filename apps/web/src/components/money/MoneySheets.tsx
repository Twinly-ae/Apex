import { useState } from "react";
import type { AccountType, BillCadence } from "@apex/shared";
import { useAddAccount, useAddBill } from "../../lib/queries";
import {
  Sheet,
  inputClass,
  primaryButtonClass,
  selectClass,
} from "../ui/Sheet";

export function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const add = useAddAccount();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [balance, setBalance] = useState("");

  async function submit() {
    if (!name.trim()) return;
    await add.mutateAsync({
      name: name.trim(),
      type,
      balanceAed: Number(balance) || 0,
    });
    setName("");
    setType("cash");
    setBalance("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add account">
      <div className="space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. StashAway, Cash, xCube"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className={selectClass}
            >
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Balance (AED)</span>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          For investment accounts, add individual holdings (Aldar, Emaar…) after
          creating it — their sum becomes the account value.
        </p>
        <button
          onClick={submit}
          disabled={add.isPending || !name.trim()}
          className={primaryButtonClass}
        >
          {add.isPending ? "Adding…" : "Add account"}
        </button>
      </div>
    </Sheet>
  );
}

export function BillSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const add = useAddBill();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<BillCadence>("monthly");
  const [due, setDue] = useState("");

  async function submit() {
    if (!name.trim() || !amount || !due) return;
    await add.mutateAsync({
      name: name.trim(),
      amountAed: Number(amount),
      cadence,
      nextDueDate: new Date(`${due}T12:00:00`).toISOString(),
    });
    setName("");
    setAmount("");
    setCadence("monthly");
    setDue("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add bill / subscription">
      <div className="space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Adobe, Rent, Netflix"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Amount (AED)</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Repeats</span>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as BillCadence)}
              className={selectClass}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="once">Once</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Next due</span>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          onClick={submit}
          disabled={add.isPending || !name.trim() || !amount || !due}
          className={primaryButtonClass}
        >
          {add.isPending ? "Adding…" : "Add bill"}
        </button>
      </div>
    </Sheet>
  );
}
