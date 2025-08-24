class Selekt {
    static previousInstance = null;
    static selected = [];
    static isBusy = false;
    #elSelectedPivot = null;
    elItem = null;
    isTouch = false;
    static globalClear = false;

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

        this.init(options);

        if (!Selekt.globalClear) {
            Selekt.globalClear = true;
            addEventListener("pointerup", Selekt.handleClear);
        }
    }

    static handleClear(/** @type {PointerEvent} */ ev) {
        if (!Selekt.previousInstance || !Selekt.selected.length) return;
        const elTarget = /** @type {HTMLElement} */ (ev.target);
        const hasTargetParent = Selekt.previousInstance.closest(elTarget, Selekt.previousInstance.elParent);
        if (!hasTargetParent) {
            Selekt.previousInstance.clear();
        }
    }

    disable() {
        this.isEnabled = false;
    }

    enable(isImmediate = true) {
        if (isImmediate) {
            this.isEnabled = true;
        } else {
            // RAF is helpful here for a drag-and-drop action to terminate, before re-enabling selection
            requestAnimationFrame(() => {
                this.isEnabled = true;
            });
        }
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
        const controls = this.getControls(ev);
        if (this.isMultiple) {
            const siblings = this.getAllowedChildren();
            const ai = Selekt.selected.indexOf(this.elItem); // Selected index in array
            let ti = siblings.indexOf(this.elItem); // Target index
            let pi = siblings.indexOf(this.#elSelectedPivot); // Pivot index
            // Single
            if (controls.isNone) {
                if (ai === -1 || Selekt.selected.length > 1) this.clear().add(this.elItem); // Select
                else this.clear(); // Deselect 
            }
            // CTRL
            if (controls.isCtrl) {
                if (ai === -1) this.add(this.elItem); // Select
                else this.remove(this.elItem); // Deselect 
            }
            // Shift select
            else if (controls.isShift && Selekt.selected.length > 0) {
                if (ti > pi) [ti, pi] = [pi, ti];
                this.clear().add(siblings.slice(ti, pi + 1));
            }
        } else {
            this.clear().add(this.elItem);
        }

        Selekt.selected.forEach(el => el.classList.add(this.classSelected));

        // CALLBACK:
        this.onSelect?.call(this, {
            selected: Selekt.selected,
        });
    }

    handleDown(/** @type {PointerEvent} */ ev) {
        if (!this.isEnabled) return;

        // Prevent nested selections bubble to selectable parent
        if (Selekt.isBusy) return;
        Selekt.isBusy = true;
        requestAnimationFrame(() => Selekt.isBusy = false);

        const controls = this.getControls(ev);
        this.elItem = this.getImmediateChild(/**@type {HTMLElement}*/(ev.target));
        if (controls.isAny) ev.preventDefault();

        // No child found, clear selection
        if (!this.elItem) {
            this.clear();
            return;
        }

        // Clear previous instances is selections were made in it
        if (Selekt.previousInstance !== this) {
            Selekt.previousInstance?.clear();
            Selekt.previousInstance = this;
        }

        const isSelected = this.elItem.matches(`.${this.classSelected}`); // Was already selected?

        // Determine pivot element
        if (controls.isNone || controls.isCtrl) {
            this.#elSelectedPivot = this.elItem;
        }

        // Handle already selected items on pointerup
        if (isSelected && Selekt.selected.length > 0 && controls.isNone) {
            this.elItem.addEventListener("pointerup", this.handleUp, { once: true });
            return;
        }
        // Prevent toggle on single (unless Ctrl key is pressed)
        else if (isSelected && Selekt.selected.length === 1 && !controls.isCtrl) {
            this.elItem.addEventListener("pointerup", this.handleUp, { once: true });
            return;
        }
        // Do nothing on pointerdown if multiple select (we might want to drag items)
        else if (isSelected && !controls.isCtrl) {
            this.elItem.addEventListener("pointerup", this.handleUp, { once: true });
            return;
        }

        this.selectLogic(ev);
    }

    handleUp(/** @type {PointerEvent} */ ev) {
        this.selectLogic(ev);
    }

    add(elItem, index) {
        if (Array.isArray(elItem)) {
            elItem.forEach((el, i) => index ? this.add(el, index + i) : this.add(el));
            return;
        }
        index ??= Selekt.selected.length;
        Selekt.selected.splice(index, 0, elItem);
        elItem.classList.add(this.classSelected);
        return this;
    }

    remove(elItem) {
        if (Array.isArray(elItem)) {
            elItem.forEach(el => this.remove(el));
            return;
        }
        const index = Selekt.selected.indexOf(elItem);
        if (index > -1) {
            Selekt.selected.splice(index, 1);
            elItem.classList.remove(this.classSelected);
        }
        return this;
    }

    /** @returns {Element[]} Get current selected elements */
    get() {
        return Selekt.selected;
    }

    clear() {
        Selekt.selected.forEach(el => el.classList.remove(this.classSelected));
        Selekt.selected = [];
        return this;
    }

    handleTouchstart(/** @type {TouchEvent} */ ev) {
        console.log("@TODO touch", ev.type);
        this.ctrlOn = true;
    }

    init(options = {}) {
        Object.assign(this, options);
        this.elParent.addEventListener("pointerdown", this.handleDown);
        this.elParent.addEventListener("touchstart", this.handleTouchstart);
    }

    destroy() {
        this.elParent.removeEventListener("pointerdown", this.handleDown);
        this.elParent.removeEventListener("touchstart", this.handleTouchstart);
    }
}

export default Selekt;
