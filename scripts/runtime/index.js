import * as theme from './theme-state.js';
import * as consent from './consent-state.js';
import * as navigation from './navigation.js';
import * as http from './http.js';
import * as storage from './storage.js';
import * as dom from './dom.js';
import * as analytics from './analytics.js';
import { embeds, loadScript } from './third-party.js';

export { theme, consent, navigation, http, storage, dom, analytics, embeds, loadScript };
globalThis.F1SRuntime = Object.freeze({ theme, consent, navigation, http, storage, dom, analytics, embeds, loadScript });
