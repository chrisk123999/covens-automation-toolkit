export default class PromptTimer {
    #app;
    #onExpire;
    #interval;
    total = 0;
    left = 0;
    paused = false;
    last = 0;

    constructor(app, onExpire) {
        this.#app = app;
        this.#onExpire = onExpire;
    }

    static get seconds() {
        return Number(game.settings.get('cat', 'manualRollsTimer')) || 0;
    }

    static get enabled() {
        return PromptTimer.seconds > 0;
    }

    get running() {
        return !!this.#interval;
    }

    start() {
        const seconds = PromptTimer.seconds;
        if (seconds <= 0 || this.running) return;
        Object.assign(this, {total: seconds, left: seconds, paused: false, last: Date.now()});
        this.#interval = setInterval(() => this.#tick(), 200);
        this.draw();
    }

    stop() {
        clearInterval(this.#interval);
        this.#interval = null;
    }

    toggle() {
        if (this.running) this.setPaused(!this.paused);
    }

    setPaused(paused, left) {
        if (!this.running) return;
        this.paused = paused;
        if (Number.isFinite(left)) this.left = left;
        this.last = Date.now();
        this.draw();
    }

    #tick() {
        const now = Date.now();
        if (!this.paused) this.left -= (now - this.last) / 1000;
        this.last = now;
        if (this.left > 0) return this.draw();
        this.stop();
        this.#onExpire();
    }

    draw() {
        const element = this.#app.element?.querySelector('.cat-timer');
        if (!this.running || !element) return;
        const progress = Math.max(this.left / this.total, 0);
        element.style.setProperty('--timer-progress', progress);
        element.querySelector('.time').textContent = Math.ceil(Math.max(this.left, 0)) + 's';
        const button = element.querySelector('button');
        button.querySelector('i').className = 'fa-solid fa-fw ' + (this.paused ? 'fa-play' : 'fa-pause');
        button.dataset.tooltip = _loc(this.paused ? 'CAT.Manual.TimerResume' : 'CAT.Manual.TimerPause');
        this.#app.element.classList.toggle('timer-urgent', progress <= 0.25 && !this.paused);
    }
}
