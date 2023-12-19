import { PersonalMessage } from "../models/BotMessage";
import { User } from "../models/User";
import { discordGroups, itemIdAndbatchItemMap } from "../services/dataService";
import { DiscordCommand, InputData } from "./DiscordCommand";

interface SubscribeInputData extends InputData {
    
    discordGroup: string;

    itemGroupOrId: string;

}

export class SubscribeCommand extends DiscordCommand {

    acceptedCommands = ["subscribe", "register"];

    inputs = [["discordGroup", "itemGroupOrId"]];

    requireParameters = true;
    
    protected override async execute(user: User, originalMsg: any, botMessage: PersonalMessage, inputData: SubscribeInputData): Promise<PersonalMessage> {
        let discordGroup = discordGroups.find(discordGroup => discordGroup.name === inputData.discordGroup);

        if (!discordGroup) {
            botMessage.addText(`Discord Group ${inputData.discordGroup} not found.`);

            return botMessage;
        }

        if (+ inputData.itemGroupOrId) {
            let item = itemIdAndbatchItemMap.get(parseInt(inputData.itemGroupOrId));

            if (!item) {
                botMessage.addText(`Item ${inputData.itemGroupOrId} not found.`);

                return botMessage;
            }

            user.subscribeBatchItem(discordGroup!, item);

            botMessage.addText(`Subscribed item ${inputData.itemGroupOrId} on ${inputData.discordGroup}.`)
        }

        return botMessage;
    }

}