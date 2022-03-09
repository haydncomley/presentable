new Component({
    selector: 'app-timer',
    template: '',
    styles: []
}, function ({ Watch, OnUpdate, element }) {

    const count = 0;
    const enabled = Watch(true);

    // const listener = enabled.listen((t) => console.log('Value Updated: ' + t));

    // enabled.set(false);
    // enabled.set(true);
    // listener.dispose();
    // enabled.set(false);

    // console.log('Doing Component Stuff...', this)

    OnUpdate(() => {
        console.log('Component Updated');
    })

    console.log(element)
});