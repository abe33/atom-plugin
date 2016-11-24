// Contents of this plugin will be reset by Kite on start. Changes you make
// are not guaranteed to persist.
const events = require('./events.js');
const completions = require('./completions.js');
const ready = require('./ready.js');
const metrics = require('./metrics.js');
const localconfig = require('./localconfig.js');

const {CompositeDisposable} = require('atom');

module.exports = {
  activate: function() {
    // send the activated event
    metrics.track("activated");

    // All Atom's event methods return disposables. We'll store these
    // disposables in a composite.
    this.subscriptions = new CompositeDisposable();

    // observeTextEditors takes a callback that fires whenever a new
    // editor window is created. We use this to call "observeEditor",
    // which registers edit/selection based callbacks.
    this.subscriptions.add(atom.workspace.observeTextEditors(events.observeEditor));

    // focus is tracked at the workspace level.
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(events.onFocus));

    // check that Kite is running
    ready.ensure();

    // watch for the user checking the "check kite status" config item
    var firstObservation = true;
    this.subscriptions.add(atom.config.observe('kite.checkReadiness', (checkReadiness) => {
      // atom always fires this observer when the observer is registered
      // but we do not want to show the notification at every startup
      if (firstObservation) {
        firstObservation = false;
        return;
      }

      // only respond when the checkbox is set to true
      if (!checkReadiness) {
        return;
      }

      // the config item is just a stand-in for a button so set it back to false
      setTimeout(() => {
        atom.config.set('kite.checkReadiness', false);
      }, 500);

      // check that kite is running and show a success notification if so
      metrics.track("readiness config checkbox touched");
      ready.ensureAndNotify();
    }));
  },

  // By disposing all the subscriptions on deactivation we ensure that no
  // event listeners are leaked. It's crucial when running tests as a package
  // will be activated and deactivated before and after each test
  deactivate: function() {
    this.subscriptions.dispose();
  },

  completions: function() {
    return completions;
  }
};
