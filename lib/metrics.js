var os = require('os');
const mixpanel = require('mixpanel');
const crypto = require('crypto');
const kitePkg = require('../package.json');
const localconfig = require('./localconfig.js');

const MIXPANEL_TOKEN = '2ab52cc896c9c74a7452d65f00e4f938';

const OS_VERSION = os.type() + ' ' + os.release();

const client = mixpanel.init(MIXPANEL_TOKEN, {
  protocol: 'https',
});

// Generate a unique ID for this user and save it for future use.
function distinctID() {
  var id = localconfig.get('distinctID');
  if (id === undefined) {
    // use the atom UUID
    id = atom.config.get('exception-reporting.userId', crypto.randomBytes(32).toString('hex'));
    localconfig.set('distinctID', id);
  }
  return id;
}

// Send an event to mixpanel
function track(eventName, properties) {
  if (properties === undefined) {
    console.log(`event: ${ eventName }`)
  } else {
    console.log(`event: ${ eventName }`, properties)
  }
  eventData = {
    distinct_id: distinctID(),
    atom_version: atom.getVersion(),
    kite_plugin_version: kitePkg.version,
    os: OS_VERSION,
  };
  for (var key in properties || {}) {
    eventData[key] = properties[key];
  }
  client.track(eventName, properties);
}

module.exports = {
  track: track,
};
