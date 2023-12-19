import { Expose, Type } from 'class-transformer';
import { BatchItem } from './BatchItem';
import { Item } from './Item';

export class BatchItemGroup {
    @Expose()
    name: string;

    @Expose()
    path: string;

    @Expose()
    @Type(() => BatchItem)
    batchItems: BatchItem[];

    constructor(name: string, path: string, batchItems: BatchItem[] = []) {
        this.name = name;
        this.path = path;
        this.batchItems = batchItems;
    }

    addBatchItem(batchItem: BatchItem): void {
        this.batchItems.push(batchItem);
    }

    getItemCount(): number {
        let result = 0;
        this.batchItems.map(batchItem => result += batchItem.itemMap.size);
        return result;
    }

    getItems() {
        let result: Item[] = [];
        for (let batchItem of this.batchItems) {
            result.push(... batchItem.getItems());
        }

        return result;
    }

    contains(item: Item) {
        for (let batchItem of this.batchItems) {
            if (item.id === batchItem.id && batchItem.contains(item.sid)) {
                return true;
            }
        }
        return false;
    }
}
