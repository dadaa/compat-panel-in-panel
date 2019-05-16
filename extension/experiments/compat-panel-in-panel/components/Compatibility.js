/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { createRef, PureComponent } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");

const { Cc, Ci } = require("chrome");
const env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
const CompatExperimentsRoot = env.get("COMPAT_EXPERIMENTS_ROOT");
const getCompatData = require(`${ CompatExperimentsRoot }/compat-data`);

class Compatibility extends PureComponent {
  constructor(props) {
    super(props);

    this.ref = createRef();
    this.compatData = getCompatData();

    this.state = {
      issueList: null,
    };
    this.update = this.update.bind(this);
  }

  componentDidMount() {
    const inspector = this.ref.current.ownerGlobal.inspector;

    inspector.on("new-root", this.update);
    inspector.selection.on("new-node-front", this.update);

    this.inspector = inspector;
    this.update();
  }

  getTargetBrowsers() {
    const browsers = this.compatData.browsers;

    const targets = [];
    for (const name of ["firefox", "firefox_android",
                        "chrome", "chrome_android",
                        "safari", "safari_ios",
                        "edge", "edge_mobile"]) {
      const { name: brandName, releases } = browsers[name];

      for (const version in releases) {
        const { status } = releases[version];

        if (status !== "current" && status !== "beta" && status !== "nightly") {
          continue;
        }

        targets.push({ name, brandName, version, status });
      }
    }

    return targets;
  }

  getPropertiesCompatData() {
    return this.compatData.css.properties;
  }

  getUnsupportedBrowsers(compatData, targets) {
    for (let field in compatData) {
      if (field === "__compat") {
        break;
      }

      // We don't have the way to know the context for now.
      // Thus, we choose first context if need.
      if (field.endsWith("_context")) {
        compatData = compatData[field];
      }
    }

    if (!compatData.__compat) {
      return targets;
    }

    const browsers = [];
    for (const target of targets) {
      const version = parseFloat(target.version);
      const supportStates = compatData.__compat.support[target.name] || [];
      let isSupported = false;
      for (const state of Array.isArray(supportStates) ? supportStates : [supportStates]) {
        // Ignore things that have prefix or flags
        if (state.prefix || state.flags) {
          continue;
        }

        const addedVersion = this.asFloatVersion(state.version_added);
        const removedVersion = this.asFloatVersion(state.version_removed);
        if (addedVersion <= version && version < removedVersion) {
          isSupported = true;
          break;
        }
      }

      if (!isSupported) {
        browsers.push(target);
      }
    }

    return browsers;
  }

  asFloatVersion(version = false) {
    if (version === true) {
      return 0;
    }
    return version === false ? Number.MAX_VALUE : parseFloat(version);
  }

  async update() {
    const { inspector } = this;
    if (!inspector.selection.isConnected() ||
        !inspector.selection.isElementNode()) {
      return;
    }

    const node = inspector.selection.nodeFront;
    const layout = await inspector.pageStyle.getLayout(node);

    const targetBrowsers = this.getTargetBrowsers();
    const propertiesCompatData = this.getPropertiesCompatData();
    const issueList = [];
    for (let property in layout) {
      if (property === "from") {
        // This is a reserved word of devtools.
        continue;
      }

      const propertyCompatData = propertiesCompatData[property];
      if (!propertyCompatData) {
        continue;
      }

      const propertyIssues =
        this.getUnsupportedBrowsers(propertyCompatData, targetBrowsers);
      const issue = {
        property,
        propertyIssues,
      };

      if (propertyCompatData) {
        const value = layout[property];
        const valueCompatData = propertyCompatData[value];
        if (valueCompatData) {
          const valueIssues =
            this.getUnsupportedBrowsers(valueCompatData, targetBrowsers);
          issue.value = value;
          issue.valueIssues = valueIssues;
        }
      }

      if (issue.propertyIssues.length || (issue.value && issue.valueIssues.length)) {
        issueList.push(issue);
      }
    }

    this.setState({ issueList });
  }

  renderList(title, browsers) {
    if (!browsers || browsers.length === 0) {
      return [];
    }

    const map = {};
    for (const { brandName, version } of browsers) {
      if (!map[brandName]) {
        map[brandName] = [];
      }
      map[brandName].push(version);
    }

    let browserText = "";
    for (let name in map) {
      const versions = map[name];
      browserText += `${ name } (${ versions.join(", ") }) `;
    }

    return dom.li(
      {},
      dom.label({ style: { fontWeight: 800, marginInlineEnd: "8px" } }, title),
      dom.label({}, `is not supported in ${ browserText }.`),
    );
  }

  renderCompatibility() {
    const { issueList } = this.state;
    if (!issueList) {
      return null;
    }

    if (issueList.length === 0) {
      return "No issues"
    }

    return dom.ul(
      {},
      issueList.map(({ property, propertyIssues, value, valueIssues }) => {
        return [
          this.renderList(`${ property } property`, propertyIssues),
          this.renderList(`${ property }:${ value } value`, valueIssues),
        ];
      })
    );
  }

  render() {
    return (
      dom.div({ ref: this.ref }, this.renderCompatibility())
    );
  }
}

module.exports = Compatibility;
