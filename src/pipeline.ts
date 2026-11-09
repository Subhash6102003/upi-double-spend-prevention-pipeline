import { Pipeline } from './core/index.js';
import type { TransferRequest, TransferOutcome } from './types.js';
import type { LedgerStore } from './ledger.js';
import { createIdempotencyStage } from './stages/idempotency.js';
import { createDebitStage } from './stages/debit.js';
import { createCreditStage } from './stages/credit.js';
import { createFinalizeStage } from './stages/finalize.js';
import type { Stage, PipelineResult } from './core/index.js';

export function createTransferPipeline(ledger: LedgerStore) {
  const pipeline = new Pipeline<TransferRequest, TransferOutcome>('upi-transfer');

  const stages: Stage<unknown, unknown>[] = [
    createIdempotencyStage(ledger) as Stage<unknown, unknown>,
    createDebitStage(ledger) as Stage<unknown, unknown>,
    createCreditStage(ledger) as Stage<unknown, unknown>,
    createFinalizeStage(ledger) as Stage<unknown, unknown>,
  ];

  return {
    async run(request: TransferRequest): Promise<PipelineResult<TransferOutcome>> {
      return pipeline.run(stages, request);
    },
  };
}
