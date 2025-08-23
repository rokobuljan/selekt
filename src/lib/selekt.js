class Selekt {
    static elSelectedLastParent = null;
    #isHandled = false;
    #elItem = null;
    #isEnabled = true;
    #elSelectedPivot = null;
    elSelectedLast = null;
    isTouch = false;

    constructor(/** @type {HTMLElement} */ elParent, options = {}) {
        this.elParent = elParent;
        this.selectorIgnore = ".ignore";
        this.classSelected = "is-selected";
        this.ctrlOn = false;
        this.isMultiple = true;
        this.selected = []; // list of selected items
        this.onSelect = () => { };

        this.handleSelect = this.handleSelect.bind(this);
        this.handleClear = this.handleClear.bind(this);

        this.init(options);
    }

    disable() {
        this.#isEnabled = false;
    }

    enable() {
        // RAF is helpful here for a drag-and-drop action to terminate, before re-enabling selection
        requestAnimationFrame(() => {
            this.#isEnabled = true;
        });
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

    // /**
    //  * Get the closest valid child element of the parent element starting from the Event Target
    //  */
    // getImmediateChild(elTarget) {
    //     if (!this.elParent.contains(elTarget)) {
    //         return null;
    //     }

    //     let el = elTarget;
    //     // Traverse up until we reach our direct child
    //     while (el && el.parentElement !== this.elParent) {
    //         el = el.parentElement;
    //     }

    //     if (el && el.parentElement === this.elParent && !el.matches(this.selectorIgnore)) {
    //         // Check if target belongs to a nested selekt container
    //         let checkEl = elTarget;
    //         while (checkEl && checkEl !== el) {
    //             if (checkEl.hasAttribute('data-selekt') && checkEl !== this.elParent) {
    //                 return null; // Target belongs to nested selekt container
    //             }
    //             checkEl = checkEl.parentElement;
    //         }
    //         return el;
    //     }
    // }

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

    getChildren() {
        return [...this.elParent.children].filter(el => !el.matches(this.selectorIgnore));
    }

    toggleCtrl(/** @type {boolean} */ state) {
        this.ctrlOn = state ?? !this.ctrlOn;
    }

    handleSelect(/** @type {PointerEvent} */ ev) {
        if (!this.#isEnabled) {
            return;
        }
        const elItem = this.getImmediateChild(/**@type {HTMLElement}*/(ev.target));
        const isDown = ev.type === "pointerdown";
        if (!elItem) return;

        if (isDown && !elItem) {
            this.deselect();
            return;
        }

        // Deselect other parents
        if (Selekt.elSelectedLastParent && this.elParent !== Selekt.elSelectedLastParent) {
            this.deselect();
            return;
        } else {
            Selekt.elSelectedLastParent = this.elParent;
            requestAnimationFrame(() => {
                Selekt.elSelectedLastParent = null;
            });
        }

        // The pointerup event must match the item that initiated it
        if (!isDown && this.#elItem !== elItem) {
            return;
        } else {
            this.#elItem = elItem; // Store for later use
        }

        const controls = this.getControls(ev);
        if (controls.isAny) ev.preventDefault();

        const isFirstSelect = isDown && controls.isNone; // First selection flag
        const isSelected = elItem.matches(`.${this.classSelected}`);

        if (!isDown && this.#isHandled) {
            // PASS: Already handled by pointerDown, ignore pointerup
            this.#isHandled = false;
            return;
        }

        if (isDown) {
            // Handle already selected items on pointerup
            if (isSelected && this.selected.length > 0 && controls.isNone) {
                return;
            }
            // Prevent toggle on single (unless Ctrl key is pressed)
            else if (isSelected && this.selected.length === 1 && !controls.isCtrl) {
                return;
            }
            // Do nothing on pointerdown if multiple select (we might want to drag items)
            else if (isSelected && !isFirstSelect && !controls.isCtrl) {
                return;
            }
        }

        // LOGIC STARTS HERE

        if (isFirstSelect) {
            this.deselect();
        }

        // Determine selection pivot element
        if (isFirstSelect || controls.isCtrl) {
            this.#elSelectedPivot = elItem;
        }

        this.selected.forEach(el => el.classList.remove(this.classSelected));

        if (this.isMultiple) {
            const siblings = this.getChildren();
            const ai = this.selected.indexOf(elItem); // Selected index in array
            let ti = siblings.indexOf(elItem); // Target index
            let pi = siblings.indexOf(this.#elSelectedPivot); // Pivot index
            if (controls.isCtrl) {
                if (ai > -1) this.selected.splice(ai, 1); // Deselect
                else this.selected.push(elItem); // Select
            }
            if (controls.isShift && this.selected.length > 0) {
                const selectDirectionUp = ti < pi;
                if (ti > pi) ti = [pi, pi = ti][0];
                this.selected = siblings.slice(ti, pi + 1);
                if (selectDirectionUp) {
                    this.selected = this.selected.reverse(); // Reverse in order to preserve user selection direction
                }
            }
            if (controls.isNone) {
                this.selected = ai < 0 || this.selected.length > 1 ? [elItem] : [];
            }
        } else {
            this.selected = [elItem];
            this.#elSelectedPivot = elItem;
        }

        this.elSelectedLast = elItem;

        // Filter out not allowed (ignore) items
        this.selected = this.selected.filter((el) => !el.matches(this.selectorIgnore));
        this.selected.forEach(el => el.classList.add(this.classSelected));

        // Schedule window pointerup to clear selection
        if (isDown) {
            removeEventListener("pointerdown", this.handleClear);
            addEventListener("pointerdown", this.handleClear);
        }

        this.#isHandled = true; // Mark as handled to prevent further processing

        // CALLBACK:
        this.onSelect?.call(this, {
            selected: this.selected,
            elSelectedLast: this.elSelectedLast
        });
    }

    handleClear(/** @type {PointerEvent} */ ev) {
        if (!this.selected.length) return;
        const elTarget = /** @type {HTMLElement} */ (ev.target);
        const hasTargetParent = this.closest(elTarget, this.elParent);
        if (!hasTargetParent) {
            this.deselect();
        }
    }

    deselect() {
        this.selected.forEach(el => el.classList.remove(this.classSelected));
        this.selected = [];
        this.selectedLast = null;
        this.#elSelectedPivot = null;
    }

    handleTouchStart(/** @type {TouchEvent} */ ev) {
        console.log("@TODO touch", ev.type);
        this.ctrlOn = true;
    }

    init(options = {}) {
        Object.assign(this, options);
        this.elParent.addEventListener("pointerdown", this.handleSelect);
        this.elParent.addEventListener("pointerup", this.handleSelect);
        this.elParent.addEventListener("touchstart", this.handleTouchStart);
    }

    destroy() {
        this.elParent.removeEventListener("pointerdown", this.handleSelect);
        this.elParent.removeEventListener("pointerup", this.handleSelect);
        this.elParent.removeEventListener("touchstart", this.handleTouchStart);
    }
}

export default Selekt;
