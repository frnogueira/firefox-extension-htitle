/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("chrome://htitle/content/HTitleTools.jsm");

var HTitle = {
    ENABLED: true,

    windowControlsObservers: [],

    window: null,

    currentMode: null,
    previousState: 0,
    previousChangeTime: 0,

    init: function() {
        HTitleTools.prefs.addObserver("", HTitle, false);

        if (HTitleTools.prefs.getBoolPref("check_gnome_shell") && HTitleTools.checkPresenceGnomeShell() != 0) {
            // Nothing doing if WM is not GNOME Shell.
            HTitle.ENABLED = false;
            return;
        }

        HTitle.window = document.getElementById(HTitleTools.isThunderbird() ? "messengerWindow" : "main-window");

        HTitle.start();

        if (HTitleTools.prefs.getBoolPref("window_controls.get_layout_by_gsettings"))
            HTitle.setWindowControlsLayoutAttribute();

        if (HTitleTools.prefs.getBoolPref("show_window_controls"))
            HTitle.showWindowControls();
    },

    setWindowControlsLayoutAttribute: function() {
        var windowctls = document.getElementById("window-controls");
        if (windowctls) {
            windowctls.setAttribute("htitle-button-layout", HTitleTools.windowControlsLayout);
        }
    },

    showWindowControls: function() {
        var windowctls = document.getElementById("window-controls");
        windowctls.setAttribute("htitle", "true");

        // Appling CSS
        if (HTitle.currentMode == "always")
            HTitleTools.loadStyle("windowControlsAlways");
        else
            HTitleTools.loadStyle("windowControlsAuto");

        if (HTitleTools.isFirefox()) {
            window.addEventListener("sizemodechange", HTitle.updateWindowControlsPosition);

            var targets_map = [
                    ["toolbar-menubar", "autohide"],
                    ["TabsToolbar", "tabsontop"],
                ];
            if (HTitleTools.isAustralisUI()) {
                targets_map.push(["nav-bar", "default-tabs-position"]);
            }
            else {
                targets_map.push(["nav-bar", "collapsed"]);
            }
        }
        else {
            var targets_map = [
                    ["mail-toolbar-menubar2", "autohide"],
                    ["tabs-toolbar", "collapsed"],
                ];
        }

        for (var i = 0; i < targets_map.length; i++) {
            var tempObserver = new MutationObserver(function(mutations) {
                mutations.forEach(HTitle.updateWindowControlsPosition);
            });
            tempObserver.observe(document.getElementById(targets_map[i][0]), { attributes: true, attributeFilter: [targets_map[i][1]] });
            HTitle.windowControlsObservers.push(tempObserver);
        }
        HTitleTools.log("HTitle.windowControlsObservers = " + HTitle.windowControlsObservers.length, "DEBUG");

        HTitle.updateWindowControlsPosition();
    },

    hideWindowControls: function() {
        if (HTitle.currentMode == "always")
            HTitleTools.unloadStyle("windowControlsAlways");
        else
            HTitleTools.unloadStyle("windowControlsAuto");

        var spring = document.getElementById("htitle-menubar-spring");
        if (spring)
            spring.remove();

        var windowctls = document.getElementById("window-controls");
        windowctls.removeAttribute("htitle");
        //windowctls.setAttribute("flex", "1");

        if (HTitleTools.isFirefox()) {
            window.removeEventListener("sizemodechange", HTitle.updateWindowControlsPosition);

            var navbar = document.getElementById("nav-bar");
            HTitleTools.moveWindowControlsTo(windowctls, navbar);
        }

        for (var i = 0; i < HTitle.windowControlsObservers.length; i++) {
            HTitle.windowControlsObservers[i].disconnect();
        }
        HTitle.windowControlsObservers = [];
    },

    updateWindowControlsPosition: function() {
        var windowctls = document.getElementById("window-controls");
        if (!windowctls)
            return;

        if (HTitleTools.isFirefox()) {
            var menubar = document.getElementById("toolbar-menubar");
            var tabsbar = document.getElementById("TabsToolbar");
            var mainbar = document.getElementById("nav-bar");
        }
        else {
            var menubar = document.getElementById("mail-toolbar-menubar2");
            var tabsbar = document.getElementById("tabs-toolbar");
            var mainbar = document.getElementById("mail-bar3");
        }
        if (!menubar || !tabsbar || !mainbar) {
            return;
        }

        /* Get tabsontop value */
        var tabsontop = true; // Default
        if (HTitleTools.isFirefox()) {
            if (tabsbar.getAttribute("tabsontop") === "") {
                tabsontop = mainbar.getAttribute("default-tabs-position") != "bottom";
            }
            else {
                tabsontop = tabsbar.getAttribute("tabsontop") != "false";
            }
        }

        if (menubar.getAttribute("autohide") != "true" && window.windowState != window.STATE_FULLSCREEN) {
            // Moving to the Menu bar
            if (menubar == windowctls.parentNode)
                return;

            var need_spring = true;
            var nodes = menubar.childNodes;
            for (var i = 0; i < nodes.length; i++) {
                if (parseInt(nodes[i].getAttribute("flex"), 10) >= 1) {
                    need_spring = false;
                    break;
                }
            }

            if (need_spring) {
                var spring = document.createElement("toolbarspring");
                spring.setAttribute("id", "htitle-menubar-spring");
                spring.setAttribute("removable", HTitleTools.isAustralisUI() ? "false" : "true");
                spring.setAttribute("flex", "1");
                HTitleTools.addToCurrentset(menubar, "htitle-menubar-spring");
                menubar.appendChild(spring);
            }

            HTitleTools.moveWindowControlsTo(windowctls, menubar);
        }
        else if ((tabsontop && !tabsbar.collapsed) || mainbar.collapsed) {
            // Moving to the Tabs toolbar
            if (tabsbar == windowctls.parentNode)
                return;
            HTitleTools.moveWindowControlsTo(windowctls, tabsbar);
        }
        else {
            // Moving to the Navigation/Mail toolbar
            if (mainbar == windowctls.parentNode)
                return;
            HTitleTools.moveWindowControlsTo(windowctls, mainbar);
        }

        windowctls.removeAttribute("flex");
    },

    start: function() {
        var result = -2;

        if (!HTitleTools.prefs.getBoolPref("legacy_mode.enable")) {
            HTitleTools.log("Start in normal mode", "DEBUG");
            let mode = HTitleTools.prefs.getIntPref("hide_mode") == 2 ? "always" : "auto";
            result = HTitleTools.setWindowProperty(window, mode);
            if (HTitle.currentMode == null && mode == "always" && result == 0) {
                /* FIXME */
                var timeouts = [100, 2*100, 3*100, 4*100, 10*100];
                for (let i = 0; i < timeouts.length; i++) {
                    setTimeout(function(){HTitleTools.setWindowProperty(window, mode);}, timeouts[i]);
                }
            }
        }

        if (result == 0) {
            HTitle.window.setAttribute("hidechrome", false);
            if (HTitleTools.prefs.getIntPref("hide_mode") == 2)
                HTitle.currentMode = "always";
            else {
                HTitle.currentMode = "auto";
                HTitle.window.setAttribute("hidetitlebarwhenmaximized", true);
            }
        }
        else {
            if (result == -1 && !HTitleTools.defaultModeFailed) {
                HTitleTools.defaultModeFailed = true;
                HTitleTools.prefs.setBoolPref("legacy_mode.enable", true);
            }
            HTitleTools.log("Start in legacy mode", "DEBUG");
            HTitleTools.log("TIMEOUT_CHECK = " + HTitleTools.timeoutCheck + "; TIMEOUT_BETWEEN_CHANGES = " + HTitleTools.timeoutBetweenChanges, "DEBUG");
            window.addEventListener("sizemodechange", HTitle.onWindowStateChange);
            HTitle.currentMode = "legacy";

            setTimeout(function(){HTitle.checkWindowState();}, HTitleTools.timeoutCheck);
        }
        HTitle.window.setAttribute("htitlemode", HTitle.currentMode);
    },

    stop: function() {
        if (HTitle.currentMode != "legacy") {
            HTitleTools.removeWindowProperty(window, HTitle.currentMode);
            HTitle.window.removeAttribute("hidetitlebarwhenmaximized");
        }
        else if (HTitle.currentMode == "legacy") {
            window.removeEventListener("sizemodechange", HTitle.onWindowStateChange);
            HTitle.window.setAttribute("hidechrome", false);
        }
        HTitle.currentMode = "stopped";
        HTitle.previousState = 0;
        HTitle.previousChangeTime = 0;
        HTitle.window.setAttribute("htitlemode", HTitle.currentMode);
    },

    observe: function(subject, topic, data) {
        if (topic != "nsPref:changed")
            return;

        switch(data) {
            case "show_window_controls":
                if (HTitleTools.prefs.getBoolPref("show_window_controls")) {
                    HTitleTools.log("Enable show close button", "DEBUG");
                    HTitle.updateWindowControlsPosition(null);
                    HTitle.showWindowControls();
                }
                else {
                    HTitleTools.log("Disable show close button", "DEBUG");
                    HTitle.hideWindowControls();
                }
                break;
            case "legacy_mode.enable":
                if (HTitle.ENABLED && !HTitleTools.defaultModeFailed && HTitle.currentMode != "stopped") {
                    if (HTitleTools.prefs.getBoolPref("show_window_controls"))
                        HTitle.hideWindowControls();

                    HTitle.stop();
                    HTitleTools.prefs.setIntPref("hide_mode", 1);
                    HTitle.start();

                    if (HTitleTools.prefs.getBoolPref("show_window_controls"))
                        HTitle.showWindowControls();
                }
                break;
            case "hide_mode":
                if (HTitle.ENABLED && HTitle.currentMode != "stopped") {
                    if (HTitleTools.prefs.getBoolPref("show_window_controls"))
                        HTitle.hideWindowControls();

                    HTitle.stop();
                    if (HTitleTools.prefs.getIntPref("hide_mode") != 1)
                        HTitleTools.prefs.setBoolPref("legacy_mode.enable", false);
                    HTitle.start();

                    if (HTitleTools.prefs.getBoolPref("show_window_controls"))
                        HTitle.showWindowControls();
                }
                break;
            case "check_gnome_shell":
                if (!HTitle.ENABLED && !HTitleTools.prefs.getBoolPref("check_gnome_shell")) {
                    HTitle.ENABLED = true;
                    HTitle.start();
                }
                else if (HTitle.ENABLED && !HTitleTools.prefs.getBoolPref("check_gnome_shell")) {
                    return;
                }
                else if (HTitleTools.prefs.getBoolPref("check_gnome_shell") && HTitleTools.checkPresenceGnomeShell() != 0 && HTitle.ENABLED) {
                    HTitle.ENABLED = false;
                    HTitle.stop();
                }
                break;
            case "debug":
                HTitleTool.DEBUG = HTitleTools.prefs.getBoolPref("debug");
                break;
            case "legacy_mode.timeout_check":
                HTitleTools.timeoutCheck = HTitleTools.prefs.getIntPref("legacy_mode.timeout_check");
                break;
            case "legacy_mode.timeout_between_changes":
                HTitleTools.timeoutBetweenChanges = HTitleTools.prefs.getIntPref("legacy_mode.timeout_between_changes");
                break;
        }
    },

    onWindowStateChange: function(e) {
        if (HTitle.previousState == window.windowState || window.windowState == window.STATE_FULLSCREEN || window.windowState == window.STATE_MINIMIZED) {
            return;
        }

        if ((Date.now() - HTitle.previousChangeTime) < HTitleTools.timeoutBetweenChanges) {
            if (window.windowState == window.STATE_NORMAL && HTitle.window.getAttribute("hidechrome"))
                 window.maximize();
            return;
        }

        HTitle.logWindowState("onWindowStateChange");

        HTitle.window.setAttribute("hidechrome", (window.windowState == window.STATE_MAXIMIZED));

        HTitle.previousState = window.windowState;
        HTitle.previousChangeTime = Date.now();
    },

    onClickTitlebar: function(e, window) {
        var e = e || window.event;
        if ("object" !== typeof e) {
            return;
        }
        var targets = ["window-controls", "minimize-button", "restore-button", "close-button"];
        if (targets.indexOf(e.target.id) != -1) {
            switch(e.button) {
                case 1:
                    switch(HTitleTools.titlebarActions.middle) {
                        case "lower":
                            HTitleTools.lowerWindow(window);
                            break;
                        case "minimize":
                            window.minimize();
                            break;
                    }
                    break;
            }
        }
        HTitleTools.log("Detected click under #" + e.target.id, "DEBUG");
    },

    checkWindowState: function() {
        if (window.windowState == window.STATE_NORMAL) {
            HTitle.logWindowState("checkWindowState");
            HTitle.window.setAttribute("hidechrome", false);
            HTitle.previousState = window.STATE_NORMAL;
            HTitle.previousChangeTime = Date.now();
        }
        else if (window.windowState == window.STATE_MAXIMIZED) {
            HTitle.logWindowState("checkWindowState");
            HTitle.window.setAttribute("hidechrome", true);
            HTitle.previousState = window.STATE_MAXIMIZED;
            HTitle.previousChangeTime = Date.now();
        }
    },

    logWindowState: function(from) {
        if (HTitle.DEBUG == false)
            return

        switch (window.windowState) {
            case window.STATE_MAXIMIZED:   var windowState = "maximized"; break;
            case window.STATE_NORMAL:      var windowState = "normal"; break;
            case window.STATE_FULLSCREEN:  var windowState = "fullscreen"; break;
            default: var windowState = window.windowState.toString();
        }

        HTitleTools.log("Action = " + from + "; windowState = " + windowState + ";  hidechrome = " + HTitle.window.getAttribute("hidechrome"), "DEBUG");
    },

    shutdown: function() {
        HTitleTools.prefs.removeObserver("", HTitle);
        //if (HTitleTools.prefs.getBoolPref("show_window_controls"))
        //    HTitle.hideWindowControls();
    },
}

window.addEventListener("load",   HTitle.init);
window.addEventListener("unload", HTitle.shutdown);
