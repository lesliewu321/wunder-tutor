export class HttpError extends Error {
  constructor(status, code, extra) {
    super(code);
    this.status = status;
    this.body = { error: code, ...extra };
  }
}
