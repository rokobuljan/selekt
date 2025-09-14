class Selekt {
    static selected = new Set();
    static selectedOld = /** @type {HTMLElement[]} */ ([]);
    static previousInstance = null;
    static isClearInit = false;
    static isBusy = false;
    static handleClear(/** @type {PointerEvent} */ ev) {
        if (!Selekt.previousInstance || !Selekt.selected.size) return;
        const targetParent = Selekt.previousInstance.closest(
            /** @type {HTMLElement} */(ev.target),
            Selekt.previousInstance.elParent
        );
        if (!targetParent) {
            Selekt.previousInstance.clear();
            Selekt.previousInstance = null;
        }
    }

    #elPivot = null;
    elItem = null;
    isTouch = false;

    constructor(/** @type {HTMLElement} */ elParent, options = {}) {
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

    init(options = {}) {
        Object.assign(this, options);
        this.elParent.addEventListener("pointerdown", this.handleDown);
        this.elParent.addEventListener("pointerup", this.handleUp);
        this.elParent.addEventListener("touchstart", this.handleTouchstart);
    }

    destroy() {
        this.elParent.removeEventListener("pointerdown", this.handleDown);
        this.elParent.removeEventListener("touchstart", this.handleTouchstart);
    }

    disable() {
        this.isEnabled = false;
        return this;
    }

    enable() {
        this.isEnabled = true;
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
     * Get the closest valid child element of the parent element starting from the Event Target
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

    getControls(/** @type {PointerEvent} */ ev) {
        const isCtrl = this.ctrlOn || ev.ctrlKey || ev.metaKey;
        const isShift = ev.shiftKey;
        return {
            isCtrl,
            isShift,
            isAny: isCtrl || isShift,
            isNone: !isCtrl && !isShift
        };
    }

    getAllowedChildren() {
        return [...this.elParent.children].filter(el => !el.matches(this.selectorIgnore));
    }

    toggleCtrl(/** @type {boolean} */ state) {
        this.ctrlOn = state ?? !this.ctrlOn;
    }

    selectLogic(/** @type {PointerEvent} */ ev) {
        if (this.isMultiple) {
            const controls = this.getControls(ev);
            const siblings = this.getAllowedChildren();
            // SINGLE
            if (controls.isNone) {
                const isSel = this.isSelected(this.elItem); // Already selected?
                this.#elPivot = this.elItem; // Set pivot element (for shift selection)
                if (!isSel || Selekt.selected.size > 1) this.clear().add(this.elItem); // Select
                else this.clear(); // Deselect 
            }
            // CTRL
            else if (controls.isCtrl) {
                const isSel = this.isSelected(this.elItem); // Already selected?
                this.#elPivot = this.elItem;  // Set pivot element (for shift selection)
                if (!isSel) this.add(this.elItem); // Select
                else this.remove(this.elItem); // Deselect 
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
                this.clear().add(siblings.slice(oi, pi + 1));
            }
        } else {
            this.clear().add(this.elItem);
        }
        this.onSelect?.call(this, { selected: this.get() });
    }

    handleDown(/** @type {PointerEvent} */ ev) {
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
            this.elItem.addEventListener("pointerup", (ev) => {
                this.selectLogic(ev);
            }, { once: true });
        } else {
            this.selectLogic(ev);
        }
    }

    handleUp(/** @type {PointerEvent} */ ev) {
        Selekt.isBusy = false;
    }

    handleTouchstart() {
        this.ctrlOn = true;
    }

    isSelected(elItem) {
        return Selekt.selected.has(elItem);
    }

    add(elItem) {
        if (Array.isArray(elItem)) {
            elItem.forEach((el) => this.add(el));
            return;
        }
        elItem.classList.add(this.classSelected);
        Selekt.selected.add(elItem);
        return this;
    }

    remove(elItem) {
        if (Array.isArray(elItem)) {
            elItem.forEach(el => this.remove(el));
            return;
        }
        elItem.classList.remove(this.classSelected);
        Selekt.selected.delete(elItem);
        return this;
    }

    /**
     * Get selected elements, sorted by original order
     * @returns {HTMLElement[]}
     * */
    get(sortFn) {
        return sortFn ? [...Selekt.selected].sort(sortFn) : [...Selekt.selected];
    }

    clear() {
        Selekt.selected.forEach((elItem) => elItem.classList.remove(this.classSelected));
        Selekt.selectedOld = [...Selekt.selected];
        Selekt.selected.clear();
        return this;
    }

    /**
     * Re-select previously selected elements
     * @returns {Selekt}
     */
    reselect() {
        this.clear().add(Selekt.selectedOld);
        return this;
    }
}

export default Selekt;
