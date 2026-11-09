import type { Stage, PipelineContext } from '../core/index.js';
import type { CreditResult, TransferOutcome } from '../types.js';
import type { LedgerStore } from '../ledger.js';

export function createFinalizeStage(ledger: LedgerStore): Stage<CreditResult, TransferOutcome> {
  return {
    id: 'finalize-transfer',
    name: 'Finalize Transfer & Commit Idempotency',
    description: 'Marks transfer completed and writes immutable idempotency record',
    async run(input: CreditResult, ctx: PipelineContext): Promise<TransferOutcome> {
      ledger.recordTransfer({
        transferId: input.transferId,
        idempotencyKey: input.request.idempotencyKey,
        sourceAccount: input.request.sourceAccount,
        destinationAccount: input.request.destinationAccount,
        amount: input.request.amount,
        status: 'completed',
        createdAt: input.debitedAt,
      });

      ctx.logger.info(`Transfer finalized successfully`, { transferId: input.transferId });

      return {
        status: 'success',
        transferId: input.transferId,
        sourceAccount: input.request.sourceAccount,
        destinationAccount: input.request.destinationAccount,
        amount: input.request.amount,
        sourceBalance: input.sourceBalanceAfter,
        destinationBalance: input.destinationBalanceAfter,
      };
    },
  };
}
