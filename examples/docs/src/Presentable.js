class Component {
    constructor(options, logic) {
        this.options = options;
        this.logic = logic;
        this.Initialise();
    }
    Initialise() {
        if (customElements.get(this.options.selector)) {
            console.error('Web Component already defined with selector: ' + this.options.selector);
            return;
        }
        const component = this;
        customElements.define(this.options.selector, class extends HTMLPresentableElement {
            constructor() {
                super();
                this.initialise(component);
            }
        });
    }
    Watch(val) {
        let value = undefined;
        let listeners = [];
        const operations = {
            get: () => { return value; },
            set: (val) => {
                value = JSON.parse(JSON.stringify(val));
                listeners.forEach((listener) => listener.callback(val));
            },
            listen: (callback) => {
                const listenerId = Math.floor(Math.random() * 1000000);
                listeners.push({
                    id: listenerId,
                    callback
                });
                return {
                    dispose: () => { listeners.splice(listeners.findIndex((x) => x.id === listenerId)); }
                };
            }
        };
        operations.set(val);
        return operations;
    }
}
class HTMLPresentableElement extends HTMLElement {
    constructor() {
        super();
        this.presentableListeners = [];
        this.presentableLifecycleEvents = [];
        this.presentableIsDirty = false;
    }
    initialise(component) {
        component.logic({
            // Core
            element: this,
            // Utilities
            Watch: (initial) => {
                const intercepted = component.Watch(initial);
                this.presentableListeners.push(intercepted.listen(() => this.makeDirty()));
                return intercepted;
            },
            // Lifecycle Events
            OnWillCreate: this.createHook('onWillCreate'),
            OnCreate: this.createHook('onCreate'),
            OnWillRemove: this.createHook('onWillRemove'),
            OnRemove: this.createHook('onRemove'),
            OnWillUpdate: this.createHook('onWillUpdate'),
            OnUpdate: this.createHook('onUpdate')
        });
        this.fireHook('onWillCreate');
        this.fireHook('onCreate');
    }
    makeDirty() {
        if (this.presentableIsDirty)
            return;
        this.fireHook('onWillUpdate');
        this.presentableIsDirty = true;
        requestAnimationFrame(() => this.refresh());
    }
    refresh() {
        this.fireHook('onUpdate');
    }
    createHook(name) {
        this.presentableLifecycleEvents.push({
            name,
            listeners: [],
        });
        return (callback) => {
            this.presentableLifecycleEvents.find((x) => x.name === name).listeners.push(callback);
        };
    }
    fireHook(name) {
        this.presentableLifecycleEvents.find((x) => x.name === name).listeners.forEach(hook => hook());
    }
}
