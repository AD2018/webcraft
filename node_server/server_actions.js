export class ServerActions {

    #world;
    #actions;

    constructor(world, options) {
        this.#world = world;
        this.#actions = options;
    }

    // Add play sound
    addPlaySound(item) {
        // init
        if(!('play_sound' in this.#actions)) {
            this.#actions.play_sound = [];
        }
        // append
        this.#actions.play_sound.push(item);
    }

    // Add block
    addBlock(item) {
        // init
        if(!('blocks' in this.#actions)) {
            this.#actions.blocks = {};
        }
        if(!('list' in this.#actions.blocks)) {
            this.#actions.blocks.list = [];
        }
        // append
        this.#actions.blocks.list.push(item);
    }

    // Apply
    async apply() {
        await this.#world.applyActions(null, this.#actions);
    }

}