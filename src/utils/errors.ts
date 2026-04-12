export class AppError extends Error {
  public data?: Record<string, unknown>;

  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.data = data;
  }
}
