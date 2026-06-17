import type { Geoman } from '@/main.ts';
import { GeomanTransaction } from './geomanTransaction.ts';
import type { GeomanTransactionOptions } from './types.ts';

export type GeomanTransactionSubsystemOptions = {
  geoman: Geoman;
};

let transactionIdCounter = 0;

export class GeomanTransactionSubsystem {
  private readonly geoman: Geoman;
  private activeTransaction: GeomanTransaction | null = null;

  constructor(options: GeomanTransactionSubsystemOptions) {
    this.geoman = options.geoman;
  }

  start(options: GeomanTransactionOptions = {}): GeomanTransaction {
    if (this.activeTransaction?.status === 'active') {
      throw new Error('A Geoman transaction is already active.');
    }

    const transaction = new GeomanTransaction({
      geoman: this.geoman,
      id: options.id ?? `gm-transaction-${++transactionIdCounter}`,
      validate: options.validate,
      onDone: (current) => {
        if (this.activeTransaction === current) {
          this.activeTransaction = null;
        }
      },
    });

    this.activeTransaction = transaction;

    return transaction;
  }

  getActive(): GeomanTransaction | null {
    return this.activeTransaction;
  }

  destroy(): void {
    this.activeTransaction?.cancel();
    this.activeTransaction = null;
  }
}
