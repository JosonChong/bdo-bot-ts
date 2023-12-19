export abstract class UserCommandError extends Error {

    helpText?: string;

    constructor(message: string, helpText?: string) {  
        super(message);
        this.name = this.constructor.name;
        this.helpText = helpText;
        Object.setPrototypeOf(this, new.target.prototype);
    }

}