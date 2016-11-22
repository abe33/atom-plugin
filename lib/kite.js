// Contents of this plugin will be reset by Kite on start. Changes you make
// are not guaranteed to persist.
const events = require('./events.js');
const completions = require('./completions.js');
const ready = require('./ready.js');
const metrics = require('./metrics.js');
const localconfig = require('./localconfig.js');

module.exports = {
  activate: function() {
    // send the activated event
    metrics.track("activated");

    // observeTextEditors takes a callback that fires whenever a new
    // editor window is created. We use this to call "observeEditor",
    // which registers edit/selection based callbacks.
    atom.workspace.observeTextEditors(events.observeEditor);

    // focus is tracked at the workspace level.
    atom.workspace.onDidChangeActivePaneItem(events.onFocus);

    // install hooks and check that Kite is running
    ready.onStartup();

    // watch for the user checking the "check kite status" config item
    var firstObservation = true;
    atom.config.observe('kite.checkReadiness', () => {
      // atom always fires this observer when the observer is registered
      // but we do not want to show the notification at every startup
      if (firstObservation) {
        firstObservation = false;
        return;
      }

      // only respond when the checkbox is set to true
      if (!atom.config.get('kite.checkReadiness', false)) {
        return;
      }

      // the config item is just a stand-in for a button so set it back to false
      setTimeout(() => {
        atom.config.set('kite.checkReadiness', false);
      }, 500);

      // check that kite is running and show a success notification if so
      metrics.track("readiness config checkbox touched");
      ready.ensureAndNotify();
    });
  },
  completions: function() {
    return completions;
  },
  config: {
    enableCompletions: {
      type: "boolean",
      default: true,
      title: "Enable Completions",
      description: "Show auto-completions from Kite as Atom suggestions",
    },
    checkReadiness: {
      type: "boolean",
      default: false,
      title: "Check Kite Status",
      description: "Check this box to check the status of the Kite auto-complete daemon.",
    }
  },
};
