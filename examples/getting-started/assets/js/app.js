import { Presentable } from "./Presentable.js";
import { BasicComponent } from "../components/basic/basic.js";

console.log('This is the main JavaScript file :)');

const app = new Presentable({
    components: {
        'app-basic': BasicComponent,
    }
});