class Selekt {
    static selected = new Set();
    static previousInstance = null;
    static isClearInit = false;
    static isBusy = false;

    /**
     * Handle selection clearing
     * @param {PointerEvent} ev
     */
    static handleClear(ev) {
        if (!Selekt.previousInstance || !Selekt.selected.size) return;
        const targetParent = Selekt.previousInstance.closest(
            ev.target,
            Selekt.previousInstance.elParent
        );
        if (!targetParent) {
            Selekt.previousInstance.clear();
            Selekt.previousInstance = null;
        }
    }

    #elPivot = null;
    elItem = null;

    /**
     * Constructor
     * @param {HTMLElement} elParent
     * @param {object} options
     */
    constructor(elParent, options = {}) {
        this.elParent = elParent;
        this.selectorIgnore = ".ignore";
        this.classSelected = "is-selected";
        this.ctrlOn = false;
        this.isMultiple = true;
        this.isEnabled = true;
        this.onSelect = () => { };

        this.handleDown = this.handleDown.bind(this);
        this.handleUp = this.handleUp.bind(this);
        this.handleTouchstart = this.handleTouchstart.bind(this);

        this.init(options);

        if (!Selekt.isClearInit) {
            // Attach selection clearing to window only once 
            Selekt.isClearInit = true;
            addEventListener("pointerdown", Selekt.handleClear);
        }
    }

    /**
     * Initialize Selekt instance
     * @param {object} options
     * @returns {this}
     */
    init(options = {}) {
        Object.assign(this, options);
        this.elParent.addEventListener("pointerdown", this.handleDown);
        this.elParent.addEventListener("pointerup", this.handleUp);
        this.elParent.addEventListener("touchstart", this.handleTouchstart);
        return this;
    }

    /**
     * Destroy Selekt instance
     * @returns {this}
     */
    destroy() {
        this.elParent.removeEventListener("pointerdown", this.handleDown);
        this.elParent.removeEventListener("pointerup", this.handleUp);
        this.elParent.removeEventListener("touchstart", this.handleTouchstart);
        return this;
    }

    /**
     * Enable selection
     * @returns {this}
     */
    enable() {
        this.isEnabled = true;
        return this;
    }

    /**
     * Disable selection
     * @returns {this}
     */
    disable() {
        this.isEnabled = false;
        return this;
    }

    /**
     * Find closest element (similar to Element.closest() but without selector string)
     * If not found, returns null, meaning el was not a descendant of elTarget, or elTarget itself
     * @param {Element|null} el
     * @param {Element|null} elTarget
     * @returns {Element|null}
     */
    closest(el, elTarget) {
        while (el && el !== elTarget) {
            el = el.parentElement;
        }
        return el === elTarget ? el : null;
    }

    /**
     * Get the immediate (valid, not ignored) child element of the parent element starting from the Event Target
     * @param {HTMLElement} elTarget
     * @returns {HTMLElement|null}  
     */
    getImmediateChild(elTarget) {
        // Quick validation
        if (!this.elParent.contains(elTarget)) {
            return null;
        }
        let el = elTarget;
        while (el && el.parentElement !== this.elParent) {
            el = el.parentElement;
        }
        if (el && !el.matches(this.selectorIgnore)) {
            return el;
        }
    }

    /**
     * Get control keys on pointer event
     * @param {PointerEvent} ev
     * @returns {{isCtrl: boolean, isShift: boolean, isAny: boolean, isNone: boolean}}
     */
    getControls(ev) {
        const isCtrl = this.ctrlOn || ev.ctrlKey || ev.metaKey;
        const isShift = ev.shiftKey;
        return {
            isCtrl,
            isShift,
            isAny: isCtrl || isShift,
            isNone: !isCtrl && !isShift
        };
    }

    /**
     *  Get all (valid, not ignored) children of this.elParent
     * @returns {HTMLElement[]} Array of child elements
     */
    getChildren() {
        return /** @type {HTMLElement[]} */ ([...this.elParent.children].filter(el => !el.matches(this.selectorIgnore)));
    }

    /**
     * Toggle ctrlOn state
     * @param {boolean} state
     * @returns {this}
     */
    setCtrl(state) {
        this.ctrlOn = state ?? !this.ctrlOn;
        return this;
    }

    /**
     * Selection logic
     * @param {PointerEvent} ev
     */
    selectLogic(ev) {
        if (this.isMultiple) {
            const controls = this.getControls(ev);
            const siblings = this.getChildren();
            // SINGLE
            if (controls.isNone) {
                const isSel = this.isSelected(this.elItem); // Already selected?
                this.#elPivot = this.elItem; // Set pivot element (for shift selection)
                if (!isSel || Selekt.selected.size > 1) this.clear().select(this.elItem); // Select
                else this.clear(); // Deselect 
            }
            // CTRL
            else if (controls.isCtrl) {
                const isSel = this.isSelected(this.elItem); // Already selected?
                this.#elPivot = this.elItem;  // Set pivot element (for shift selection)
                if (!isSel) this.select(this.elItem); // Select
                else this.deselect(this.elItem); // Deselect 
            }
            // SHIFT
            else if (controls.isShift) {
                let oi = 0;
                let pi = 0;
                if (Selekt.selected.size > 0) {
                    oi = siblings.indexOf(this.elItem); // Target's original index
                    pi = siblings.indexOf(this.#elPivot); // Pivot index
                    if (oi > pi) [oi, pi] = [pi, oi];
                }
                // There's no selected items
                else {
                    this.#elPivot = this.elItem;
                    pi = siblings.indexOf(this.#elPivot); // Pivot index
                }
                this.clear().select(siblings.slice(oi, pi + 1));
            }
        } else {
            this.clear().select(this.elItem);
        }
        this.onSelect?.call(this, { selected: this.getSelected() });
    }

    /**
     * Handle pointerdown event and apply selection logic
     * @param {PointerEvent} ev
     */
    handleDown(ev) {
        if (!this.isEnabled) return;
        // Prevent nested selections bubble to selectable parent
        if (Selekt.isBusy) return;
        Selekt.isBusy = true;

        const controls = this.getControls(ev);
        this.elItem = this.getImmediateChild(/**@type {HTMLElement}*/(ev.target));

        if (controls.isAny) ev.preventDefault();

        // No child found, clear selection
        if (!this.elItem) {
            this.clear();
            return;
        }

        // Clear previous instances if selections were made in it
        if (Selekt.previousInstance !== this) {
            Selekt.previousInstance?.clear();
            Selekt.previousInstance = this;
        }

        // Determine if to handle on pointerdown or reschedule for pointerup
        const isAlreadySelected = this.elItem.matches(`.${this.classSelected}`); // Was already selected?

        // Prevent toggle on single (unless Ctrl key is pressed))
        if (isAlreadySelected && Selekt.selected.size === 1 && !controls.isCtrl) {
            return;
        }

        // Cases that need to be handled on pointerup:
        if (
            (isAlreadySelected && Selekt.selected.size > 0 && controls.isNone) || // Handle already selected items on pointerup
            (isAlreadySelected && !controls.isCtrl) // Do nothing on pointerdown if multiple select (we might want to drag items)
        ) {
            this.elItem.addEventListener("pointerup", (/** @type {PointerEvent} */ ev) => {
                this.selectLogic(ev);
            }, { once: true });
        } else {
            this.selectLogic(ev);
        }
    }

    /**
     * Handle pointerup
     */
    handleUp() {
        Selekt.isBusy = false;
    }

    handleTouchstart() {
        this.ctrlOn = true;
    }

    isSelected(elItem) {
        return Selekt.selected.has(elItem);
    }

    /**
     * Select element(s)
     * @param {HTMLElement|HTMLElement[]} elItem
     * @returns {this}
     */
    select(elItem) {
        if (Array.isArray(elItem)) {
            elItem.forEach((el) => this.select(el));
            return;
        }
        elItem.classList.add(this.classSelected);
        Selekt.selected.add(elItem);
        return this;
    }

    /**
     * Deselect element(s)
     * @param {HTMLElement|HTMLElement[]} elItem
     * @returns {this}
     */
    deselect(elItem) {
        if (Array.isArray(elItem)) {
            elItem.forEach(el => this.deselect(el));
            return;
        }
        elItem.classList.remove(this.classSelected);
        Selekt.selected.delete(elItem);
        return this;
    }

    /**
     * Get selected elements, optionally sorted by original order
     * @param {(a: HTMLElement, b: HTMLElement) => number} [sortFn]
     * @returns {HTMLElement[]}
     */
    getSelected(sortFn) {
        return [...Selekt.selected].sort(sortFn);
    }

    /**
     * Clear all selected elements
     * @returns {this}
     */
    clear() {
        Selekt.selected.forEach((elItem) => elItem.classList.remove(this.classSelected));
        Selekt.selected.clear();
        return this;
    }
}

export default Selekt;
