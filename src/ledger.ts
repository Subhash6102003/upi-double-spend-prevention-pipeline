import type { BankAccount, TransferRecord } from './types.js';

export class LedgerStore {
  private accounts = new Map<string, BankAccount>();
  private processedKeys = new Map<string, TransferRecord>();

  createAccount(accountNumber: string, holderName: string, initialBalance: number): BankAccount {
    const acc: BankAccount = {
      accountNumber,
      holderName,
      balance: initialBalance,
      version: 1,
    };
    this.accounts.set(accountNumber, acc);
    return { ...acc };
  }

  getAccount(accountNumber: string): BankAccount | undefined {
    const acc = this.accounts.get(accountNumber);
    return acc ? { ...acc } : undefined;
  }

  hasIdempotencyKey(key: string): boolean {
    return this.processedKeys.has(key);
  }

  getTransferByKey(key: string): TransferRecord | undefined {
    return this.processedKeys.get(key);
  }

  recordTransfer(record: TransferRecord): void {
    this.processedKeys.set(record.idempotencyKey, { ...record });
  }

  /**
   * Optimistic debit using Compare-And-Swap.
   * Decrements only if balance is sufficient and version matches current version.
   */
  debit(accountNumber: string, amount: number, expectedVersion: number): { success: boolean; newBalance: number; newVersion: number } {
    const acc = this.accounts.get(accountNumber);
    if (!acc) throw new Error(`Account ${accountNumber} not found`);

    if (acc.version !== expectedVersion) {
      return { success: false, newBalance: acc.balance, newVersion: acc.version };
    }

    if (acc.balance < amount) {
      throw new Error(`Insufficient funds: account has ₹${acc.balance}, requested ₹${amount}`);
    }

    acc.balance -= amount;
    acc.version += 1;
    return { success: true, newBalance: acc.balance, newVersion: acc.version };
  }

  /**
   * Credit account.
   */
  credit(accountNumber: string, amount: number): { newBalance: number; newVersion: number } {
    const acc = this.accounts.get(accountNumber);
    if (!acc) throw new Error(`Account ${accountNumber} not found`);

    acc.balance += amount;
    acc.version += 1;
    return { newBalance: acc.balance, newVersion: acc.version };
  }

  clear(): void {
    this.accounts.clear();
    this.processedKeys.clear();
  }
}
