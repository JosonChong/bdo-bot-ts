import 'reflect-metadata';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { getOrCreateUser, initData } from './services/dataService';
import { log } from './utils/logUtils';
import { discordToken } from '../configs/config.json';
import { initCache, startCheckInStockJob, startCheckWaitListJob } from './services/schedulerService';
import dns from 'node:dns';
import { CommandHandler } from './commands/CommandHandler';
import { PersonalMessage } from './models/BotMessage';
import { InvalidCommandsError } from './errors/InvalidCommandsError';
import { InvalidMessageTypeError } from './errors/InvalidMessageTypeError';
import { UserCommandError } from './errors/UserCommandError';

dns.setDefaultResultOrder("ipv4first");

const client = new Client({
    'intents': [
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    'partials': [Partials.Channel]
});

const PREFIX = "!";
const searchLimit = 20;
const cacheTimeInSecond = 30 * 60;
const defaultRetries = 1;

const imperialItemAount = 40000;
const imperialItemLimit = 1000;

const tokenHelpText = "Please submit your token first by entering !token <you token here>\nTo get your token, go to https://trade.tw.playblackdesert.com/Home/list/hot and copy the TradeAuth_Session cookie in the request";

let commandHandler = new CommandHandler();

client.login(discordToken);

client.on('ready', async () => {
    log(`Logged in as ${client.user!.tag}!`);
    
    await initData();
    initCache();
    startCheckInStockJob();
    startCheckWaitListJob();
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) {
        return;
    }

    if (!msg.content.startsWith(PREFIX)) {
        return;
    }

    let deleteOriginalMessage = false;
    let user = getOrCreateUser(msg.author.id, msg.author.username);
    let botMessage = new PersonalMessage(client, user, msg);
    try {
        botMessage = await commandHandler.executeCommand(msg, user, botMessage);
    } catch(error) {
        if (error instanceof UserCommandError) {
            botMessage.addText(error.message);

            if (error instanceof InvalidCommandsError && error.helpText) {
                botMessage.addText(error.helpText);
            } else if (error instanceof InvalidMessageTypeError) {
                deleteOriginalMessage = true;
            }
        } else {
            botMessage.addText("Unknow error occurred.");
        }

        console.error(error);
    }
    
    await botMessage.send();

    if (deleteOriginalMessage) {
        try {
            await msg.delete();
        } catch (_) {
            botMessage.addText("Attempted to delete the message but without success.");
            botMessage.send();
        }
    }
});
