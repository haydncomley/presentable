import { Component, Watch } from "../../../Presentable";

console.log('Imported!')

export const TimerComponent = new Component({
    selector: 'app-timer',
    template: '',
    styles: []
}, function ({ element }) {
    const count = 0;
    const enabled = Watch<boolean>(true);
});