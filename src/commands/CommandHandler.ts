import { Message } from 'discord.js';
import { PersonalMessage } from '../models/BotMessage';
import { DiscordCommand } from './DiscordCommand';
import { User } from '../models/User';
import { UnknownCommandError } from '../errors/UnkownCommandError';
import { TestCommand } from './TestCommand';
import { AccountCommand } from './AccountCommand';
import { SubscribeCommand } from './SubscribeCommand';
import { UnsubscribeCommand } from './UnsubscribeCommand';


export class CommandHandler {

    private commandMap: Map<string, DiscordCommand> = new Map();

    private commandClasses = [TestCommand, AccountCommand, SubscribeCommand, UnsubscribeCommand];

    constructor() {
        for (let commandClass of this.commandClasses) {
            this.registerCommand(new commandClass);
        }
    }

    registerCommand(command: DiscordCommand) {
        for (let acceptedCommand of command.acceptedCommands) {
            if (this.commandMap.has(acceptedCommand)) {
                throw new Error(`Duplicated command ${acceptedCommand}!`);
            }

            this.commandMap.set(acceptedCommand, command);
        }
    }

    async executeCommand(originalMsg: Message, user: User, botMessage: PersonalMessage): Promise<PersonalMessage> {
        let userCommands = originalMsg.content.substring(1).split(" ");
        let commandName = userCommands[0];
        let commandInputs = userCommands.slice(1);
        
        let command = this.commandMap.get(commandName);
        if (!command) {
            throw new UnknownCommandError(`Unknow command ${commandName}`);
        }

        return await command.run(user, originalMsg, botMessage, commandInputs);
    }

}