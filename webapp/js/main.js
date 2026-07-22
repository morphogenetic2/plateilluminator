(function initMainModule(global) {
    const App = global.App;
    const fn = App.fn;

    function bootstrapApp() {
        fn.initState();
        fn.initLedGrid();
        fn.updateAllLedProgramIndicators();
        fn.initEventHandlers();
        fn.initSimulatorEvents();
        fn.updateStepParams();
        fn.renderTimeline();
        fn.updateblockSelector();
        if (fn.updateEditorAvailability) fn.updateEditorAvailability();
        if (App.state.draftRestored && fn.showTopToast) fn.showTopToast('Local draft restored');

        window.addEventListener('beforeunload', (event) => {
            if (!App.state.isDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapApp);
    } else {
        bootstrapApp();
    }
})(window);
