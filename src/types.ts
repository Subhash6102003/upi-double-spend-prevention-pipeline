export interface BankAccount {
  accountNumber: string;
  holderName: string;
  balance: number;
  version: number;
}

export interface TransferRequest {
  idempotencyKey: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: number;
}

export interface TransferRecord {
  transferId: string;
  idempotencyKey: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: number;
  status: 'pending' | 'debited' | 'completed' | 'failed' | 'refunded';
  createdAt: number;
}

export interface DebitResult {
  request: TransferRequest;
  transferId: string;
  sourceBalanceAfter: number;
  debitedAt: number;
}

export interface CreditResult extends DebitResult {
  destinationBalanceAfter: number;
  creditedAt: number;
}

export interface TransferOutcome {
  status: 'success' | 'duplicate_blocked' | 'insufficient_funds' | 'failed';
  transferId: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: number;
  sourceBalance: number;
  destinationBalance: number;
  error?: string;
}
