"use strict";
const extensionRootPath = browser.runtime.getURL(".");
browser.experiments.CompatPanelInPanel.install(extensionRootPath);
