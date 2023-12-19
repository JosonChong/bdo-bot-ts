import { PersonalMessage } from "../models/BotMessage";
import { User } from "../models/User";
import { DiscordCommand } from "./DiscordCommand";
import * as dataService from "../services/dataService";
import { BatchItem } from "../models/BatchItem";

export class TestCommand extends DiscordCommand {

    acceptedCommands = ["test", "testCommand"];
    
    protected override async execute(user: User, originalMsg: any, botMessage: PersonalMessage, commands: string[]): Promise<PersonalMessage> {
        console.log(user.getDiscordGroupNSubscriptionMap());
        botMessage.addText("Test");
        return botMessage;
    }

}