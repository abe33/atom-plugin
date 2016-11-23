// Contents of this plugin will be reset by Kite on start. Changes you make
// are not guaranteed to persist.

const child_process = require('child_process');

const events = require('./events.js');
const completions = require('./completions.js');
const ready = require('./ready.js');
const metrics = require('./metrics.js');
const localconfig = require('./localconfig.js');

module.exports = {
  activate: function() {
    // send the activated event
    metrics.track("activated");

    // install hooks for editor events and send the activate event
    events.onActivate();

    // install hooks for readiness checker and check that Kite is running
    ready.onActivate();

    // run "apm upgrade kite"
    this.selfUpdate();

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
  selfUpdate: function() {
    var apm = atom.packages.getApmPath();
    child_process.spawn(apm, ['update', 'kite']);
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
