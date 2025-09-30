export type BBox = { x:number; y:number; width:number; height:number };
export type Tracked = { id: number; bbox: BBox };
let nextId = 1;

function iou(a: BBox, b: BBox) {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = b.x + b.width, by2 = b.y + b.height;
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(ax2, bx2), y2 = Math.min(ay2, by2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.width * a.height + b.width * b.height - inter;
  return ua > 0 ? inter / ua : 0;
}

export class IoUTracker {
  tracks: Tracked[] = [];
  update(dets: BBox[], iouThresh = 0.3): Tracked[] {
    const assigned = new Set<number>();
    const out: Tracked[] = [];

    for (const det of dets) {
      let best = -1, bestIou = 0;
      for (let i=0;i<this.tracks.length;i++) {
        if (assigned.has(i)) continue;
        const ov = iou(this.tracks[i].bbox, det);
        if (ov > bestIou) { bestIou = ov; best = i; }
      }
      if (best >= 0 && bestIou >= iouThresh) {
        this.tracks[best].bbox = det;
        assigned.add(best);
        out.push(this.tracks[best]);
      } else {
        const t = { id: nextId++, bbox: det };
        this.tracks.push(t);
        out.push(t);
      }
    }
    this.tracks = this.tracks.filter(t => out.find(o => o.id === t.id));
    return out;
  }
}
