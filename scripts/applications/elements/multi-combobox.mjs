import uiUtils from '../../utilities/uiUtils.mjs';

export default class CatMultiCombobox extends HTMLElement {
    static tagName = 'cat-multi-combobox';

    #input;
    #hidden;
    #list;
    #icon;
    #chipsWrap;
    #counter;
    #options = [];
    #selected = new Map();
    #open = false;
    #highlighted = -1;
    #amountsMode = false;
    #maxTotal = null;

    connectedCallback() {
        if (this.#input) return;
        this.#amountsMode = this.hasAttribute('amounts');
        const max = this.getAttribute('max-total');
        if (max != null) this.#maxTotal = Number(max);
        const name = this.getAttribute('name') ?? '';
        const placeholder = this.getAttribute('placeholder') || _loc('CAT.Dialog.Combobox.Filter');

        this.#options = Array.from(this.querySelectorAll('option')).map(o => ({
            value: o.value,
            label: o.textContent ?? '',
            image: o.dataset.image ?? '',
            tag: o.dataset.tag ?? '',
            weight: Number(o.dataset.weight) || 1,
            max: o.dataset.max != null ? Number(o.dataset.max) : null
        })).filter(o => o.max == null || o.max > 0);
        this.replaceChildren();

        this.#hidden = document.createElement('input');
        this.#hidden.type = 'hidden';
        this.#hidden.name = name;
        this.#hidden.value = '';

        this.#chipsWrap = document.createElement('div');
        this.#chipsWrap.className = 'cat-multi-combobox-chips';

        this.#icon = document.createElement('i');
        this.#icon.className = 'fas fa-magnifying-glass cat-combobox-icon';

        this.#input = document.createElement('input');
        this.#input.type = 'text';
        this.#input.classList.add('cat-combobox-input');
        this.#input.placeholder = placeholder;
        this.#input.autocomplete = 'off';
        this.#input.spellcheck = false;
        const inputId = this.getAttribute('input-id');
        if (inputId) this.#input.id = inputId;

        this.#counter = document.createElement('span');
        this.#counter.className = 'cat-multi-combobox-counter';

        const field = document.createElement('div');
        field.classList.add('cat-combobox-field');
        field.append(this.#icon, this.#input, this.#counter);

        this.#list = document.createElement('ul');
        this.#list.classList.add('cat-combobox-options');
        this.#list.hidden = true;

        this.append(this.#hidden, field, this.#chipsWrap, this.#list);
        this.#renderOptions('');
        this.#syncHidden();
        this.#updateCounter();

        this.#input.addEventListener('input', this.#onInput.bind(this));
        this.#input.addEventListener('mousedown', this.#onInputMousedown.bind(this));
        this.#input.addEventListener('keydown', this.#onKeydown.bind(this));
        this.#list.addEventListener('mousedown', this.#onListMousedown.bind(this));
        this.#chipsWrap.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) e.preventDefault();
        });
        this.#chipsWrap.addEventListener('click', this.#onChipsClick.bind(this));
        this.#chipsWrap.addEventListener('input', this.#onChipsInput.bind(this));
        document.addEventListener('mousedown', this.#onDocumentMousedown);
    }

    disconnectedCallback() {
        document.removeEventListener('mousedown', this.#onDocumentMousedown);
        window.removeEventListener('scroll', this.#reposition, true);
        window.removeEventListener('resize', this.#reposition);
        if (this.#list?.parentElement === document.body) this.#list.remove();
    }

    #renderOptions(filter) {
        const needle = filter.trim().toLowerCase();
        const matches = needle
            ? this.#options.filter(o => o.label.toLowerCase().includes(needle))
            : this.#options;
        this.#list.replaceChildren();
        if (!matches.length) {
            const empty = document.createElement('li');
            empty.classList.add('cat-combobox-empty');
            empty.textContent = _loc('CAT.Dialog.Combobox.NoMatches');
            this.#list.append(empty);
            this.#highlighted = -1;
            return;
        }
        matches.forEach((o, i) => {
            const li = document.createElement('li');
            li.dataset.value = o.value;
            const isSelected = this.#selected.has(o.value);
            if (isSelected) li.classList.add('selected');
            const wouldExceed = this.#maxTotal != null && (this.#totalAmount() + o.weight) > this.#maxTotal;
            if (!isSelected && wouldExceed) li.classList.add('cat-combobox-disabled');
            if (o.image) {
                const img = document.createElement('img');
                img.src = o.image;
                li.append(img);
            } else {
                const fa = uiUtils.fallbackIcon(o.value);
                if (fa) {
                    const ico = document.createElement('i');
                    ico.className = `${fa} cat-combobox-fallback-icon`;
                    li.append(ico);
                }
            }
            const span = document.createElement('span');
            span.textContent = o.label;
            li.append(span);
            if (o.tag) {
                const tag = document.createElement('span');
                tag.className = 'cat-combobox-tag';
                tag.textContent = o.tag;
                li.append(tag);
            }
            if (this.#selected.has(o.value)) {
                const check = document.createElement('i');
                check.className = 'fas fa-check cat-combobox-check';
                li.append(check);
            }
            if (i === 0) li.classList.add('highlighted');
            this.#list.append(li);
        });
        this.#highlighted = 0;
    }

    #renderChips() {
        this.#chipsWrap.replaceChildren();
        for (const [value, amount] of this.#selected) {
            const opt = this.#options.find(o => o.value === value);
            if (!opt) continue;
            const chip = document.createElement('div');
            chip.className = 'cat-multi-combobox-chip';
            chip.dataset.value = value;
            if (opt.image) {
                const img = document.createElement('img');
                img.src = opt.image;
                chip.append(img);
            } else {
                const fa = uiUtils.fallbackIcon(opt.value);
                if (fa) {
                    const ico = document.createElement('i');
                    ico.className = `${fa} cat-combobox-fallback-icon`;
                    chip.append(ico);
                }
            }
            const span = document.createElement('span');
            span.textContent = opt.label;
            chip.append(span);
            if (opt.tag) {
                const tag = document.createElement('span');
                tag.className = 'cat-combobox-tag';
                tag.textContent = opt.tag;
                chip.append(tag);
            }
            if (this.#amountsMode) {
                const numWrap = document.createElement('div');
                numWrap.className = 'cat-multi-combobox-num';
                const num = document.createElement('input');
                num.type = 'number';
                num.className = 'cat-multi-combobox-amount';
                num.min = '1';
                if (opt.max != null) num.max = String(opt.max);
                num.value = String(amount);
                num.dataset.value = value;
                const stepper = document.createElement('div');
                stepper.className = 'cat-multi-combobox-stepper';
                const up = document.createElement('button');
                up.type = 'button';
                up.className = 'cat-multi-combobox-step-up';
                up.dataset.value = value;
                up.tabIndex = -1;
                up.innerHTML = '<i class="fas fa-caret-up"></i>';
                const totalCap = this.#maxTotal != null && (this.#totalAmount() + opt.weight) > this.#maxTotal;
                const perCap = opt.max != null && amount >= opt.max;
                if (totalCap || perCap) up.disabled = true;
                const down = document.createElement('button');
                down.type = 'button';
                down.className = 'cat-multi-combobox-step-down';
                down.dataset.value = value;
                down.tabIndex = -1;
                down.innerHTML = '<i class="fas fa-caret-down"></i>';
                if (amount <= 1) down.disabled = true;
                stepper.append(up, down);
                numWrap.append(num, stepper);
                chip.append(numWrap);
            }
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'cat-multi-combobox-remove';
            removeBtn.dataset.value = value;
            removeBtn.tabIndex = -1;
            removeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
            chip.append(removeBtn);
            this.#chipsWrap.append(chip);
        }
    }

    #updateCounter() {
        if (this.#maxTotal == null) {
            this.#counter.hidden = true;
            return;
        }
        this.#counter.hidden = false;
        this.#counter.textContent = `${this.#totalAmount()}/${this.#maxTotal}`;
        this.#counter.classList.toggle('at-max', this.#totalAmount() >= this.#maxTotal);
    }

    #syncHidden() {
        const arr = this.#amountsMode
            ? Array.from(this.#selected, ([value, amount]) => ({value, amount}))
            : Array.from(this.#selected.keys());
        this.#hidden.value = JSON.stringify(arr);
    }

    #onInput(event) {
        this.#renderOptions(event.target.value);
        this.#openPopover();
    }

    #onInputMousedown() {
        if (!this.#open) queueMicrotask(() => this.#openPopover());
    }

    #onListMousedown(event) {
        const li = event.target.closest('li[data-value]');
        if (!li || li.classList.contains('cat-combobox-disabled')) return;
        event.preventDefault();
        event.stopPropagation();
        this.#toggle(li.dataset.value);
    }

    #toggle(value) {
        const wasSelected = this.#selected.has(value);
        if (wasSelected) {
            this.#selected.delete(value);
        } else {
            const opt = this.#options.find(o => o.value === value);
            const w = opt?.weight ?? 1;
            if (this.#maxTotal != null && this.#totalAmount() + w > this.#maxTotal) return;
            this.#selected.set(value, 1);
        }
        this.#renderChips();
        this.#renderOptions(this.#input.value);
        this.#syncHidden();
        this.#updateCounter();
        if (!wasSelected) this.#openPopover();
        this.dispatchEvent(new Event('change', {bubbles: true}));
        this.dispatchEvent(new CustomEvent('cat-resize', {bubbles: true}));
    }

    #totalAmount() {
        let total = 0;
        for (const [value, amount] of this.#selected) {
            const opt = this.#options.find(o => o.value === value);
            const w = opt?.weight ?? 1;
            total += (this.#amountsMode ? amount : 1) * w;
        }
        return total;
    }

    #onChipsClick(event) {
        const removeBtn = event.target.closest('.cat-multi-combobox-remove');
        if (removeBtn) {
            event.preventDefault();
            this.#toggle(removeBtn.dataset.value);
            return;
        }
        const up = event.target.closest('.cat-multi-combobox-step-up');
        if (up) {
            event.preventDefault();
            this.#step(up.dataset.value, 1);
            return;
        }
        const down = event.target.closest('.cat-multi-combobox-step-down');
        if (down) {
            event.preventDefault();
            this.#step(down.dataset.value, -1);
            return;
        }
    }

    #step(value, delta) {
        if (!this.#selected.has(value)) return;
        const current = this.#selected.get(value);
        const opt = this.#options.find(o => o.value === value);
        const w = opt?.weight ?? 1;
        let next = Math.max(1, current + delta);
        if (delta > 0 && this.#maxTotal != null) {
            const otherTotal = this.#totalAmount() - (current * w);
            const maxAllowed = Math.max(1, Math.floor((this.#maxTotal - otherTotal) / w));
            if (next > maxAllowed) next = maxAllowed;
        }
        if (opt?.max != null && next > opt.max) next = opt.max;
        if (next === current) return;
        this.#selected.set(value, next);
        this.#renderChips();
        this.#syncHidden();
        this.#updateCounter();
        this.dispatchEvent(new Event('change', {bubbles: true}));
    }

    #onChipsInput(event) {
        const num = event.target.closest('.cat-multi-combobox-amount');
        if (!num) return;
        const value = num.dataset.value;
        const opt = this.#options.find(o => o.value === value);
        const w = opt?.weight ?? 1;
        let amount = Math.max(1, Number(num.value) || 1);
        if (this.#maxTotal != null) {
            const otherTotal = this.#totalAmount() - ((this.#selected.get(value) ?? 0) * w);
            const maxAllowed = Math.max(1, Math.floor((this.#maxTotal - otherTotal) / w));
            if (amount > maxAllowed) amount = maxAllowed;
        }
        if (opt?.max != null && amount > opt.max) amount = opt.max;
        if (Number(num.value) !== amount) num.value = String(amount);
        this.#selected.set(value, amount);
        this.#syncHidden();
        this.#updateCounter();
        this.dispatchEvent(new Event('change', {bubbles: true}));
    }

    #onKeydown(event) {
        const rows = this.#list.querySelectorAll('li[data-value]');
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.#openPopover();
                this.#moveHighlight(1, rows);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.#moveHighlight(-1, rows);
                break;
            case 'Enter':
                event.preventDefault();
                if (this.#highlighted >= 0 && rows[this.#highlighted]) {
                    this.#toggle(rows[this.#highlighted].dataset.value);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.#closePopover();
                break;
        }
    }

    #moveHighlight(delta, rows) {
        if (!rows.length) return;
        rows[this.#highlighted]?.classList.remove('highlighted');
        this.#highlighted = (this.#highlighted + delta + rows.length) % rows.length;
        const next = rows[this.#highlighted];
        next.classList.add('highlighted');
        next.scrollIntoView({block: 'nearest'});
    }

    #openPopover() {
        if (this.#open) return;
        this.#open = true;
        document.body.append(this.#list);
        this.#reposition();
        this.#list.hidden = false;
        window.addEventListener('scroll', this.#reposition, true);
        window.addEventListener('resize', this.#reposition);
    }

    #closePopover() {
        if (!this.#open) return;
        this.#open = false;
        this.#list.hidden = true;
        window.removeEventListener('scroll', this.#reposition, true);
        window.removeEventListener('resize', this.#reposition);
    }

    #reposition = () => {
        const rect = this.#input.getBoundingClientRect();
        this.#list.style.left = `${rect.left}px`;
        this.#list.style.top = `${rect.bottom}px`;
        this.#list.style.width = `${rect.width}px`;
    };

    #onDocumentMousedown = (event) => {
        if (this.contains(event.target) || this.#list.contains(event.target)) return;
        this.#closePopover();
    };
}
