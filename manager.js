// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

if (!chrome.cookies) {
  chrome.cookies = chrome.experimental.cookies;
}

// A simple Timer class.
function Timer() {
  this.start_ = new Date();

  this.elapsed = function() {
    return (new Date()) - this.start_;
  }

  this.reset = function() {
    this.start_ = new Date();
  }
}

// Compares cookies for "key" (name, domain, etc.) equality, but not "value"
// equality.
function cookieMatch(c1, c2) {
  return (c1.name == c2.name) && (c1.domain == c2.domain) &&
         (c1.hostOnly == c2.hostOnly) && (c1.path == c2.path) &&
         (c1.secure == c2.secure) && (c1.httpOnly == c2.httpOnly) &&
         (c1.session == c2.session) && (c1.storeId == c2.storeId);
}

// Returns an array of sorted keys from an associative array.
function sortedKeys(array) {
  var keys = [];
  for (var i in array) {
    keys.push(i);
  }
  keys.sort();
  return keys;
}

// Shorthand for document.querySelector.
function select(selector) {
  return document.querySelector(selector);
}

// An object used for caching data about the browser's cookies, which we update
// as notifications come in.
function CookieCache() {
  this.cookies_ = {};
  this.domains_ = {};

  this.reset = function() {
    this.cookies_ = {};
  }

  this.add = function(cookie) {
    var domain = cookie.domain;
    if (!this.cookies_[domain]) {
      this.cookies_[domain] = [];
    }
    this.cookies_[domain].push(cookie);

    if (!this.domains_[domain]) {
      this.domains_[domain] = {};
    }
    if(cookie.name.includes('visitor_id')){
      this.domains_[domain].pardot = true;
    } else if(cookie.name.includes('_mkto_trk')){
      this.domains_[domain].marketo = true;
    } else if(cookie.name.includes('AMCV_')){
      this.domains_[domain].adobe = true;
    } else if(cookie.name.includes('hubspotutk')){
      this.domains_[domain].hubspot = true;
    } else if(cookie.name.includes('ELOQUA')){
      this.domains_[domain].eloqua = true;
    }
  };

  this.remove = function(cookie) {
    var domain = cookie.domain;
    if (this.cookies_[domain]) {
      var i = 0;
      while (i < this.cookies_[domain].length) {
        if (cookieMatch(this.cookies_[domain][i], cookie)) {
          this.cookies_[domain].splice(i, 1);
        } else {
          i++;
        }
      }
      if (this.cookies_[domain].length == 0) {
        delete this.cookies_[domain];
      }
    }
  };

  // Returns a sorted list of cookie domains that match |filter|. If |filter| is
  //  null, returns all domains.
  this.getDomains = function(filter) {
    var result = [];
    sortedKeys(this.cookies_).forEach(function(domain) {
      if (!filter || domain.indexOf(filter) != -1) {
        result.push(domain);
      }
    });
    return result;
  }

  this.getCookies = function(domain) {
    return this.cookies_[domain];
  };
  this.getTT = function(domain) {
    return this.domains_[domain];
  };
}


var cache = new CookieCache();


function removeAllForFilter() {
  var filter = select("#filter").value;
  var timer = new Timer();
  cache.getDomains(filter).forEach(function(domain) {
    removeCookiesForDomain(domain);
  });
}


function removeCookie(cookie) {
  var url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain +
            cookie.path;
  chrome.cookies.remove({"url": url, "name": cookie.name});
}

function removeCookiesForDomain(domain) {
  var timer = new Timer();
  cache.getCookies(domain).forEach(function(cookie) {
    removeCookie(cookie);
  });
}

function resetTable() {
  var table = select("#cookies");
  while (table.rows.length > 1) {
    table.deleteRow(table.rows.length - 1);
  }
}

var reload_scheduled = false;

function scheduleReloadCookieTable() {
  if (!reload_scheduled) {
    reload_scheduled = true;
    setTimeout(c, 250);
  }
}

function reloadCookieTable() {
  reload_scheduled = false;

  var filter = select("#filter").value;

  var domains = cache.getDomains(filter);

  select("#filter_count").innerText = domains.length;
  select("#total_count").innerText = cache.getDomains().length;

  select("#delete_all_button").innerHTML = "";
  if (domains.length) {
    var button = document.createElement("button");
    button.onclick = removeAllForFilter;
    button.innerText = "delete all " + domains.length;
    select("#delete_all_button").appendChild(button);
  }

  resetTable();
  var table = select("#cookies");

  domains.forEach(function(domain) {
    var cookies = cache.getCookies(domain);
    var TT = cache.getTT(domain);
    
    var row = table.insertRow(-1);
    row.insertCell(-1).innerText = domain;
    
    var cell = row.insertCell(-1);
    cell.innerText = TT.pardot || false;
    cell.setAttribute("class", "cookie_count cookie_"+(TT.pardot || false));

    var cell = row.insertCell(-1);
    cell.innerText = TT.marketo || false;
    cell.setAttribute("class", "cookie_count cookie_"+(TT.marketo || false));

    var cell = row.insertCell(-1);
    cell.innerText = TT.adobe || false;
    cell.setAttribute("class", "cookie_count cookie_"+(TT.adobe || false));

    var cell = row.insertCell(-1);
    cell.innerText = TT.hubspot || false;
    cell.setAttribute("class", "cookie_count cookie_"+(TT.hubspot || false));

    var cell = row.insertCell(-1);
    cell.innerText = TT.eloqua || false;
    cell.setAttribute("class", "cookie_count cookie_"+(TT.eloqua || false));

    var button = document.createElement("button");
    button.innerText = "delete";
    button.onclick = (function(dom){
      return function() {
        removeCookiesForDomain(dom);
      };
    }(domain));
    var cell = row.insertCell(-1);
    cell.appendChild(button);
    cell.setAttribute("class", "button");
  });
}

function focusFilter() {
  select("#filter").focus();
}

function resetFilter() {
  var filter = select("#filter");
  filter.focus();
  if (filter.value.length > 0) {
    filter.value = "";
    reloadCookieTable();
  }
}

var ESCAPE_KEY = 27;
window.onkeydown = function(event) {
  if (event.keyCode == ESCAPE_KEY) {
    resetFilter();
  }
}

function listener(info) {
  // scheduleReloadCookieTable();
}

function startListening() {
  chrome.cookies.onChanged.addListener(listener);
}

function stopListening() {
  chrome.cookies.onChanged.removeListener(listener);
}

function onload() {
  focusFilter();
  var timer = new Timer();
  var allowedTracker = ['visitor_id','_mkto_trk','AMCV_','hubspotutk','ELOQUA']
  chrome.cookies.getAll({}, function(cookies) {
    startListening();
    start = new Date();
    for (var i in cookies) {
      let isAllowed = false;
      for(var j in allowedTracker){
        if(cookies[i].name.includes(allowedTracker[j])){
          isAllowed = true;
        }
      }
      if(isAllowed){
        cache.add(cookies[i]);
      }
    }
    timer.reset();
    reloadCookieTable();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  onload();
  document.body.addEventListener('click', focusFilter);
  document.querySelector('#filter_div input').addEventListener(
      'input', reloadCookieTable);
  document.querySelector('#filter_div button').addEventListener(
      'click', resetFilter);
});
