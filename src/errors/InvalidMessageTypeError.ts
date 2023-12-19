import { UserCommandError } from "./UserCommandError";

export class InvalidMessageTypeError extends UserCommandError {

    constructor(message: string, helpText?: string) {  
        super(message, helpText);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
    
}