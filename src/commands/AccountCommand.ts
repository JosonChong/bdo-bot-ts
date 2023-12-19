import { PersonalMessage } from "../models/BotMessage";
import { User } from "../models/User";
import { encrypt } from "../utils/commonUtils";
import { DiscordCommand, InputData } from "./DiscordCommand";

interface AccountInputData extends InputData {

    email: string;

    password: string;

    secondaryPassword: string;
    
}

export class AccountCommand extends DiscordCommand {

    acceptedCommands = ["account", "setAccount", "saveAccount"];

    isDirectMessageOnly = true;

    inputs = [["email", "password", "secondaryPassword"]];

    requireParameters = true;
    
    protected override async execute(user: User, originalMsg: any, botMessage: PersonalMessage, inputData: AccountInputData): Promise<PersonalMessage> {
        user.encryptedEmail = encrypt(inputData.email);
        user.encryptedPassword = encrypt(inputData.password);
        user.encryptedSecondaryPassword = encrypt(inputData.secondaryPassword);

        // TODO persist user

        botMessage.addText("Account details saved.");
        return botMessage;
    }

}