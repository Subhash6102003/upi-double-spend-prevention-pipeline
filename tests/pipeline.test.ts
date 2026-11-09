import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '../src/ledger.js';
import { createTransferPipeline } from '../src/pipeline.js';
import type { TransferRequest } from '../src/types.js';

describe('B1 — UPI Double-Spend Prevention Pipeline', () => {
  let ledger: LedgerStore;
  let pipeline: ReturnType<typeof createTransferPipeline>;

  beforeEach(() => {
    ledger = new LedgerStore();
    pipeline = createTransferPipeline(ledger);

    ledger.createAccount('ACC-ALICE', 'Alice Sharma', 500);
    ledger.createAccount('ACC-BOB', 'Bob Kumar', 0);
  });

  it('successfully transfers ₹200 from Alice to Bob', async () => {
    const req: TransferRequest = {
      idempotencyKey: 'idemp-1',
      sourceAccount: 'ACC-ALICE',
      destinationAccount: 'ACC-BOB',
      amount: 200,
    };

    const res = await pipeline.run(req);
    expect(res.status).toBe('success');
    expect(res.output?.status).toBe('success');
    expect(res.output?.sourceBalance).toBe(300);
    expect(res.output?.destinationBalance).toBe(200);

    const alice = ledger.getAccount('ACC-ALICE');
    const bob = ledger.getAccount('ACC-BOB');
    expect(alice?.balance).toBe(300);
    expect(bob?.balance).toBe(200);
  });

  it('blocks duplicate submission with the same idempotency key', async () => {
    const req: TransferRequest = {
      idempotencyKey: 'idemp-dup-1',
      sourceAccount: 'ACC-ALICE',
      destinationAccount: 'ACC-BOB',
      amount: 100,
    };

    const res1 = await pipeline.run(req);
    expect(res1.status).toBe('success');

    // Second identical request
    const res2 = await pipeline.run(req);
    expect(res2.status).toBe('failed');
    expect(res2.error).toContain('idempotency');

    // Alice should only have been debited once
    const alice = ledger.getAccount('ACC-ALICE');
    expect(alice?.balance).toBe(400);
  });

  it('rejects transfer when balance is insufficient', async () => {
    const req: TransferRequest = {
      idempotencyKey: 'idemp-overdraft',
      sourceAccount: 'ACC-ALICE',
      destinationAccount: 'ACC-BOB',
      amount: 1000, // Alice only has 500
    };

    const res = await pipeline.run(req);
    expect(res.status).toBe('failed');
    expect(res.error).toContain('Insufficient funds');

    const alice = ledger.getAccount('ACC-ALICE');
    expect(alice?.balance).toBe(500);
  });

  it('CRITICAL: 20 concurrent requests for ₹500 on ₹500 balance results in exactly 1 success and 0 negative balance', async () => {
    const requests: TransferRequest[] = Array.from({ length: 20 }, (_, i) => ({
      idempotencyKey: `concurrent-key-${i}`,
      sourceAccount: 'ACC-ALICE',
      destinationAccount: 'ACC-BOB',
      amount: 500,
    }));

    // Fire all 20 simultaneously
    const results = await Promise.all(requests.map((r) => pipeline.run(r)));

    const successful = results.filter((r) => r.status === 'success');
    const failed = results.filter((r) => r.status === 'failed');

    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(19);

    const alice = ledger.getAccount('ACC-ALICE');
    const bob = ledger.getAccount('ACC-BOB');

    // Inviolable banking invariant: balance is never negative
    expect(alice?.balance).toBe(0);
    expect(bob?.balance).toBe(500);
  });

  it('compensates and refunds source account when destination account is invalid', async () => {
    const req: TransferRequest = {
      idempotencyKey: 'idemp-non-existent',
      sourceAccount: 'ACC-ALICE',
      destinationAccount: 'ACC-INVALID-999',
      amount: 150,
    };

    const res = await pipeline.run(req);
    expect(res.status).toBe('failed');

    // Alice's balance must be refunded by saga compensation
    const alice = ledger.getAccount('ACC-ALICE');
    expect(alice?.balance).toBe(500);
  });
});
