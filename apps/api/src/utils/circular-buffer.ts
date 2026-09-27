/**
 * CircularBuffer (Ring Buffer)
 * โครงสร้างข้อมูลเก็บ Log แบบจำกัดขนาด (Fixed Size)
 * เมื่อข้อมูลเกินขีดจำกัด ข้อมูลที่เก่าที่สุดจะถูกแทนที่โดยอัตโนมัติ
 * ทำงานได้รวดเร็วระดับ O(1) และป้องกันหน่วยความจำ RAM ล้น
 */
export class CircularBuffer<T> {
  private buffer: (T | null)[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private isFull: boolean = false;

  constructor(capacity: number = 1000) {
    if (capacity <= 0) {
      throw new Error('ความจุของ CircularBuffer ต้องมากกว่า 0');
    }
    this.capacity = capacity;
    this.buffer = new Array<T | null>(capacity).fill(null);
  }

  /** เพิ่มข้อมูลใหม่เข้าคิว */
  public push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.isFull) {
      this.head = (this.head + 1) % this.capacity;
    }

    if (this.tail === this.head) {
      this.isFull = true;
    }
  }

  /** ดึงข้อมูลทั้งหมดเรียงตามลำดับจากเก่าไปใหม่ */
  public toArray(): T[] {
    const result: T[] = [];
    if (!this.isFull && this.head === this.tail) {
      return result;
    }

    const count = this.isFull ? this.capacity : (this.tail - this.head + this.capacity) % this.capacity;
    for (let i = 0; i < count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== null) {
        result.push(item);
      }
    }
    return result;
  }

  /** ดึงเฉพาะ N บรรทัดล่าสุด */
  public getRecent(n: number): T[] {
    const all = this.toArray();
    if (n >= all.length) {
      return all;
    }
    return all.slice(all.length - n);
  }

  /** ล้างข้อมูลทั้งหมดใน Buffer */
  public clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.isFull = false;
  }

  /** จำนวนรายการที่เก็บอยู่ในปัจจุบัน */
  public get size(): number {
    if (this.isFull) return this.capacity;
    return (this.tail - this.head + this.capacity) % this.capacity;
  }
}
