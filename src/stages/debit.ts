import type { Stage, PipelineContext } from '../core/index.js';
import type { TransferRequest, DebitResult } from '../types.js';
import type { LedgerStore } from '../ledger.js';
import { randomUUID } from 'crypto';

export function createDebitStage(ledger: LedgerStore): Stage<TransferRequest, DebitResult> {
  return {
    id: 'debit-source',
    name: 'Debit Source Account',
    description: 'Optimistically debits the source account with CAS version lock',
    async run(input: TransferRequest, ctx: PipelineContext): Promise<DebitResult> {
      const source = ledger.getAccount(input.sourceAccount);
      if (!source) throw new Error(`Source account ${input.sourceAccount} not found`);

      const transferId = randomUUID();

      // Attempt optimistic debit with current version
      const result = ledger.debit(input.sourceAccount, input.amount, source.version);
      if (!result.success) {
        throw new Error(
          `Concurrent modification detected on account ${input.sourceAccount}. Optimistic lock failed.`,
        );
      }

      ctx.logger.info(`Source account debited`, {
        account: input.sourceAccount,
        amount: input.amount,
        balanceAfter: result.newBalance,
      });

      return {
        request: input,
        transferId,
        sourceBalanceAfter: result.newBalance,
        debitedAt: Date.now(),
      };
    },

    // Compensating transaction (Saga rollback)
    async rollback(input: TransferRequest, ctx: PipelineContext): Promise<void> {
      ctx.logger.warn(`Compensating transaction: Refunding source account ${input.sourceAccount}`, {
        amount: input.amount,
      });
      ledger.credit(input.sourceAccount, input.amount);
    },
  };
}
