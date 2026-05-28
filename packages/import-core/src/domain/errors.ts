export class TransactionSourceUnavailableError extends Error {
  constructor(sourceId: string, cause?: unknown) {
    super(`Transaction source '${sourceId}' is unavailable after maximum retry attempts`)
    this.name = 'TransactionSourceUnavailableError'
    if (cause instanceof Error) this.cause = cause
  }
}
