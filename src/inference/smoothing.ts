export class EMA {
  private alpha: number;
  private state = new Map<number, number>();
  constructor(halfLifeFrames = 12) {
    this.alpha = 1 - Math.exp(Math.log(0.5) / halfLifeFrames);
  }
  update(id: number, value: number): number {
    const prev = this.state.get(id);
    const next = prev === undefined ? value : prev + this.alpha * (value - prev);
    this.state.set(id, next);
    return next;
  }
  get(id: number) { return this.state.get(id) ?? 0; }
}
