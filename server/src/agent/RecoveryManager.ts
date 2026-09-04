export class RecoveryManager {
  private attempts = 0;
  private replans = 0;
  private maxRetries: number;
  constructor(maxRetries=3){ this.maxRetries = maxRetries; }
  recordFailure() { this.attempts++; }
  recordReplan() { this.replans++; }
  canRetry(): boolean { return this.attempts < this.maxRetries; }
  shouldReplan(repeatedFailures: number): boolean { return repeatedFailures >= 2; }
  getStats() { return { attempts: this.attempts, replans: this.replans }; }
  getAttempts(){ return this.attempts; }
  getReplans(){ return this.replans; }
}
