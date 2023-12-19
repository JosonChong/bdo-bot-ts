import { Exclude, Expose, Transform, TransformPlainToInstance } from "class-transformer";
import { BatchItem } from "./BatchItem";
import { BatchItemGroup } from "./BatchItemGroup";
import { DiscordGroup } from "./DiscordGroup";
import { Item } from "./Item";
import { getItemGroups, itemIdAndbatchItemMap } from "../services/dataService";

export class User {
    
    userId: string;
    
    username?: string;

    token?: string;

    rebuyItems?: Item[];

    encryptedEmail?: string;

    encryptedPassword?: string;

    encryptedSecondaryPassword?: string;

    @Expose({ name: 'channels' })
    @Transform(({ value }) => {
        let result = new Map();
        for (let discord in value) {
            let typeMap = new Map();
            for (let type in value[discord]) {
                typeMap.set(type, value[discord][type]);
            }
            result.set(discord, typeMap);
        }

        return result;
    }, { toClassOnly: true })
    discordGroups: Map<string, Map<string, string[]>> = new Map();

    @Exclude()
    discordGroupNSubscriptionMap?: Map<string, Item[]>;

    rebuyBatchItems?: BatchItem[];

    constructor(userId: string, username?: string) {
        this.userId = userId;
        this.username = username;
    }

    getDiscordGroupNSubscriptionMap(): Map<string, Item[]> {
        if (!this.discordGroupNSubscriptionMap) {
            this.discordGroupNSubscriptionMap = new Map();

            for (let [groupName, subscriptionMap] of this.discordGroups) {
                let items: Item[] = [];
                for (let [subscriptionType, itemGroupsOrItemIds] of subscriptionMap) {
                    if (subscriptionType === "notifyItemGroups") {
                        for (let itemGroupName of itemGroupsOrItemIds ?? []) {
                            let batchItemGroups: BatchItemGroup[] = getItemGroups(itemGroupName);
                            for (let batchItemGroup of batchItemGroups) {
                                items.push(... batchItemGroup.getItems());
                            }
                        }
                    } else if (subscriptionType === "notifyItemIds") {
                        for (let itemId of itemGroupsOrItemIds as []) {
                            let batchItem = itemIdAndbatchItemMap.get(parseInt(itemId));
                            
                            let fullSidsBatchItem = batchItem?.createFullSidsFromDummy();
    
                            items.push(... fullSidsBatchItem?.getItems() ?? []);
                        }
                    }
                }

                this.discordGroupNSubscriptionMap.set(groupName, items);
            }
        }

        return this.discordGroupNSubscriptionMap;
    }

    // TODO enum for type
    isSubscribedItem(discordGroup: DiscordGroup, item: Item, type: string): boolean {
        let discordGroupNSubscriptionMap = this.getDiscordGroupNSubscriptionMap();

        if (!discordGroupNSubscriptionMap.has(discordGroup.name)) {
            return false;
        }

        let subscribedItemMap = discordGroupNSubscriptionMap.get(discordGroup.name);
        return subscribedItemMap!.some(subscribedItem => subscribedItem.isEqual(item));
    }

    subscribeBatchItem(discordGroup: DiscordGroup, batchItem: BatchItem) {
        if (!this.discordGroups.has(discordGroup.name)) {
            this.discordGroups.set(discordGroup.name, new Map());
        }

        let subscribedDiscordGroup = this.discordGroups.get(discordGroup.name)!;

        if (!subscribedDiscordGroup.has("notifyItemIds")) {
            subscribedDiscordGroup.set("notifyItemIds", []);
        }

        let notifyItemIds = subscribedDiscordGroup!.get("notifyItemIds")!;
        if (!notifyItemIds.find(notifyItemId => notifyItemId === String(batchItem.id))) {
            notifyItemIds.push(String(batchItem.id));
        }

        this.discordGroupNSubscriptionMap = undefined;

        // TODO persist user
    }

    subscribeBatchGroup(discordGroup: DiscordGroup, itemGroupName: string) {
        if (!this.discordGroups.has(discordGroup.name)) {
            this.discordGroups.set(discordGroup.name, new Map());
        }

        let subscribedDiscordGroup = this.discordGroups.get(discordGroup.name);

        if (!subscribedDiscordGroup!.has("notifyItemGroups")) {
            subscribedDiscordGroup?.set("notifyItemGroups", []);
        }

        let notifyItemGroups = subscribedDiscordGroup!.get("notifyItemGroups")!;
        if (!notifyItemGroups.find(notifyItemGroup => notifyItemGroup === itemGroupName)) {
            notifyItemGroups.push(itemGroupName);
        }
        
        this.discordGroupNSubscriptionMap = undefined;

        // TODO persist user
    }

}