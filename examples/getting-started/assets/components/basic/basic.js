import { PresentableComponent } from "../../js/Presentable.js";

export class BasicComponent extends PresentableComponent {
    foo = 'Hello World';
    another = 'Hey there.';
    name = this.element.Watch('Haydn');

    constructor() {
        super({
            template: `/assets/components/basic/basic.html`,
        });
    }

}