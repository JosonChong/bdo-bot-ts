import { Exclude, Expose, Transform } from "class-transformer";
import { BatchItem } from "./BatchItem";
import { BatchItemGroup } from "./BatchItemGroup";
import { DiscordGroup } from "./DiscordGroup";
import { Item } from "./Item";
import { getItemGroups, itemIdAndbatchItemMap, persistUsers } from "../services/dataService";
import { BlockContent, ContentLine } from "./BotMessage";

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
                typeMap.set(type, value[discord][type].map((item: any) => item.toString()));
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
                        for (let itemId of itemGroupsOrItemIds ?? []) {
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

    getSubscriptionContents(): ContentLine[] {
        let result: ContentLine[] = [];

        let discordGrups = this.discordGroups;

        for (let [groupName, map] of discordGrups) {
            let itemGroupNames = map.get("notifyItemGroups");
            let itemIds = map.get("notifyItemIds");

            if ((itemGroupNames && itemGroupNames.length > 0) || (itemIds && itemIds.length > 0)) {
                let blockContent = new BlockContent();
                result.push(blockContent);
                blockContent.addContent(`Discord group ${groupName}`);

                if (itemGroupNames && itemGroupNames.length > 0) {
                    blockContent.addContent("Subscribed Item Groups:");
                    for (let itemGroupName of itemGroupNames) {
                        blockContent.addContent(itemGroupName);                    
                    }
                }

                if (itemIds && itemIds.length > 0) {
                    blockContent.addContent("Subscribed Items:");
                    for (let itemId of itemIds) {
                        blockContent.addContent(itemId);                    
                    }
                }
            }
        }

        return result;
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
        if (!notifyItemIds.find(notifyItemId => notifyItemId === batchItem.id.toString())) {
            notifyItemIds.push(batchItem.id.toString());
        }

        this.discordGroupNSubscriptionMap = undefined;

        persistUsers();
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

        persistUsers();
    }

    unsubscribeBatchItem(discordGroup: DiscordGroup, batchItem: BatchItem): boolean {
        if (!this.discordGroups.has(discordGroup.name)) {
            return false;
        }

        let subscribedDiscordGroup = this.discordGroups.get(discordGroup.name)!;

        if (!subscribedDiscordGroup.has("notifyItemIds")) {
            return false;
        }

        let notifyItemIds = subscribedDiscordGroup!.get("notifyItemIds")!;

        console.log(notifyItemIds);

        const index = notifyItemIds.indexOf(batchItem.id.toString());
        if (index > -1) {
            notifyItemIds.splice(index, 1);
            this.discordGroupNSubscriptionMap = undefined;
            persistUsers();
        
            return true;
        }

        return false;
    }

    unsubscribeBatchGroup(discordGroup: DiscordGroup, itemGroupName: string): boolean {
        if (!this.discordGroups.has(discordGroup.name)) {
            return false;
        }

        let subscribedDiscordGroup = this.discordGroups.get(discordGroup.name);

        if (!subscribedDiscordGroup!.has("notifyItemGroups")) {
            return false;
        }

        let notifyItemGroups = subscribedDiscordGroup!.get("notifyItemGroups")!;
        const index = notifyItemGroups.indexOf(itemGroupName);
        if (index > -1) {
            notifyItemGroups.splice(index, 1);
            this.discordGroupNSubscriptionMap = undefined;
            persistUsers();
        
            return true;
        }

        return false;
    }

}