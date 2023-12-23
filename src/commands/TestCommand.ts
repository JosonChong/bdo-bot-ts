import { PersonalMessage } from "../models/BotMessage";
import { User } from "../models/User";
import { DiscordCommand } from "./DiscordCommand";
import * as dataService from "../services/dataService";
import { BatchItem } from "../models/BatchItem";
import { instanceToPlain } from "class-transformer";
import { Item } from "../models/Item";

export class TestCommand extends DiscordCommand {

    acceptedCommands = ["test", "testCommand"];
    
    protected override async execute(user: User, originalMsg: any, botMessage: PersonalMessage, commands: string[]): Promise<PersonalMessage> {
        console.log(user.getDiscordGroupNSubscriptionMap());
        // items = items.filter(item => item.id === 731108);
        // console.log(items);

        // let item = new Item(731108, 20);
        // console.log(user.isSubscribedItem(dataService.discordGroups[0], item, dataService.notifyGroups.waitList));
        // console.log(user.isSubscribedItem(dataService.discordGroups[0], item, dataService.notifyGroups.inStock));
        // console.log(user.isSubscribedItem(dataService.discordGroups[1], item, dataService.notifyGroups.waitList));
        // console.log(user.isSubscribedItem(dataService.discordGroups[1], item, dataService.notifyGroups.inStock));
        // botMessage.addText("Test");
        return botMessage;
    }

}