import { InvalidCommandsError } from "../errors/InvalidCommandsError";
import { InvalidMessageTypeError } from "../errors/InvalidMessageTypeError";
import { PersonalMessage } from "../models/BotMessage";
import { User } from "../models/User";

export interface InputData {
    [key: string]: any
};

export abstract class DiscordCommand {

    acceptedCommands: string[] = [];

    acceptedCommandLengthes?: number[];

    helpText?: string;

    isDirectMessageOnly: boolean = false;

    requireParameters: boolean = false;

    inputs?: string[][];

    getName() {
        return this.acceptedCommands[0];
    }

    protected async execute(user: User, originalMsg: any, botMessage: PersonalMessage, inputData: InputData): Promise<PersonalMessage> {
        throw new Error("This command is not implemented.");
    }

    async run(user: User, originalMsg: any, botMessage: PersonalMessage, commands: string[]): Promise<PersonalMessage> {
        if (this.isDirectMessageOnly && originalMsg.guild) {
            throw new InvalidMessageTypeError(`Command ${this.getName()} can only be utilized within direct messages.`)
        }

        let userInputSet = this.inputs?.find(inputSet => inputSet.length === commands.length);
        let inputData: InputData = {};

        if (userInputSet) {
            let index = 0;
            while (index < userInputSet.length && index < commands.length) {
                inputData[userInputSet[index]] = commands[index];
                index ++;
            }
        } else if (this.requireParameters) {
            throw new InvalidCommandsError("Invalid number of commands", this.helpText);
        } 

        return this.execute(user, originalMsg, botMessage, inputData);        
    }

}