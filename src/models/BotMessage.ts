import { formatBlock, formatTable, formatUserTags } from "../utils/discordUtils";
import { log } from "../utils/logUtils";
import { DiscordGroup } from "./DiscordGroup";
import { User } from "./User";
import { User as DiscordUesr, Message as DiscordMessage, APIMessage } from "discord.js";

export class BotMessage {
    originalMsg?: DiscordMessage;
    contents: ContentLine[] = [];
    sentMessages: DiscordMessage[] = [];

    async send(): Promise<DiscordMessage[]|APIMessage[]|null> {
        throw new Error("send method is not implemented");
    };

    addText(content: string): TextContent {
        let textContent = new TextContent(content);
        this.contents.push(textContent);
        return textContent;
    }

    addBlock(contents: string[]): BlockContent {
        let blockContent = new BlockContent(contents);
        this.contents.push(blockContent);
        return blockContent;
    }

    addTable(headers: string[], rows: string[][] = []): TableContent {
        let tableContent = new TableContent(headers, rows);
        this.contents.push(tableContent);
        return tableContent;
    }

    addUserTags(users: User[]): TextContent[] {
        let userTags = formatUserTags(users.map(user => String(user.userId)));
        this.addText("");
        let textContents = userTags.map(userTag => this.addText(userTag));
        return textContents;
    }
}

export class PersonalMessage extends BotMessage {
    recipient: User;
    client: any;

    constructor(client: any, recipient: User, originalMsg: any) {
        super();
        this.client = client;
        this.recipient = recipient;
        this.originalMsg = originalMsg;
    }

    async sendNewMessage(): Promise<DiscordMessage[]|null> {
        let messageText = "";
        for (let content of this.contents) {
            messageText += content.displayText() + "\n";
            content.alreadySent = true;
        }
        
        try {
            let result: DiscordMessage[] = [];
            if (this.originalMsg) {
                let message = await this.originalMsg.reply(messageText);
                result.push(message);
            } else {
                let discordUser: DiscordUesr = this.client.users.cache.get(this.recipient.userId);
                let message = await discordUser.send(messageText);
                result.push(message);
                log(`Message \"${messageText}\" sent to ${discordUser.username}#${discordUser.discriminator}`);
            }

            this.sentMessages = result;

            return result;
        } catch (error: any) {
            console.error('Failed to send message:', error);
        }

        return null;
    }

    async editSentMessage(): Promise<DiscordMessage[]|null> {
        let messageText = "";
        for (let content of this.contents) {
            messageText += content.displayText() + "\n";
            content.alreadySent = true;
        }
        
        try {
            let result: DiscordMessage[] = [];
            if (this.sentMessages?.length === 1) {
                let message = await this.sentMessages[0].edit(messageText);
                result.push(message);
                this.sentMessages = result;
                return result;
            } else {
                for (let sentMessage of this.sentMessages) {
                    await sentMessage.delete();
                }

                this.sentMessages = [];

                return await this.sendNewMessage();
            }
        } catch (error: any) {
            console.error('Failed to send message:', error);
        }

        return null;
    }

    override async send(): Promise<DiscordMessage[]|null> {
        if (this.sentMessages.length > 0) {
            return await this.editSentMessage();
        } else {
            return await this.sendNewMessage();
        }
    }
}

export class WebhookMessage extends BotMessage {
    discordGroup: DiscordGroup;

    constructor( discordGroup: DiscordGroup) {
        super();
        this.discordGroup = discordGroup;
    }

    override async send(): Promise<APIMessage[]|null> {
        if (this.contents.length === 0) {
            return null;
        }

        let messageText = "";
        for (let content of this.contents) {
            messageText += content.displayText() + "\n";
            content.alreadySent = true;
        }

        let result: APIMessage[] = [];
        try {
            let message = await this.discordGroup.webhook.send(messageText);
            log(`Sent message ${messageText} to webhook ${this.discordGroup.name}`);
            result.push(message);
        } catch (error) {
            console.error(error);
        }

        return result;
    }
}

export abstract class ContentLine {
    alreadySent: boolean = false;
    abstract displayText(): string;
}

export class TextContent extends ContentLine {
    content: string;

    constructor(content: string) {
        super();
        this.content = content;
    }

    edit(content: string) {
        this.content = content;
    }

    displayText(): string {
        return this.content;
    }
}

export class BlockContent extends ContentLine {
    contents: string[];

    constructor(contents: string[] = []) {
        super();
        this.contents = contents;
    }

    addContent(newContent: string): BlockContent {
        this.contents.push(newContent);

        return this;
    }

    displayText(): string {
        let text = "";
        for (let content of this.contents) {
            text += content + "\n"; 
        }

        return formatBlock(text);
    }
}

export class TableContent extends ContentLine {
    headers: string[];
    rows: string[][];

    constructor(headers: string[] = [], rows: string[][] = []) {
        super();
        this.headers = headers;
        this.rows = rows;
    }

    addContentRow(row: string[]): TableContent {
        this.rows.push(row);

        return this;
    }

    displayText(): string {
        const tableRows = [this.headers, ...this.rows];
        return formatTable(tableRows);
    }
}