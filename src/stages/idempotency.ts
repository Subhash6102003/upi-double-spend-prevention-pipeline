import type { Stage, PipelineContext } from '../core/index.js';
import { IdempotencyError } from '../core/index.js';
import type { TransferRequest } from '../types.js';
import type { LedgerStore } from '../ledger.js';

export function createIdempotencyStage(ledger: LedgerStore): Stage<TransferRequest, TransferRequest> {
  return {
    id: 'idempotency-check',
    name: 'Idempotency Key Verification',
    description: 'Guarantees requests with duplicate idempotency keys are not re-executed',
    async run(input: TransferRequest, ctx: PipelineContext): Promise<TransferRequest> {
      if (ledger.hasIdempotencyKey(input.idempotencyKey)) {
        const prev = ledger.getTransferByKey(input.idempotencyKey)!;
        ctx.logger.warn(`Duplicate transfer detected via idempotency key`, {
          key: input.idempotencyKey,
          originalTransferId: prev.transferId,
        });
        throw new IdempotencyError(
          `Transfer with idempotency key ${input.idempotencyKey} has already been processed`,
          input.idempotencyKey,
        );
      }

      ctx.logger.info(`Idempotency key accepted`, { key: input.idempotencyKey });
      return input;
    },
  };
}
