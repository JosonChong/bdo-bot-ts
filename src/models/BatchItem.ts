import { Expose } from "class-transformer";
import { Item } from "./Item";

export class BatchItem {

    @Expose()
    id: number;

    @Expose()
    itemMap: Map<number, Item> = new Map();

    name?: string;

    constructor(id: number | string, sids: number[] | string[] = [], name?: string) {
        this.id = Number(id);
        this.name = name;

        this.itemMap = new Map();
        for (let sid of sids) {
            this.addItem(Number(sid));
        }
    }

    getItems(): Item[] {
        return [...this.itemMap.values()];
    }

    addItem(sid: number): void {
        if (!this.itemMap.has(sid)) {
            this.itemMap.set(sid, new Item(this.id, sid));
        }
    }

    contains(sid: number): boolean {
        return this.itemMap.has(sid);
    }

    containsItem(item: Item): boolean {
        return this.id === item.id && this.contains(item.sid);
    }

    filterInStock(): Item[] {
        let result: Item[] = [];
        this.itemMap.forEach(item => {
            if (item.currentStock && item.currentStock > 0) {
                result.push(item);
            }
        });

        return result;
    }

    createFromDummy(sids: number[] | string[] = []): BatchItem {
        let result = new BatchItem(this.id, sids, this.name);

        return result;
    }

    createFullSidsFromDummy(): BatchItem {
        let sids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        let result = new BatchItem(this.id, sids, this.name);

        return result;
    }

}