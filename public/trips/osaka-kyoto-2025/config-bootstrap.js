// Parses shared-backend config carried in the link hash (#s=base64json)
// and persists it locally so the plain URL keeps working afterwards.
// Sets window.TRIP_SHARED = { url, key, trip } or null.
(function () {
  "use strict";

  var SAVE_KEY = "fk18-shared-cfg";

  function fromBase64(b64) {
    var std = b64.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(
      atob(std)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
  }

  function parse() {
    try {
      var h = window.location.hash || "";
      var m = h.match(/[#&]s=([^&]+)/);
      if (m) {
        var cfg = JSON.parse(fromBase64(m[1]));
        if (cfg && cfg.url && cfg.key) {
          cfg.trip = cfg.trip || "osaka-kyoto-2026";
          localStorage.setItem(SAVE_KEY, JSON.stringify(cfg));
          return cfg;
        }
      }
    } catch (e) {
      /* ignore malformed hash */
    }
    try {
      var saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        var c = JSON.parse(saved);
        if (c && c.url && c.key) {
          c.trip = c.trip || "osaka-kyoto-2026";
          return c;
        }
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  window.TRIP_SHARED = parse();
})();
