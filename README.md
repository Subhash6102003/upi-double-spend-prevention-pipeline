# UPI Concurrent Transfer Idempotency & Distributed Saga Pipeline

> Compare-And-Swap (CAS) optimistic balance locking, strict idempotency key tracking, and compensating saga transactions.

**Domain:** Banking & Financial Technology (Fintech)  
**Architecture Pattern:** Typed Stage-based Pipeline DAG with Sagas & State Machine  

---

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


---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 22.0.0
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/systemflow-b1-double-spend.git
cd systemflow-b1-double-spend

# Install dependencies
npm install
```

### Running Tests & Typechecks

```bash
# Run the complete test suite (includes race condition & concurrency tests)
npm test

# Build production TypeScript output
npm run build

# Run typechecker
npm run typecheck
```

---

## 🏛️ Pipeline DAG Architecture

All pipeline stages are type-safe and execute in ordered succession. If any stage throws a transient error, compensating saga rollbacks run in reverse order to ensure 100% data consistency.

```
src/
├── core/                  # Embedded zero-dependency Pipeline Engine & Saga Rollback
│   ├── pipeline.ts
│   ├── types.ts
│   ├── logger.ts
│   └── errors.ts
├── stages/                # Modular pipeline stages
├── pipeline.ts            # Stage assembly & DAG orchestrator
├── types.ts               # Domain interfaces & state contracts
└── index.ts               # Public library API export
```

---

## 🚀 GitHub Actions CI

Every commit and pull request runs automated build, typecheck, and vitest race condition tests via `.github/workflows/ci.yml`.

## 📄 License
MIT
