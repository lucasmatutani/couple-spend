export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    // Maintains proper prototype chain in transpiled ES5 output
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InvalidSplitRuleError extends DomainError {}
export class InvalidExpenseError extends DomainError {}
export class InvalidMoneyError extends DomainError {}
export class InvalidGoalError extends DomainError {}
