/*  Remaining:
    - More Custom Condition "Directives" such as class binding 
    - Potentially allow binding to variables in attributes?
*/
export class Presentable {
    #debug = true;
    version = '0.0.2';

    constructor({
        components = [PresentableComponent],
        debug = true
    }) {
        this.#debug = debug;

        log('Starting.');
        this.#loadComponents(components);
    }

    #loadComponents(components = [PresentableComponent]) {
        const keys = Object.keys(components);
        keys.forEach(element => this.#loadComponent(element, components[element]));
    }

    async #loadComponent(selector, component = PresentableComponent) {
        customElements.define(selector, class extends HTMLPresentableElement {
            component = new component();

            constructor() {
                super();
                this.initialiseComponent();
            }
        });
    }
}

export class PresentableComponent {
    element = {
        host: null,
        content: null,
        template: null,
        styles: [],
        hooks: {
            onCreate: () => { },
            onRemove: () => { },
            onWillUpdate: () => { },
            onUpdate: () => { },
        },
        Watch: (initialValue) => {
            let value = initialValue;
            let listeners = [];

            return {
                get: () => { return value },
                set: (val) => {
                    value = val;
                    listeners.forEach(listener => listener(val));
                    this.element.host.markAsDirty();
                },
                listen: (callback) => listeners.push(callback)
            }
        }
    }


    constructor({
        template,
        styles = [],
    }) {
        this.element.template = template;
        this.element.styles = Array.isArray(styles) ? styles : [styles];
    }
}

export class HTMLPresentableElement extends HTMLElement {
    component = new PresentableComponent({});
    #conditionalTemplates = [];
    #textTemplates = [];

    initialiseComponent() {
        this.component.element.host = this;
        this.component.element.content = this.attachShadow({ mode: 'open' });
        this.#generateTemplate();
        this.#generateStyles();
        this.#generateAttributeLinks();
        this.component.element.hooks.onCreate();
    }

    markAsDirty() {
        this.component.element.hooks.onWillUpdate();
        this.onUpdate();
    }

    disconnectedCallback() {
        this.component.element.hooks.onRemove();
    }

    async onUpdate() {
        this.#transformBindings();
        this.#transformTextVariables();
        this.#transformEvents();
        this.component.element.hooks.onUpdate();
    }

    async #generateAttributeLinks() {
        Object.keys(this.component).forEach((key) => {
            if (this.component[key] && typeof this.component[key] === 'object' && this.component[key].get && this.component[key].set) {
                Object.defineProperty(this, key, {
                    get: () => this.component[key].get(),
                    set: (v) => this.component[key].set(v)
                });
            }
        })
    }
    async #generateTemplate() {
        this.component.element.template = await (await fetch(this.component.element.template)).text();
        const templateElement = document.createElement('div');
        templateElement.innerHTML = this.component.element.template;

        for (let i = 0; i < templateElement.childNodes.length; i++) {
            const element = templateElement.childNodes[i];
            this.shadowRoot.appendChild(element.cloneNode(true));
        }

        this.#generateBindings();
        this.markAsDirty();
    }

    async #generateStyles() {
        this.component.element.styles.forEach(async (style, i) => {
            this.component.element.styles[i] = await (await fetch(this.component.element.styles[i])).text();
            const styleElement = document.createElement('style');
            styleElement.textContent = this.component.element.styles[i];
            this.shadowRoot.appendChild(styleElement);
        });
    }

    #generateBinding(selector, link, processor) {
        const condition_elements = this.component.element.content.querySelectorAll(`[${selector}]`);

        condition_elements.forEach((element) => {
            const statement = element.getAttribute(selector);
            const conditionPlaceholder = document.createComment(selector);

            element.before(conditionPlaceholder);
            element.removeAttribute(selector);
            element.parentNode.removeChild(element);
            conditionPlaceholder['condition-link'] = link;

            this.#conditionalTemplates.push({
                parent: conditionPlaceholder.parentElement,
                statement: statement,
                process: (result) => processor(result, element, conditionPlaceholder)
            });
        });
    }

    async #generateBindings() {
        // Toggle item based on if
        this.#generateBinding('if', false, (result, element, placeholder) => {
            if (result == placeholder['condition-link']) return;

            if (!result) {
                placeholder.parentNode.removeChild(placeholder.nextSibling);
            } else if (result) {
                placeholder.after(element.cloneNode(true));
            }

            placeholder['condition-link'] = result;
        });

        // List based on count
        this.#generateBinding('count', null, (result, element, placeholder) => {
            if (placeholder['condition-link'] !== null && (Array.isArray(result) ? result.length : result) == placeholder['condition-link'].length) return;
            if (!placeholder['condition-link']) placeholder['condition-link'] = [];

            placeholder['condition-link'].forEach((element) => {
                placeholder.parentNode.removeChild(placeholder.previousSibling);
            });
            placeholder['condition-link'] = [];
            for (let i = 0; i < (Array.isArray(result) ? result.length : result); i++) {
                const forElement = element.cloneNode(true);
                placeholder['condition-link'].push(forElement);
                placeholder.before(forElement);
            }

            if ((Array.isArray(result) ? result.length : result) === 0 && element.parentNode) element.parentNode.removeChild(element);
        });

        // List based on array
        const condition_for = this.component.element.content.querySelectorAll(`[for]`);

        condition_for.forEach((element) => {
            const statement = element.getAttribute('for');
            const placeholder = document.createComment('for');

            element.before(placeholder);
            element.removeAttribute('for');
            element['for-parent'] = element.parentNode;
            element.parentNode.removeChild(element);
            const portions = statement.split('=>');

            const key = element.getAttribute('for-key');
            if (key !== undefined) element.removeAttribute('for-key');

            placeholder['condition-link'] = {
                name: portions[0].trim(),
                array: portions[1].trim(),
                previous: null
            };

            this.#conditionalTemplates.unshift({
                parent: placeholder.parentElement,
                statement: placeholder['condition-link'].array,
                process: (result) => {
                    // TODO: Look into only updating thr views that were changed rather than completely re-rendering...
                    if (!result) result = [];
                    // if (placeholder['condition-link'].previous && result.length == placeholder['condition-link'].previous.length) return;
                    let exists = true;
                    if (!placeholder['condition-link'].previous) {
                        placeholder['condition-link'].previous = [];
                        exists = false;
                    }

                    placeholder['condition-link'].previous.forEach(() => {
                        placeholder.parentNode.removeChild(placeholder.previousSibling);
                    });
                    placeholder['condition-link'].previous = [];
                    for (let i = 0; i < result.length; i++) {
                        const forElement = element.cloneNode(true);
                        forElement['$' + placeholder['condition-link'].name] = result[i];
                        forElement['$' + 'index'] = i;
                        placeholder['condition-link'].previous.push(forElement);
                        placeholder.before(forElement);
                    }

                    if (result.length === 0 && element.parentNode) element.parentNode.removeChild(element);
                }
            });
        });
    }

    #transformEvents() {
        const condition_event = this.component.element.content.querySelectorAll(`[event]`);

        condition_event.forEach((element) => {
            const statement = element.getAttribute('event');
            element.removeAttribute('event');
            const portions = statement.split('=>');
            element.addEventListener(portions[0].trim(), (ev) => {
                element['$event'] = ev;
                this.#localiseBindingStatement(portions[1].trim(), element, {});
            });
        });

        const condition_bindings = this.component.element.content.querySelectorAll(`[bind]`);

        condition_bindings.forEach((element) => {
            const statement = element.getAttribute('bind');
            element.removeAttribute('bind');
            const portions = statement.split('=>');
            const bindTo = this.component[portions[1].trim()];
            if (bindTo.get && bindTo.set) {
                element.addEventListener('change', () => bindTo.set(element[portions[0].trim()]));
                element.addEventListener('input', () => bindTo.set(element[portions[0].trim()]));
                element[portions[0].trim()] = bindTo.get();
                bindTo.listen((e) => { element[portions[0].trim()] = e; });
            } else {
                log('Dynamic binding only allowed on variables that are being "Watched" by the component.');
            }
        });
    }

    #localiseBindingStatement(statement, currentElement) {
        const extras = {
            this: currentElement
        };
        if (statement.includes('$.')) {
            const statementExtract = /\$\.(\w+)\b/g;
            const extract = statement.match(statementExtract)[0].slice(2);

            this.#conditionalTemplates.forEach(template => {
                if (template.parent.contains(currentElement)) {
                    let item = currentElement;

                    while (item && item[`$${extract}`] === undefined && item != template.parent) {
                        item = item.parentElement;
                    }

                    extras[extract] = item[`$${extract}`];
                }
            });
        }

        try {
            return function () {
                const $ = extras;
                return eval(statement);
            }.call(this.component);
        } catch {
            return undefined;
        }
    }

    #transformBindings() {
        this.#conditionalTemplates.forEach(element => {
            element.process(this.#localiseBindingStatement(element.statement, element));
        });


        this.#calculateTextVariables(this.component.element.content);
    }

    #calculateTextVariables(parentElement) {
        const reg = /{{.+?}}/gm;
        if (!reg.exec(parentElement.innerHTML)) return;

        this.#iterateOnNode(parentElement);

        for (let i = 0; i < parentElement.children.length; i++) {
            const element = parentElement.children[i];
            this.#iterateOnNode(element);
            this.#calculateTextVariables(element);
        }
    }

    #iterateOnNode(element) {
        const reg = /{{.+?}}/gm;
        const iterator = document.createNodeIterator(element, NodeFilter.SHOW_TEXT);
        console.log(iterator)
        let currentNode;
        while (currentNode = iterator.nextNode()) {
            const bindings = reg.exec(currentNode.textContent);
            if (!bindings) continue;
            const newTextBinding = {
                raw: String(currentNode.textContent),
                element: currentNode
            };
            this.#textTemplates.push(newTextBinding);
            currentNode.textContent = ''
        }
    }

    #transformTextVariables() {
        const removeThese = [];

        this.#textTemplates.forEach((bindParent, index) => {
            const isRemoving = false;
            if (!this.component.element.content.contains(bindParent.element)) {
                removeThese.push(index);
                return;
            };

            let text = bindParent.raw;
            const bindings = text.match(/{{.+?}}/gm);

            bindings.forEach((e) => {
                text = text.replace(e, String(this.#localiseBindingStatement(e.trim().slice(2, -2), bindParent.element)));
            });
            if (bindParent.element.textContent != text) bindParent.element.textContent = text;
        });

        removeThese.reverse().forEach((i) => this.#textTemplates.splice(i, 1));
    }

}

function log(message, ...args) {
    console.log(`[Presentable] ${message}`, ...args);
}