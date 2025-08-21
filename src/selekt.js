class Selekt {
    constructor(elParent, options = {}) {
        this.elParent = elParent;
        this.isAny = false;
        this.isNone = false;
        this.ctrlOn = false;
        this.isMultiple = true;
        this.selected = []; // list of selected items
        this.elSelectedFirst = null;
        this.elSelectedLast = null;
        this.selectorItemsIgnore = ".ignore";
        this.classSelected = "is-selected";
        this.isTouch = false; // touch support
        this.onSelect = () => { };
        this.onDeselect = () => { };
        Object.assign(this, options);
        this.select = this.select.bind(this);
        this.handleWindowPointerUp = this.handleWindowPointerUp.bind(this);
        this.init(options);
    }

    /**
     * Find closest element (similar to Element.closest() but without selector string)
     * If not found, returns null, meaning el was not a descendant of elTarget, or elTarget itself
     * @param {Element|null} el
     * @param {Element|null} elTarget
     * @returns {Element|null}
     */
    closestElement(el, elTarget) {
        while (el && el !== elTarget) el = el.parentElement;
        return el === elTarget ? el : null;
    }

    /**
     * Get the closest valid child element of the parent element starting from the Event Target
     */
    getImmediateChild(elTarget) {
        let el = elTarget;
        while (el && el.parentElement !== this.elParent) {
            el = el.parentElement;
        }
        if (!el.matches(this.selectorItemsIgnore)) {
            return el;
        }
    }

    getSelectControls(/** @type {PointerEvent} */ ev) {
        const isCtrl = this.ctrlOn || ev.ctrlKey || ev.metaKey;
        const isShift = ev.shiftKey;
        return {
            isCtrl,
            isShift,
            isAny: isCtrl || isShift,
            isNone: !isCtrl && !isShift
        };
    }

    getChildren() {
        return Array.from(this.elParent.children).filter(el => !el.matches(this.selectorItemsIgnore));
    }

    toggleCtrl(state) {
        this.ctrlOn = state ?? !this.ctrlOn;
    }

    select(/** @type {PointerEvent} */ ev) {
        console.log(ev.type);
        const evTarget = /** @type {HTMLElement} */ (ev.target);
        const elItem = this.getImmediateChild(evTarget);
        
        if (!elItem) return;

        const selCtrl = this.getSelectControls(ev);

        if (selCtrl.isAny) {
            ev.preventDefault();
        }

        const isSelected = elItem.matches(`.${this.classSelected}`);

        // Prevent toggle on single (unless Ctrl key is pressed)
        if (this.selected.length === 1 && isSelected && !selCtrl.isCtrl) {
            console.log("Prevented toggle on single");
            return;
        }

        // Prevent deselect on contextmenu
        if (ev.button === 2 && this.selected.length > 1 && isSelected) {
            return;
        }

        // First selection flag
        const isFirstSelect = !isSelected && (selCtrl.isNone && this.selected.length === 0);


        // Only the first selection should be on pointerdown
        // Multiple selections are rescheduled for pointerup,
        // that way we can drag multiple items at the same time without losing selection.
        if (ev.type === "pointerdown" && !isFirstSelect) {
            console.log("PASSING TO PUP");
            return; // We'll handle multi-selekt on pointerup
        }

        if (isFirstSelect) {
            console.log("isFirstSelect");
            this.elSelectedFirst = elItem;
            this.deselect();
        }

        this.selected.forEach(el => el.classList.remove(this.classSelected));
        const siblings = this.getChildren(elItem.parentElement);

        if (this.isMultiple) {
            let ti = siblings.indexOf(elItem); // target index
            let li = siblings.indexOf(this.elSelectedLast); // last known index
            let ai = this.selected.indexOf(elItem); // indexes array
            if (selCtrl.isCtrl) {
                if (ai > -1) this.selected.splice(ai, 1); // Deselect
                else this.selected.push(elItem); // Select
            }
            if (selCtrl.isShift && this.selected.length > 0) {
                var selectDirectionUp = ti < li;
                if (ti > li) ti = [li, li = ti][0];
                this.selected = siblings.slice(ti, li + 1);
                if (selectDirectionUp) {
                    this.selected = this.selected.reverse(); // Reverse in order to preserve user selection direction
                }
            }
            if (selCtrl.isNone) {
                this.selected = ai < 0 || this.selected.length > 1 ? [elItem] : [];
            }
            this.elSelectedLast = elItem;
        } else {
            this.elSelectedLast = elItem;
            this.selected = [elItem];
        }

        // Filter out not allowed (ignore) items
        this.selected = this.selected.filter((el) => !el.matches(this.selectorItemsIgnore));
        this.selected.forEach(el => el.classList.add(this.classSelected));

        // CALLBACK:
        this.onSelect?.call(this, {
            selected: this.selected,
            elSelectedLast: this.elSelectedLast
        });
    }

    deselect() {
        const oldItems = [...this.selected];
        this.selected.forEach(el => el.classList.remove(this.classSelected));
        this.selected = [];
        // CALLBACK:
        this.onDeselect?.call(this, {
            items: oldItems,
            elSelectedLast: this.elSelectedLast
        });
    }

    handleWindowPointerUp(/** @type {PointerEvent} */ ev) {
        const hasTargetParent = this.closestElement(ev.target, this.elParent);
        if (!hasTargetParent) {
            this.deselect();
        }
    }

    handleTouchStart(/** @type {TouchEvent} */ ev) {
        console.log("touch");
        this.isTouch = true;
    }

    init(options = {}) {
        Object.assign(this, options);
        this.elParent.addEventListener("pointerdown", this.select);
        this.elParent.addEventListener("pointerup", this.select);
        this.elParent.addEventListener("touchstart", this.handleTouchStart);
        addEventListener("pointerup", this.handleWindowPointerUp);
    }

    destroy() {
        this.elParent.removeEventListener("pointerdown", this.select);
        this.elParent.removeEventListener("pointerup", this.select);
        removeEventListener("pointerup", this.handleWindowPointerUp);
    }
}

export default Selekt;
