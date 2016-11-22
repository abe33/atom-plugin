const os = require('os');
const path = require('path');
const StateController = require('kite-installer').StateController;

const utils = require('./utils.js');
const metrics = require('./metrics.js');
const Login = require('./elements/login.js');

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
  shouldNotify: function(state, forceNotify=false) {
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
  ensure: function(forceNotify=false) {
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
          // for now, ignore this
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
      "OS not supported", {
      description: "Sorry, Kite only supports macOS at the moment.",
      icon: "circle-slash",
      dismissable: true,
    }).onDidDismiss(() => {
      metrics.track("not-supported warning dismissed");
    });
  },

  warnNotInstalled: function() {
    metrics.track("not-installed warning shown");
    var notification = atom.notifications.addWarning(
      "Kite app missing", {
      description: "Install the Kite app to get next-generation completions, documentation, and more.",
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
  },

  warnNotRunning: function() {
    metrics.track("not-running warning shown");
    var notification = atom.notifications.addWarning(
      "Kite not running", {
      description: "Start the Kite app to get Python completions and docs.",
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
    StateController.runKiteAndWait().then(() => {
      metrics.track("launch succeeded");
      this.ensure();
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

  // this situation is currently ignored, so this function is never called
  warnNotReachable: function() {
    metrics.track("not-reachable warning shown");
    atom.notifications.addError(
      "The Kite Menubar app is running but not reachable", {
      description: "Try killing Kite from the Activity Monitor.",
      dismissable: true,
    }).onDidDismiss(() => {
      metrics.track("not-reachable warning dismissed");
    });
  },

  warnNotAuthenticated: function() {
    metrics.track("not-authenticated warning shown");
    var notification = atom.notifications.addWarning(
      "Kite not logged in", {
      description: "Kite needs to be authenticated, so that it can access the index of your code stored on the cloud.",
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
    var login = new Login();
    var panel = atom.workspace.addTopPanel({item: login.element});

    login.onCancel(() => {
      panel.destroy();
      login.destroy();
      metrics.track("cancel clicked in login panel");
    });
    login.onSubmit(() => {
      var email = login.email;
      var password = login.password;
      panel.destroy();
      login.destroy();
      metrics.track("submit clicked in login panel", {email: email});

      metrics.track("authentication started", {email: email});
      StateController.authenticateUser(email, password).then(() => {
        metrics.track("authentication succeeded", {email: email});
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
    });
  },

  warnNotWhitelisted: function(filepath) {
    var dir = path.dirname(filepath);
    metrics.track("not-whitelisted warning shown", {dir: dir});

    var notification = atom.notifications.addWarning(
      "Kite is disabled for "+path.basename(filepath), {
      description: "Would you like to enable Kite for Python files in "+dir+"?",
      icon: "circle-slash",
      dismissable: true,
      buttons: [{
        text: "Enable",
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
      "The Kite Menubar app is ready", {
      description: "We checked that the Menubar app is installed, running, responsive, and authenticated.",
      dismissable: true,
    }).onDidDismiss(() => {
      metrics.track("ready notification dismissed");
    });
  }
};

module.exports = Ready;
