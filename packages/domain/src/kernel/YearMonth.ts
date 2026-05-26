export class YearMonth {
  private constructor(
    readonly year: number,
    readonly month: number, // 1-12
  ) {}

  static fromString(s: string): YearMonth {
    const match = /^(\d{4})-(\d{2})$/.exec(s)
    if (!match) throw new Error(`Invalid YearMonth string: "${s}". Expected format: "YYYY-MM".`)
    const year = parseInt(match[1]!, 10)
    const month = parseInt(match[2]!, 10)
    if (month < 1 || month > 12) throw new Error(`Invalid month ${month} in "${s}".`)
    return new YearMonth(year, month)
  }

  static fromDate(d: Date): YearMonth {
    return new YearMonth(d.getFullYear(), d.getMonth() + 1)
  }

  static current(): YearMonth {
    return YearMonth.fromDate(new Date())
  }

  /** First day of the month at local midnight. */
  startDate(): Date {
    return new Date(this.year, this.month - 1, 1)
  }

  /** Last day of the month at local midnight (new Date(y, m, 0) = last day of previous month). */
  endDate(): Date {
    return new Date(this.year, this.month, 0)
  }

  previous(): YearMonth {
    return this.month === 1
      ? new YearMonth(this.year - 1, 12)
      : new YearMonth(this.year, this.month - 1)
  }

  next(): YearMonth {
    return this.month === 12
      ? new YearMonth(this.year + 1, 1)
      : new YearMonth(this.year, this.month + 1)
  }

  /** Returns "YYYY-MM" string. */
  toString(): string {
    return `${this.year}-${String(this.month).padStart(2, '0')}`
  }

  equals(other: YearMonth): boolean {
    return this.year === other.year && this.month === other.month
  }
}
