"use strict";

this.CompatPanelInPanel = class extends ExtensionAPI {
  _install(extensionRootPath) {
    const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
    const { Services } = Cu.import("resource://gre/modules/Services.jsm");
    const { require } = Cu.import("resource://devtools/shared/Loader.jsm");

    const experimentRootPath =
      `${extensionRootPath}/experiments/compat-panel-in-panel/`;
    const env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    env.set("COMPAT_EXPERIMENTS_ROOT", experimentRootPath);

    // To use mechanism of mock
	  Services.prefs.setBoolPref("devtools.testing", true);
    const { removeMockedModule, setMockedModule } =
      require("devtools/client/shared/browser-loader-mocks");

    const component = require(`${ experimentRootPath }/components/LayoutApp`);
    const componentURI = "devtools/client/inspector/layout/components/LayoutApp";
    setMockedModule(component, componentURI);

    // Cleanup
    this.extension.once("shutdown", () => {
	    Services.prefs.clearUserPref("devtools.testing");
      removeMockedModule(componentURI);
      env.set("COMPAT_EXPERIMENTS_ROOT", "");
    });
  }

  getAPI() {
    const extension = this;

    return {
      experiments: {
        CompatPanelInPanel: {
          install(extensionRootPath) {
            extension._install(extensionRootPath);
          },
        },
      },
    };
  }
}
