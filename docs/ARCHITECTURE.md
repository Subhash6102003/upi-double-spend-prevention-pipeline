# B1 — UPI Double-Spend Prevention: Architecture

## Problem

A user with ₹500 balance taps "Pay" simultaneously on PhonePe and Google Pay (or experiences mobile app retries during network latency).
Without concurrency control:
1. Process A reads balance = ₹500
2. Process B reads balance = ₹500
3. Process A debits ₹500 → balance = ₹0
4. Process B debits ₹500 → balance = -₹500 (bank loss)

## Solution Architecture: CAS Optimistic Lock + Idempotency + Distributed Saga

```
Transfer Request
      ↓
[1. Idempotency Check]   → Blocks re-submissions with duplicate keys
      ↓
[2. Optimistic Debit]    → CAS version check (UPDATE ... WHERE version=v AND balance >= amount)
      ↓ (Compensates by refunding if downstream fails)
[3. Destination Credit]  → Credits recipient
      ↓
[4. Finalize & Commit]   → Writes immutable transaction log
```

### Guarantees
- **Strict Idempotency**: Each transfer intent has an immutable key.
- **Race Condition Prevention**: CAS version locking prevents double-debit even under parallel threads.
- **Atomicity via Saga Compensation**: If the downstream receiving bank network drops, the debit stage rollback immediately restores funds to the source account.
