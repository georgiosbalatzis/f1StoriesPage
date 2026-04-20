// Driver headshot catalog + lookup helpers shared across every standings
// render path. The headshot cache is module-scoped so repeated calls with
// the same key collapse to a single allocation without leaking across
// sessions.

import { esc } from './format.js';

export const DRIVER_HEADSHOTS = {
    'max_verstappen':  'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png',
    'hamilton':        'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png',
    'leclerc':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/1col/image.png',
    'norris':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png',
    'russell':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png',
    'piastri':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png',
    'sainz':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/1col/image.png',
    'alonso':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/1col/image.png',
    'stroll':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/1col/image.png',
    'gasly':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png',
    'ocon':            'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/1col/image.png',
    'hulkenberg':      'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
    'nico_hulkenberg': 'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
    'tsunoda':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png',
    'albon':           'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png',
    'bearman':         'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png',
    'hadjar':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png',
    'antonelli':       'https://media.formula1.com/image/upload/c_lfill,w_80/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
    'bortoleto':       'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
    'gabriel_bortoleto': 'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
    'lawson':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png',
    'doohan':          'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/J/JACDOO01_Jack_Doohan/jacdoo01.png.transform/1col/image.png',
    'colapinto':       'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/1col/image.png',
    'bottas':          'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
    'valtteri_bottas': 'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
    'perez':           'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
    'sergio_perez':    'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
    'lindblad':        'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    'arvid_lindblad':  'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    'lidblad':         'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
    'arvid_lidblad':   'https://media.formula1.com/image/upload/c_fill,w_80/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp'
};

export const DRIVER_HEADSHOT_POSITIONS = {
    'antonelli': 'center top',
    'andrea_kimi_antonelli': 'center top',
    'kimi_antonelli': 'center top',
    'perez': 'center top',
    'sergio_perez': 'center top',
    'bottas': 'center top',
    'valtteri_bottas': 'center top',
    'hulkenberg': 'center top',
    'nico_hulkenberg': 'center top',
    'bortoleto': 'center top',
    'gabriel_bortoleto': 'center top',
    'lindblad': 'center top',
    'arvid_lindblad': 'center top',
    'lidblad': 'center top',
    'arvid_lidblad': 'center top'
};

export const PREFER_LOCAL_HEADSHOT = {
    'antonelli': true,
    'andrea_kimi_antonelli': true,
    'kimi_antonelli': true,
    'perez': true,
    'sergio_perez': true,
    'bottas': true,
    'valtteri_bottas': true,
    'hulkenberg': true,
    'nico_hulkenberg': true,
    'bortoleto': true,
    'gabriel_bortoleto': true,
    'lindblad': true,
    'arvid_lindblad': true,
    'lidblad': true,
    'arvid_lidblad': true
};

export function normalizeDriverLookupKey(value) {
    let normalized = String(value || '').trim().toLowerCase();
    if (normalized.normalize) normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function getDriverLookupCandidates(driverId, fallbackName) {
    const candidates = [];
    function pushCandidate(value) {
        if (value && candidates.indexOf(value) === -1) candidates.push(value);
    }

    pushCandidate(normalizeDriverLookupKey(driverId));

    const normalizedName = normalizeDriverLookupKey(fallbackName);
    if (normalizedName) {
        pushCandidate(normalizedName);
        const nameParts = normalizedName.split('_').filter(Boolean);
        if (nameParts.length) {
            pushCandidate(nameParts[nameParts.length - 1]);
            if (nameParts.length >= 2) pushCandidate(nameParts.slice(-2).join('_'));
        }
    }

    return candidates;
}

export function normalizeHeadshotUrl(url) {
    return String(url || '').replace(/([,_])w_\d+/g, '$1w_80');
}

export function getHeadshot(driverId, fallbackName) {
    const candidates = getDriverLookupCandidates(driverId, fallbackName);
    for (let i = 0; i < candidates.length; i++) {
        if (DRIVER_HEADSHOTS[candidates[i]]) return normalizeHeadshotUrl(DRIVER_HEADSHOTS[candidates[i]]);
    }
    return '';
}

export function shouldPreferLocalHeadshot(driverId, fallbackName) {
    const candidates = getDriverLookupCandidates(driverId, fallbackName);
    for (let i = 0; i < candidates.length; i++) {
        if (PREFER_LOCAL_HEADSHOT[candidates[i]]) return true;
    }
    return false;
}

export function getPreferredHeadshot(driverId, fallbackName, sourceHeadshot) {
    const localHeadshot = getHeadshot(driverId, fallbackName);
    if (localHeadshot && shouldPreferLocalHeadshot(driverId, fallbackName)) return localHeadshot;
    return normalizeHeadshotUrl(sourceHeadshot || localHeadshot || '');
}

export function getHeadshotObjectPosition(driverId, fallbackName) {
    const candidates = getDriverLookupCandidates(driverId, fallbackName);
    for (let i = 0; i < candidates.length; i++) {
        if (DRIVER_HEADSHOT_POSITIONS[candidates[i]]) return DRIVER_HEADSHOT_POSITIONS[candidates[i]];
    }
    return '';
}

export function getHeadshotImgStyle(driverId, fallbackName) {
    const position = getHeadshotObjectPosition(driverId, fallbackName);
    return position ? ' style="object-position:' + esc(position) + ';"' : '';
}

const headshotResultCache = {};

export function getCachedHeadshotResult(driverId, fallbackName, sourceHeadshot) {
    const key = (driverId || '') + '|' + (fallbackName || '') + '|' + normalizeHeadshotUrl(sourceHeadshot || '');
    if (!headshotResultCache[key]) {
        headshotResultCache[key] = {
            url: getPreferredHeadshot(driverId, fallbackName, sourceHeadshot),
            style: getHeadshotImgStyle(driverId, fallbackName)
        };
    }
    return headshotResultCache[key];
}
