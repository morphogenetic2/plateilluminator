(function initMainModule(global) {
    const App = global.App;
    const fn = App.fn;

    function bootstrapApp() {
        fn.initState();
        fn.initLedGrid();
        fn.initEventHandlers();
        fn.initSimulatorEvents();
        fn.updateStepParams();
        fn.renderTimeline();
        fn.updateblockSelector();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapApp);
    } else {
        bootstrapApp();
    }
})(window);
