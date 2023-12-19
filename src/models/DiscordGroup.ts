import { Expose } from 'class-transformer';
import { BatchItemGroup } from "./BatchItemGroup";
import { Item } from './Item';
import { WebhookClient } from 'discord.js';

export class DiscordGroup {

    @Expose({ name: 'channel', toClassOnly: true })
    name: string;

    @Expose({ name: 'url', toClassOnly: true })
    webhookUrl: string;

    webhook: WebhookClient;

    subscribedItemGroupsMap: Map<string, BatchItemGroup[]>;

    constructor(name: string, webhookUrl: string) {
        this.name = name;
        this.webhookUrl = webhookUrl;
        this.subscribedItemGroupsMap = new Map();
        this.webhook = new WebhookClient({ 
            url: webhookUrl
        });
    }

    addSubscribedItemGroup(groupName: string, batchItemGroup: BatchItemGroup) {
        if (!this.subscribedItemGroupsMap.has(groupName)) {
            this.subscribedItemGroupsMap.set(groupName, []);
        }

        this.subscribedItemGroupsMap.get(groupName)!.push(batchItemGroup);
    }

    isSubscribedItem(groupName: string, item: Item): boolean {
        if (!this.subscribedItemGroupsMap.has(groupName)) {
            return false;
        }

        return this.subscribedItemGroupsMap.get(groupName)!.some(
            itemGroup => itemGroup.contains(item));
    }

    isSubscribedItems(groupName: string, items: Item[]): boolean {
        return items.some(item => this.isSubscribedItem(groupName, item));
    }

    getSubscribedItems(groupName: string, items: Item[]) {
        return items.filter(item => this.isSubscribedItem(groupName, item));
    }

}