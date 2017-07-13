// Quick & easy browser check... chrome uses chrome. object, everything else uses browser.
function getBrowserType() {
	return (BrowserDetect.browser == "Chrome" ? chrome : browser);
}

// https://stackoverflow.com/a/26420284/637173
function patternToRegExp(pattern){
  if(pattern == "<all_urls>") return /^(?:http|https|file|ftp):\/\/.*/;

  var split = /^(\*|http|https|file|ftp):\/\/(.*)$/.exec(pattern);
  if(!split) throw Error("Invalid schema in " + pattern);
  var schema = split[1];
  var fullpath = split[2];

  var split = /^([^\/]*)\/(.*)$/.exec(fullpath);
  if(!split) throw Error("No path specified in " + pattern);
  var host = split[1];
  var path = split[2];

  // File 
  if(schema == "file" && host != "")
    throw Error("Non-empty host for file schema in " + pattern);

  if(schema != "file" && host == "")
    throw Error("No host specified in " + pattern);  

  if(!(/^(\*|\*\.[^*]+|[^*]*)$/.exec(host)))
    throw Error("Illegal wildcard in host in " + pattern);

  var reString = "^";
  reString += (schema == "*") ? "https*" : schema;
  reString += ":\\/\\/";
  // Not overly concerned with intricacies
  //   of domain name restrictions and IDN
  //   as we're not testing domain validity
  reString += host.replace(/\*\.?/, "[^\\/]*");
  reString += "(:\\d+)?";
  reString += "\\/";
  reString += path.replace("*", ".*");
  reString += "$";

  return RegExp(reString);
}

function urlIsBlockedPage(url) {
    return url.startsWith(config.blockURL);
}

function urlIsBlocked(url, isWhitelist, compiledRegexSites) {
    if (url == null) return false;

    var isBlocked = !!isWhitelist;
    for (var compiledRegexSite of compiledRegexSites) {
        if (compiledRegexSite.compiledRegex.test(url)) {
            if (isWhitelist || compiledRegexSite.whitelist) {
                return false;
            }

            isBlocked = true;
        }
    }

    return isBlocked;
}

function getFocusURLFromProxyURL(blockedURL) {
    if (!urlIsBlockedPage(blockedURL)) {
        return null;
    }

    var url = new URL(blockedURL);
    var focusURL = url.searchParams.get("focus_url");
    if (!focusURL) {
        return null;
    }

    return focusURL;
}

function forAllTabs(cb) {
    var vendor = getBrowserType();
    vendor.tabs.query({}, function(tabs) {
        for (var tab of tabs) {
            cb(tab);
        }
    });
}

function reloadBlockedPages() {
    forAllTabs((tab) => {
        if (urlIsBlockedPage(tab.url)) {
            chrome.tabs.reload(tab.id);
        }
    });
}

function reloadShouldBeBlockedPages(isWhitelist, compiledRegexSites) {
    forAllTabs((tab) => {
        if (urlIsBlockedPage(tab.url)) {
            var blockedUrl = getFocusURLFromProxyURL(tab.url);
            if (!urlIsBlocked(blockedUrl, isWhitelist, compiledRegexSites)) {
                chrome.tabs.reload(tab.id);
            }
        } else {
            if (urlIsBlocked(tab.url, isWhitelist, compiledRegexSites)) {
                chrome.tabs.reload(tab.id);
            }
        }
    });
}


function compileRegexSites(rawRegexSites) {
    return rawRegexSites.map((regexSite) => {
        regexSite.compiledRegex = new RegExp(regexSite.regexUrlStr);
        return regexSite;
    });
}