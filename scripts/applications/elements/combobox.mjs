import uiUtils from '../../utilities/uiUtils.mjs';

export default class CatCombobox extends HTMLElement {
    static tagName = 'cat-combobox';

    #input;
    #hidden;
    #list;
    #clear;
    #icon;
    #image;
    #options = [];
    #open = false;
    #highlighted = -1;

    connectedCallback() {
        if (this.#input) return;
        const name = this.getAttribute('name') ?? '';
        const value = this.getAttribute('value') ?? '';
        const placeholder = this.getAttribute('placeholder') || _loc('CAT.Dialog.Combobox.Filter');

        this.#options = Array.from(this.querySelectorAll('option')).map(o => ({
            value: o.value,
            label: o.textContent ?? '',
            image: o.dataset.image ?? '',
            tag: o.dataset.tag ?? ''
        }));
        this.replaceChildren();

        this.#hidden = document.createElement('input');
        this.#hidden.type = 'hidden';
        this.#hidden.name = name;
        this.#hidden.value = value;

        this.#icon = document.createElement('i');
        this.#icon.className = 'fas fa-magnifying-glass cat-combobox-icon';

        this.#image = document.createElement('img');
        this.#image.className = 'cat-combobox-selected-image';
        this.#image.hidden = true;

        this.#input = document.createElement('input');
        this.#input.type = 'text';
        this.#input.classList.add('cat-combobox-input');
        this.#input.placeholder = placeholder;
        this.#input.autocomplete = 'off';
        this.#input.spellcheck = false;
        const inputId = this.getAttribute('input-id');
        if (inputId) this.#input.id = inputId;

        this.#clear = document.createElement('button');
        this.#clear.type = 'button';
        this.#clear.classList.add('cat-combobox-clear');
        this.#clear.innerHTML = '<i class="fas fa-xmark"></i>';
        this.#clear.tabIndex = -1;
        this.#clear.hidden = true;

        const wrap = document.createElement('div');
        wrap.classList.add('cat-combobox-field');
        wrap.append(this.#icon, this.#image, this.#input, this.#clear);

        this.#list = document.createElement('ul');
        this.#list.classList.add('cat-combobox-options');
        this.#list.hidden = true;

        this.append(this.#hidden, wrap, this.#list);
        this.#renderOptions('');
        if (value) this.#applyInitialValue(value);

        this.#input.addEventListener('input', this.#onInput.bind(this));
        this.#input.addEventListener('focus', this.#openPopover.bind(this));
        this.#input.addEventListener('mousedown', this.#onInputMousedown.bind(this));
        this.#input.addEventListener('keydown', this.#onKeydown.bind(this));
        this.#list.addEventListener('mousedown', this.#onListMousedown.bind(this));
        this.#clear.addEventListener('click', this.#onClearClick.bind(this));
        document.addEventListener('mousedown', this.#onDocumentMousedown);
    }

    disconnectedCallback() {
        document.removeEventListener('mousedown', this.#onDocumentMousedown);
        window.removeEventListener('scroll', this.#reposition, true);
        window.removeEventListener('resize', this.#reposition);
        if (this.#list?.parentElement === document.body) this.#list.remove();
    }

    #applyInitialValue(v) {
        const match = this.#options.find(o => o.value === v);
        if (match) {
            this.#input.value = match.label;
            this.#clear.hidden = false;
            this.#updateFieldGlyph(match);
        }
    }

    #updateFieldGlyph(option) {
        if (option?.image) {
            this.#image.src = option.image;
            this.#image.hidden = false;
            this.#icon.hidden = true;
            return;
        }
        const fa = option ? uiUtils.fallbackIcon(option.value) : null;
        this.#image.hidden = true;
        this.#icon.className = `${fa ?? 'fas fa-magnifying-glass'} cat-combobox-icon`;
        this.#icon.hidden = false;
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
        const currentValue = this.#hidden?.value;
        let highlightIdx = matches.findIndex(o => o.value === currentValue);
        if (highlightIdx < 0) highlightIdx = 0;
        matches.forEach((o, i) => {
            const li = document.createElement('li');
            li.dataset.value = o.value;
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
            if (i === highlightIdx) li.classList.add('highlighted');
            this.#list.append(li);
        });
        this.#highlighted = highlightIdx;
    }

    #onInput(event) {
        this.#renderOptions(event.target.value);
        this.#openPopover();
    }

    #onInputMousedown() {
        if (!this.#open) {
            queueMicrotask(() => this.#openPopover());
        }
    }

    #onClearClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.#hidden.value = '';
        this.#input.value = '';
        this.#clear.hidden = true;
        this.#updateFieldGlyph(null);
        this.#renderOptions('');
        this.#input.focus();
        this.#openPopover();
        this.dispatchEvent(new Event('change', {bubbles: true}));
    }

    #openPopover() {
        if (this.#open) return;
        this.#open = true;
        document.body.append(this.#list);
        this.#reposition();
        this.#list.hidden = false;
        const highlighted = this.#list.querySelector('li.highlighted');
        highlighted?.scrollIntoView({block: 'nearest'});
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
                    this.#select(rows[this.#highlighted].dataset.value);
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

    #onListMousedown(event) {
        const li = event.target.closest('li[data-value]');
        if (!li) return;
        event.preventDefault();
        event.stopPropagation();
        this.#select(li.dataset.value);
    }

    #onDocumentMousedown = (event) => {
        if (this.contains(event.target) || this.#list.contains(event.target)) return;
        this.#closePopover();
    };

    #select(value) {
        const match = this.#options.find(o => o.value === value);
        if (!match) return;
        this.#hidden.value = match.value;
        this.#input.value = match.label;
        this.#clear.hidden = false;
        this.#updateFieldGlyph(match);
        this.#closePopover();
        this.dispatchEvent(new Event('change', {bubbles: true}));
    }
}
