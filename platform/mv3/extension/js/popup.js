/*******************************************************************************

    uBlock Origin Lite - a comprehensive, MV3-compliant content blocker
    Copyright (C) 2022-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/* jshint esversion:11 */

'use strict';

/******************************************************************************/

import {
    browser,
    runtime,
    sendMessage,
} from './ext.js';

import { dom } from './dom.js';

/******************************************************************************/

const popupPanelData = {};
const  currentTab = {};
let tabHostname = '';

/******************************************************************************/

function normalizedHostname(hn) {
    return hn.replace(/^www\./, '');
}

/******************************************************************************/

document.querySelector('#dashboard_button').addEventListener('click', (ev) => {
    if ( ev.isTrusted !== true ) { return; }
    if ( ev.button !== 0 ) { return; }
    runtime.openOptionsPage();
})

/******************************************************************************/

const switchButton = document.querySelector('#switch_button');
const switchThumb = document.querySelector('#switch_thumb');
const status = document.querySelector('#status');
const hostname = document.querySelector('#hostname');
const privacyStatus = document.querySelector('#privacy_status');

const switchButtonOn = () => {
    switchButton.setAttribute('data-state', 'checked');
    status.innerHTML = 'Blocking ads';
    privacyStatus.innerHTML = 'Your Internet is <span class="text-accent-500">private</span>';
}
const switchButtonOff = () => {
    switchButton.setAttribute('data-state', 'unchecked');
    status.innerHTML = 'Disabled';
    privacyStatus.innerHTML = 'Your Internet is <span class="text-primary-600">not private</span>';
}

switchButton.addEventListener('click', async () => {
    switchButton.classList.add('transition-colors');
    switchThumb.classList.add('transition-transform');

    const targetHostname = normalizedHostname(tabHostname);
    const afterLevel = switchButton.getAttribute('data-state') === 'checked' ? 0 : 3;
    const beforeLevel = afterLevel ? 0 : 3;
    if (afterLevel === 0) {
        switchButtonOff();
    } else {
        switchButtonOn();
        let granted = false;
        try {
            granted = await browser.permissions.request({
                origins: [ `*://*.${targetHostname}/*` ],
            });
        } catch(ex) {
            console.error(ex);
        }
        if ( granted !== true ) {
            switchButtonOff();
            return;
        }
    }
    const actualLevel = await sendMessage({
        what: 'setFilteringMode',
        hostname: targetHostname,
        level: afterLevel,
    });
    if ( actualLevel !== afterLevel ) {
        if (actualLevel === 0) {
            switchButtonOff();
        } else {
            switchButtonOn();
        }
    }
    if ( actualLevel !== beforeLevel && popupPanelData.autoReload ) {
        browser.tabs.reload(currentTab.id);
    }
})

async function init() {
    const [ tab ] = await browser.tabs.query({
        active: true,
        currentWindow: true,
    });
    if ( tab instanceof Object === false ) { return true; }
    Object.assign(currentTab, tab);

    let url;
    try {
        url = new URL(currentTab.url);
        tabHostname = url.hostname || '';
    } catch(ex) {
    }

    if ( url !== undefined ) {
        const response = await sendMessage({
            what: 'popupPanelData',
            origin: url.origin,
            hostname: normalizedHostname(tabHostname),
        });
        if ( response instanceof Object ) {
            Object.assign(popupPanelData, response);
        }
    }

    hostname.innerHTML = tabHostname;
    if (popupPanelData.level === 0) {
        switchButtonOff();
    } else { 
        switchButtonOn();
    }

    dom.cl.remove(dom.body, 'loading');

    return true;
}

async function tryInit() {
    try {
        await init();
    } catch(ex) {
        console.error(ex);
        setTimeout(tryInit, 100);
    }
}

tryInit();

/******************************************************************************/

