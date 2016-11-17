const os = require('os');
const path = require('path');
const utils = require('./utils.js');
const metrics = require('./metrics.js');
const StateController = require('kite-installer/lib/state-controller.js');

// minimum time between showing the same notification, in milliseconds
const NOTIFY_DELAY = 60 * 60 * 1000;

var Ready = {
  currentPath: function() {
    var editor = atom.workspace.getActivePaneItem();
    if (editor === undefined || editor.buffer == undefined || editor.buffer.file == undefined) {
      return null;
    }
    return editor.buffer.file.path;
  },

  // lastNotify contains the last time we notified the user about being in the
  // given state. It is used to prevent bugging the user too frequently with
  // notifications.
  lastNotified: {},

  // shouldNotify returns true if the user should be notified about the given
  // failure detected by ensure
  shouldNotify: function(state, forceNotify) {
    var now = new Date();
    var prev = this.lastNotified[state];
    if (forceNotify || prev === undefined || (now.getTime() - prev.getTime()) >= NOTIFY_DELAY) {
      this.lastNotified[state] = now;
      return true;
    }
    return false;
  },

  // ensure checks that Kite is installed, running, reachable, authenticated,
  // and enabled in the current directory. If any of these checks fail then an
  // appropriate noficiation is displayed with a button that lets the user fix
  // the problem.
  ensure: function(forceNotify) {
    forceNotify = (forceNotify === undefined) ? false : true;
    var curpath = this.currentPath();
    StateController.handleState(curpath).then((state) => {
      switch (state) {
        case StateController.STATES.UNSUPPORTED:
          if (this.shouldNotify(state, forceNotify)) {
            this.warnNotSupported();
          }
          break;
        case StateController.STATES.UNINSTALLED:
          if (this.shouldNotify(state, forceNotify)) {
            this.warnNotInstalled();
          }
          break;
        case StateController.STATES.INSTALLED:
          if (this.shouldNotify(state, forceNotify)) {
            this.warnNotRunning();
          }
          break;
        case StateController.STATES.RUNNING:
          if (this.shouldNotify(state, forceNotify)) {
            this.warnNotReachable();
          }
          break;
        case StateController.STATES.REACHABLE:
          if (this.shouldNotify(state, forceNotify)) {
            this.warnNotAuthenticated();
          }
          break;
        case StateController.STATES.AUTHENTICATED:
          if (curpath !== null) {
            if (this.shouldNotify(state, forceNotify)) {
              this.warnNotWhitelisted(curpath);
            }
          } else if (forceNotify) {
            this.notifyReady();
          }
          break;
        case StateController.STATES.WHITELISTED:
          metrics.track("kite is ready");
          if (forceNotify) {
            this.notifyReady();
          }
          break;
      }
    }, (err) => {
      metrics.track("handleState failed", err);
    });
  },

  // ensureAndNotify is like ensure but also shows a success notification if Kite is already running.
  ensureAndNotify: function() {
    this.ensure(true);
  },

  warnNotSupported: function() {
    metrics.track("not-supported warning shown");
    atom.notifications.addError(
      "The Kite autocomplete daemon is not supported on this platform", {
      description: "Kite is currently only supported on macOS.",
      icon: "circle-slash",
      dismissable: true,
    }).onDidDismiss(() => {
      metrics.track("not-supported warning dismissed");
    });
  },

  warnNotInstalled: function() {
    metrics.track("not-installed warning shown");
    var notification = atom.notifications.addWarning(
      "The Kite autocomplete daemon is not installed", {
      description: "In order to provide completions the Kite daemon needs to be installed.",
      icon: "circle-slash",
      dismissable: true,
      buttons: [{
        text: "Install Kite",
        onDidClick: () => {
          metrics.track("install button clicked (via not-installed warning)");
          notification.dismiss();
          this.install();
        }
      }]
    });
    notification.onDidDismiss(() => {
      metrics.track("not-installed warning dismissed");
    });
  },

  install: function() {
    metrics.track("download-and-install started");
    StateController.installKiteRelease().then(() => {
      metrics.track("download-and-install succeeded");
      this.launch();
    }, (err) => {
      // installation failed, show an error notification
      metrics.track("download-and-install failed", err);
      var notification = atom.notifications.addError("Unable to install Kite", {
        description: JSON.stringify(err),
        dismissable: true,
        buttons: [{
          text: "Retry",
          onDidClick: () => {
            metrics.track("retry button clicked (via download-and-install error)");
            notification.dismiss();
            this.install();
          }
        }]
      });
      notification.onDidDismiss(() => {
        metrics.track("download-and-install error dismissed");
      });
    });
    // TODO: on failure display a notification with an option to retry
  },

  warnNotRunning: function() {
    metrics.track("not-running warning shown");
    var notification = atom.notifications.addWarning(
      "The Kite autocomplete daemon is not running", {
      description: "In order to provide completions the Kite daemon needs to be started.",
      icon: "circle-slash",
      dismissable: true,
      buttons: [{
        text: "Start Kite",
        onDidClick: () => {
          metrics.track("start button clicked (via not-running warning)");
          notification.dismiss();
          this.launch();
        }
      }]
    });
    notification.onDidDismiss(() => {
      metrics.track("not-running warning dismissed");
    });
  },

  launch: function() {
    metrics.track("launch started");
    StateController.runKite().then(() => {
      // TODO: remove this "sleep" after the runKite promise resolves only when kite is running
      setTimeout(() => {
        metrics.track("launch succeeded");
        this.ensure();
      }, 5000);
    }, (err) => {
      metrics.track("launch failed", err);
      var notification = atom.notifications.addError("Unable to start Kite autocomplete daemon", {
        description: JSON.stringify(err),
        dismissable: true,
        buttons: [{
          text: "Retry",
          onDidClick: () => {
            metrics.track("retry button clicked (via launch error)");
            notification.dismiss();
            this.launch();
          }
        }]
      });
      notification.onDidDismiss(() => {
        metrics.track("launch error dismissed");
      });
    });
  },

  warnNotReachable: function() {
    metrics.track("not-reachable warning shown");
    atom.notifications.addError(
      "The Kite autocomplete daemon is running but not reachable", {
      description: "Try killing Kite from Activity Monitor.",
      dismissable: true,
    }).onDidDismiss(() => {
      metrics.track("not-reachable warning dismissed");
    });
  },

  warnNotAuthenticated: function() {
    metrics.track("not-authenticated warning shown");
    var notification = atom.notifications.addWarning(
      "You need to log in to the Kite autocomplete daemon", {
      description: "In order to provide completions the Kite daemon needs to be authenticated (so that it can access the index of your code stored on the cloud).",
      icon: "circle-slash",
      dismissable: true,
      buttons: [{
        text: "Login",
        onDidClick: () => {
          metrics.track("login button clicked (via not-authenticated warning)");
          notification.dismiss();
          this.authenticate();
        }
      }]
    });
    notification.onDidDismiss(() => {
      metrics.track("not-authenticated warning dismissed");
    });
  },

  authenticate: function() {
    metrics.track("authentication started");

    // TODO: show some kind of login UI
    var email = "test@kite.com";
    var password = "123123";

    StateController.authenticateUser(email, password).then(() => {
      metrics.track("authentication succeeded");
      this.ensure();
    }, (err) => {
      metrics.track("authentication failed", err);
      var notification = atom.notifications.addError("Unable to login", {
        description: JSON.stringify(err),
        dismissable: true,
        buttons: [{
          text: "Retry",
          onDidClick: () => {
            metrics.track("retry button clicked (via authentication error)");
            notification.dismiss();
            this.authenticate();
          }
        }]
      });
      notification.onDidDismiss(() => {
        metrics.track("authentication error dismissed");
      });
    });
  },

  warnNotWhitelisted: function(filepath) {
    var dir = path.dirname(filepath);
    metrics.track("not-whitelisted warning shown", {dir: dir});

    var notification = atom.notifications.addWarning(
      "Kite completions are not enabled for "+filepath, {
      description: "Kite only processes files in enabled directories. If you enable Kite then files in this directory will be synced to the Kite backend, where they will be analyzed and indexed.",
      icon: "circle-slash",
      dismissable: true,
      buttons: [{
        text: "Enable Kite for "+dir,
        onDidClick: () => {
          metrics.track("enable button clicked (via not-whitelisted warning)", {dir: dir});
          notification.dismiss();
          this.whitelist(dir);
        }
      }]
    });
    notification.onDidDismiss(() => {
      metrics.track("not-whitelisted warning dismissed", {dir: dir});
    });
  },

  whitelist: function(dirpath) {
    metrics.track("whitelisting started", {dir: dirpath});
    StateController.whitelistPath(dirpath).then(() => {
      metrics.track("whitelisting succeeded", {dir: dirpath});
      this.ensure();
    }, (err) => {
      metrics.track("whitelisting failed", {dir: dirpath});
      var notification = atom.notifications.addError("Unable to enable Kite for "+dirpath, {
        description: JSON.stringify(err),
        dismissable: true,
        buttons: [{
          text: "Retry",
          onDidClick: () => {
            metrics.track("retry clicked (via whitelisting-failed error)", {dir: dirpath});
            notification.dismiss();
            this.whitelist(dirpath);
          }
        }]
      });
      notification.onDidDismiss(() => {
        metrics.track("whitelisting error dismissed");
      });
    });
  },

  notifyReady: function() {
    metrics.track("ready notification shown");
    atom.notifications.addSuccess(
      "The Kite autocomplete daemon is ready", {
      description: "We checked that the daemon is installed, running, responsive, and authenticated.",
      dismissable: true,
    }).onDidDismiss(() => {
      metrics.track("ready notification dismissed");
    });
  }
};

module.exports = Ready;
