export class Money {
  private constructor(private readonly _cents: number) {}

  static of(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new TypeError(
        `Money.of requires an integer number of cents, got ${cents}. ` +
          `Use Math.round() before calling Money.of() if rounding is needed.`,
      )
    }
    return new Money(cents)
  }

  // Initialised after of() is defined — static fields run in declaration order
  // after the class is constructed, so Money.of is already available here.
  static readonly ZERO: Money = Money.of(0)

  get cents(): number {
    return this._cents
  }

  add(other: Money): Money {
    return Money.of(this._cents + other._cents)
  }

  subtract(other: Money): Money {
    return Money.of(this._cents - other._cents)
  }

  /** Multiplies by a factor and rounds to the nearest cent. */
  multiply(factor: number): Money {
    return Money.of(Math.round(this._cents * factor))
  }

  /** Returns pct% of this amount (e.g. percentage(30) → 30%). */
  percentage(pct: number): Money {
    return this.multiply(pct / 100)
  }

  /** Returns the amount in currency units (cents ÷ 100). */
  toUnits(): number {
    return this._cents / 100
  }

  /**
   * Returns a Brazilian Real formatted string, e.g. "R$ 1.234,56".
   * Implemented manually so the result is locale-agnostic in all environments.
   */
  format(): string {
    const negative = this._cents < 0
    const abs = Math.abs(this._cents)
    const centsPart = abs % 100
    const wholePart = Math.floor(abs / 100)

    const wholeStr = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    const centsStr = String(centsPart).padStart(2, '0')
    const sign = negative ? '-' : ''

    return `${sign}R$ ${wholeStr},${centsStr}`
  }

  isZero(): boolean {
    return this._cents === 0
  }

  isPositive(): boolean {
    return this._cents > 0
  }

  equals(other: Money): boolean {
    return this._cents === other._cents
  }
}
