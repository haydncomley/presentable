/*  Remaining:
    - Binding to attributes (two-way) e.g. input text
    - CSS
    - More Custom Condition "Directives" such as class binding 
*/
export class Presentable {
    #debug = true;
    version = '0.0.1';

    constructor({ 
        components = [ PresentableComponent ],
        debug = true
    }) {
        this.#debug = debug;

        this.#log('Starting.');
        this.#loadComponents(components);
    }

    #log(message, ...args) {
        if (!this.#debug) return;
        console.log(`[Presentable] ${message}`, ...args);
    }

    #loadComponents(components = [ PresentableComponent ]) {
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
            onCreate: () => {},
            onRemove: () => {},
            onWillUpdate: () => {},
            onUpdate: () => {},
        },
        Watch: (initialValue) => {
            let value = initialValue;

            return {
                get: () => { return value },
                set: (val) => {
                    value = val;
                    this.element.host.markAsDirty();
                }
            }
        }
    }


    constructor({
        template,
        styles = []
    }) {
        this.element.template = template;
        this.element.styles = styles;
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
        this.component.element.hooks.onCreate();
    }

    markAsDirty() {
        this.component.element.hooks.onWillUpdate();
        this.onUpdate();
    }

    disconnectedCallback() {
        this.component.element.hooks.onRemove();
    }

    // TODO: Research this further.
    // adoptedCallback() {
    //     this.component.element.hooks.onCreate();
    // }


    // TODO: Sync Attributes with variables people have marked as to watch, also echo back out to the attributes these values.

    // static get observedAttributes() { return ['c', 'l']; }

    // attributeChangedCallback(name, oldValue, newValue) {
    //     console.log('Custom square element attributes changed.');
    //     updateStyle(this);
    //   }

    async onUpdate() {
        this.#transformBindings();
        this.#transformTextVariables();
        this.#transformEvents();
        this.component.element.hooks.onUpdate();
    }

    async #generateTemplate() {
        this.component.element.template = await (await fetch(this.component.element.template)).text();
        this.shadowRoot.innerHTML = this.component.element.template;
        this.#generateBindings();
        this.markAsDirty();
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
        this.#generateBinding('condition-if', false, (result, element, placeholder) => {
            if (result == placeholder['condition-link']) return;

            if (!result) {
                placeholder.parentNode.removeChild(placeholder.nextSibling);
            } else if (result) {
                placeholder.after(element.cloneNode(true));
            }

            placeholder['condition-link'] = result;
        });

        // List based on count
        this.#generateBinding('condition-count', null, (result, element, placeholder) => {
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
        const condition_for = this.component.element.content.querySelectorAll(`[condition-for]`);

        condition_for.forEach((element) => {
            const statement = element.getAttribute('condition-for');
            const placeholder = document.createComment('condition-for');

            element.before(placeholder);
            element.removeAttribute('condition-for');
            element.parentNode.removeChild(element);
            const portions = statement.split('=>');

            const key = element.getAttribute('condition-key');
            if (key !== undefined) element.removeAttribute('condition-key');

            placeholder['condition-link'] = {
                name: portions[0].trim(),
                array: portions[1].trim(),
                previous: null
            };

            this.#conditionalTemplates.push({
                parent: placeholder.parentElement,
                statement: placeholder['condition-link'].array,
                process: (result) => {
                    if (!result) result = [];
                    if (placeholder['condition-link'].previous && result.length == placeholder['condition-link'].previous.length) return;
                    if (!placeholder['condition-link'].previous) placeholder['condition-link'].previous = [];
                    
                    placeholder['condition-link'].previous.forEach((element, i) => {
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
        const condition_event = this.component.element.content.querySelectorAll(`[condition-event]`);

        condition_event.forEach((element) => {
            const statement = element.getAttribute('condition-event');
            element.removeAttribute('condition-event');
            const portions = statement.split('=>');
            element.addEventListener(portions[0].trim(), (ev) => {
                this.#localiseBindingStatement(portions[1].trim(), element);
            });
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

                    while(item && item[`$${extract}`] === undefined && item != template.parent) {
                        item = item.parentElement;
                    }

                    extras[extract] = item[`$${extract}`];
                }
            });
        }

        try {
            return function() { 
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

        for (let i = 0; i < parentElement.children.length; i++) {
            const element = parentElement.children[i];
            const iterator = document.createNodeIterator(element, NodeFilter.SHOW_TEXT);
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

            this.#calculateTextVariables(element);
        }
    }

    #transformTextVariables() {
        const removeThese = [];

        this.#textTemplates.forEach((bindParent, index) => {
            const isRemoving = false;
            if(!this.component.element.content.contains(bindParent.element)) {
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