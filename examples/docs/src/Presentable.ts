interface IPresentableComponentOptions {
    selector: string;
    template: string;
    styles: string[];
}

interface ComponentDetails {
    element: HTMLElement;
    Watch<T>(initialValue: T): {
        set(val: T): void;
        get(): T;
        listen(callback: (value: T) => void): {
            dispose: () => void;
        }
    };

    // Lifecycle Hooks
    OnWillCreate(callback: () => void): void;
    OnCreate(callback: () => void): void;

    OnWillRemove(callback: () => void): void;
    OnRemove(callback: () => void): void;

    OnWillUpdate(callback: () => void): void;
    OnUpdate(callback: () => void): void;
}

class Component {
    options: IPresentableComponentOptions;
    logic: (details: ComponentDetails) => void;

    constructor(options: IPresentableComponentOptions, logic: (details: ComponentDetails) => void) {
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

    Watch<T>(val: T) {
        let value = undefined;
        let listeners = [];

        const operations = {
            get: () => { return value as T },
            set: (val) => {
                value = JSON.parse(JSON.stringify(val));
                listeners.forEach((listener) => listener.callback(val));
            },
            listen: (callback: (value: T) => void) => {
                const listenerId = Math.floor(Math.random() * 1_000_000);
                listeners.push({
                    id: listenerId,
                    callback
                });

                return {
                    dispose: () => { listeners.splice(listeners.findIndex((x) => x.id === listenerId)) }
                }
            }
        };

        operations.set(val);
        return operations;
    }
}

abstract class HTMLPresentableElement extends HTMLElement {
    private presentableListeners = [];
    private presentableLifecycleEvents = [];
    private presentableIsDirty = false;

    constructor() {
        super();
    }

    initialise(component: Component) {
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

    private makeDirty() {
        if (this.presentableIsDirty) return;
        this.fireHook('onWillUpdate');
        this.presentableIsDirty = true;
        requestAnimationFrame(() => this.refresh());
    }

    private refresh() {
        this.fireHook('onUpdate');
    }

    private createHook(name: string) {
        this.presentableLifecycleEvents.push({
            name,
            listeners: [],
        });

        return (callback: () => void) => {
            this.presentableLifecycleEvents.find((x) => x.name === name).listeners.push(callback);
        }
    }

    private fireHook(name: string) {
        this.presentableLifecycleEvents.find((x) => x.name === name).listeners.forEach(hook => hook());
    }
}