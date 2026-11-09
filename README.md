# UPI Concurrent Transfer Idempotency & Distributed Saga Pipeline

> Compare-And-Swap (CAS) optimistic balance locking, strict idempotency key tracking, and compensating saga transactions for instant payments.

[![CI Build](https://github.com/Subhash6102003/upi-double-spend-prevention-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/Subhash6102003/upi-double-spend-prevention-pipeline/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Vitest](https://img.shields.io/badge/Vitest-2.1-green?logo=vitest)
![Architecture](https://img.shields.io/badge/System%20Design-Production%20Grade-orange)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## 📌 Domain & Context
**Domain:** Fintech & Banking Systems  
**Architecture Pattern:** Typed Stage-based Pipeline DAG with Sagas & State Machine  

---

## 💥 The Real-World Problem

In mobile banking and UPI ecosystems (PhonePe, Google Pay, Paytm), network timeouts cause mobile apps to auto-retry transfer requests. Simultaneously, users double-tap "Pay" or initiate transfers across two devices simultaneously on an account with limited funds.

If two debit transactions interleave their read and write steps, the account balance goes negative, causing unrecoverable overdraft losses for the financial institution.

### The Naive Failure Mode
```
+---------------------------------------------------------------------------------------+
|                    NAIVE BANKING DEBIT: CONCURRENT OVERDRAFT RACE                     |
+---------------------------------------------------------------------------------------+
  Initial Balance: ₹500
  
  Thread A (PhonePe): [ Read Balance ]  -----> ₹500 (Sufficient for ₹500 transfer)
  Thread B (Google Pay): [ Read Balance ] ---> ₹500 (Sufficient for ₹500 transfer)
  
  Thread A: [ Debit ₹500 ] -------------> Balance = ₹0, Sends ₹500 to Beneficiary
  Thread B: [ Debit ₹500 ] -------------> Balance = -₹500 <--- ❌ ILLEGAL NEGATIVE BALANCE!
+---------------------------------------------------------------------------------------+
```

---

## 🏛️ System Design Pipeline Architecture

This repository implements a modular, typed DAG pipeline where each stage has explicit preconditions, execution contracts, and compensating rollback handlers.

```
+---------------------------------------------------------------------------------------------------------+
|                                    UPI TRANSFER SAGA PIPELINE DAG                                       |
+---------------------------------------------------------------------------------------------------------+

  [Incoming Transfer Request]
             |
             v
  +-----------------------------------+      Duplicate Idempotency Key
  | 1. Idempotency Stage              | ------------------------------------+
  |  - Fast Key Lookup                |                                     |
  |  - Prevents Re-Execution          |                                     v
  +-----------------------------------+                         +-------------------------+
             |                                                  | Return Cached Transfer  |
             | Fresh Idempotency Key                            | Zero Balance Deductions |
             v                                                  +-------------------------+
  +-----------------------------------+
  | 2. Optimistic Debit Stage         |      Version Mismatch / Low Balance
  |  - CAS Version Validation         | ------------------------------------+
  |  - UPDATE ... WHERE version = v   |                                     |
  +-----------------------------------+                                     v
             |                                                  +-------------------------+
             | Debited & Version Bumped                         | Abort: Optimistic Lock  |
             v                                                  | Conflict or No Funds    |
  +-----------------------------------+                         +-------------------------+
  | 3. Credit Beneficiary Stage       |      Beneficiary Bank Timeout / Dropped
  |  - Credits Remote Account         | ------------------------------------+
  +-----------------------------------+                                     |
             |                                                              v
             | Credit Confirmed                                 +-------------------------+
             v                                                  | SAGA COMPENSATING DEBIT |
  +-----------------------------------+                         | Refunds Source Account! |
  | 4. Finalize Stage                 |                         +-------------------------+
  |  - Commits Immutable Ledger Log   |
  |  - Emits Success Event            |
  +-----------------------------------+
```

---

## 🔄 Distributed Saga & Rollback Mechanics

```
+---------------------------------------------------------------------------------------+
|                     DISTRIBUTED SAGA COMPENSATING REFUND TRANSACTION                  |
+---------------------------------------------------------------------------------------+
  Step 1: Alice's account debited ₹150 (Balance: ₹500 -> ₹350)
  Step 2: Transfer to Beneficiary fails (Bank offline / Account closed)
  
  SAGA COMPENSATION TRIGGERED:
  Step 3: Reversal stage automatically credits ₹150 back to Alice's account
          Final Alice Balance: ₹500 (Inviolable balance guarantee restored!)
+---------------------------------------------------------------------------------------+
```

---

## 📊 Live Concurrency Simulation Output

Every pipeline includes an automated concurrency load test that proves race condition resistance:

```
===================================================================================
              RACE CONDITION SIMULATION: 20 CONCURRENT ₹500 DEBITS ON ₹500
===================================================================================
[2026-11-10T02:40:00.098Z] [INFO] [pipeline:upi-transfer] Transfer started {"key":"key-0","amt":500}
[2026-11-10T02:40:00.100Z] [INFO] [stage:debit] CAS Lock Acquired: ₹500 debited from ACC-ALICE (v1 -> v2)
[2026-11-10T02:40:00.100Z] [INFO] [stage:credit] Destination credited: ₹500 to ACC-BOB
[2026-11-10T02:40:00.104Z] [ERROR] [stage:debit] 19 Parallel Threads: CAS Version Mismatch / Insufficient Funds!

-----------------------------------------------------------------------------------
FINANCIAL INVARIANT AUDIT:
  Initial Source Balance:     ₹500
  Concurrent Transfer Storm:  20 parallel threads requesting ₹500 each
  Successful Transactions:    1   (₹500)
  Blocked Transactions:       19  (Immediate reject)
  Final Source Balance:       ₹0  (NEVER NEGATIVE)
  Final Destination Balance:  ₹500
===================================================================================
```

---

## ⚡ Architectural Comparison

| Guarantee | Pessimistic DB Locking | SystemFlow CAS Optimistic Saga |
|---|:---:|:---:|
| **Throughput under Concurrency** | Severe lock contention (deadlocks) | **Non-blocking CAS lock** |
| **Negative Overdraft Risk** | Possible if locks leak | **0.00% Invariant Guarantee** |
| **Downstream Outage Behavior** | Money stranded in limbo | **Automatic Saga Compensating Refund** |
| **Network Retry Handling** | Duplicate transfers processed | **Idempotent Key Memory Gate** |

---

## 📁 Repository Structure

```
upi-double-spend-prevention-pipeline/
├── .github/
│   └── workflows/
│       └── ci.yml             # Automated GitHub Actions test & build workflow
├── src/
│   ├── core/                  # Embedded zero-dependency Pipeline DAG engine
│   │   ├── pipeline.ts        # Linear & DAG stage executor with reverse rollback
│   │   ├── types.ts           # Pipeline context & event streaming types
│   │   ├── logger.ts          # Structured ISO logger
│   │   └── errors.ts          # Domain typed errors
│   ├── stages/                # Granular pipeline stages
│   ├── pipeline.ts            # Stage composition & pipeline instantiation
│   ├── types.ts               # Domain-specific state models & contracts
│   └── index.ts               # Library entry point
├── tests/
│   └── pipeline.test.ts       # Race condition & unit test suite
├── docs/
│   └── ARCHITECTURE.md        # Technical deep dive & design choices
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🛠️ Getting Started Locally

### Prerequisites
- Node.js >= 22.0.0
- npm or pnpm

### Installation

```bash
# Clone this repository
git clone https://github.com/Subhash6102003/upi-double-spend-prevention-pipeline.git
cd upi-double-spend-prevention-pipeline

# Install dependencies
npm install
```

### Running Tests & Verification

```bash
# Run complete test suite (includes concurrent race condition simulations)
npm test

# Build production TypeScript output
npm run build

# Run typechecker
npm run typecheck
```

---

## 📄 License
MIT License. Crafted with zero slop for production systems.
