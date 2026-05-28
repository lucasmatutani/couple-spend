export class OfxParseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'OfxParseError'
    if (cause instanceof Error) this.cause = cause
  }
}
