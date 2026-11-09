import type { Stage, PipelineContext } from '../core/index.js';
import type { DebitResult, CreditResult } from '../types.js';
import type { LedgerStore } from '../ledger.js';

export function createCreditStage(ledger: LedgerStore): Stage<DebitResult, CreditResult> {
  return {
    id: 'credit-destination',
    name: 'Credit Destination Account',
    description: 'Credits the destination account in the ledger',
    async run(input: DebitResult, ctx: PipelineContext): Promise<CreditResult> {
      const dest = ledger.getAccount(input.request.destinationAccount);
      if (!dest) {
        throw new Error(`Destination account ${input.request.destinationAccount} not found`);
      }

      const result = ledger.credit(input.request.destinationAccount, input.request.amount);

      ctx.logger.info(`Destination account credited`, {
        account: input.request.destinationAccount,
        amount: input.request.amount,
        balanceAfter: result.newBalance,
      });

      return {
        ...input,
        destinationBalanceAfter: result.newBalance,
        creditedAt: Date.now(),
      };
    },

    // Rollback for credit stage: debit destination if downstream fails
    async rollback(input: DebitResult, ctx: PipelineContext): Promise<void> {
      ctx.logger.warn(`Compensating transaction: Reversing destination credit ${input.request.destinationAccount}`);
      const dest = ledger.getAccount(input.request.destinationAccount);
      if (dest) {
        ledger.debit(input.request.destinationAccount, input.request.amount, dest.version);
      }
    },
  };
}
