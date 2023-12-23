import { PersonalMessage } from "../models/BotMessage";
import { User } from "../models/User";
import { discordGroups, itemIdAndbatchItemMap, registerItemGroupsMapping } from "../services/dataService";
import { DiscordCommand, InputData } from "./DiscordCommand";

interface UnsubscribeInputData extends InputData {
    
    discordGroup: string;

    itemGroupOrId: string;

}

export class UnsubscribeCommand extends DiscordCommand {

    acceptedCommands = ["unsubscribe", "unregister"];

    inputs = [["itemGroupOrId"], ["discordGroup", "itemGroupOrId"]];

    requireParameters = true;
    
    protected override async execute(user: User, originalMsg: any, botMessage: PersonalMessage, inputData: UnsubscribeInputData): Promise<PersonalMessage> {
        let validDiscordGroups = discordGroups.filter(discordGroup => discordGroup.name === inputData.discordGroup);
        if (inputData.discordGroup && validDiscordGroups.length === 0) {
            botMessage.addText(`Discord Group ${inputData.discordGroup} not found.`);

            return botMessage;
        }

        if (validDiscordGroups.length === 0) {
            validDiscordGroups = discordGroups;
        }

        if (+ inputData.itemGroupOrId) {
            let item = itemIdAndbatchItemMap.get(parseInt(inputData.itemGroupOrId));

            if (!item) {
                botMessage.addText(`Item ${inputData.itemGroupOrId} not found.`);

                return botMessage;
            }


            for (let discordGroup of validDiscordGroups) {
                if (user.unsubscribeBatchItem(discordGroup!, item)) {
                    botMessage.addText(`Unsubscribed item ${inputData.itemGroupOrId} on ${discordGroup.name}.`);
                }
            } 
        } else {
            if (!registerItemGroupsMapping[inputData.itemGroupOrId]) {
                botMessage.addText(`Item group ${inputData.itemGroupOrId} not found.`);

                return botMessage;
            }

            for (let discordGroup of validDiscordGroups) {
                if (user.unsubscribeBatchGroup(discordGroup!, inputData.itemGroupOrId)) {
                    botMessage.addText(`Unsubscribed item group ${inputData.itemGroupOrId} on ${discordGroup.name}.`);
                }
            }
        }

        botMessage.contents.push(... user.getSubscriptionContents());

        return botMessage;
    }

}