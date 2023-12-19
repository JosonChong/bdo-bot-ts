import { Transform, Expose } from 'class-transformer';

const sidNameMap: { [key: number]: string } = {
    16: "I",
    17: "II",
    18: "III",
    19: "IV",
    20: "V",
};

export class Item {
    @Transform(({ value }) => Number(value), { toClassOnly: true })
    id: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    sid: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    maxEnhance?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    basePrice?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    currentStock?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    totalTrades?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    priceMin?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    priceMax?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    lastSoldPrice?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    lastSoldTime?: number;

    @Transform(({ value }) => Number(value), { toClassOnly: true })
    price?: number;

    @Transform(({ value }) => new Date(value * 1000), { toClassOnly: true })
    liveAt?: Date;

    name?: string;

    constructor(id?: number|string, sid?: number|string) {
        this.id = Number(id);
        this.sid = Number(sid);
    }

    getSidFullName() {
        let sidName = sidNameMap[this.sid];
        let result = `+${this.sid}`;
        if (sidName) {
            result += ` (${sidName})`;
        }
        
        return result;
    }

    isInStock(): boolean {
        return this.currentStock ? this.currentStock > 0 : false;
    }

    isEqual(item: Item): boolean {
        return item.id === this.id && item.sid === this.sid;
    }
    
}