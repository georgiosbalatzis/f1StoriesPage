const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { XMLParser, XMLValidator } = require('fast-xml-parser');

const PANEL_IDS = new Set(['telemetry-speed-trace', 'telemetry-throttle-brake']);
const IMAGE_KEYS = ['narrowLight', 'wideLight', 'narrowDark', 'wideDark'];
const SVG_TAGS = new Set(['svg', 'style', 'rect', 'g', 'path', 'line', 'text', 'tspan', 'title', 'desc', 'defs', 'clipPath']);
const SVG_ATTRS = new Set([
    'xmlns', 'width', 'height', 'viewBox', 'fill', 'color', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-opacity', 'fill-opacity', 'd',
    'fill-rule', 'clip-path', 'class', 'id', 'font-size', 'font-family', 'font-variant-numeric',
    'transform', 'opacity', 'rx', 'cx', 'cy', 'r', 'text-anchor', 'shape-rendering', 'vector-effect', 'style', 'orientation', 'name', 'dx', 'dy', 'offset'
]);
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', processEntities: false, allowBooleanAttributes: false });

function fail(file, reason) {
    const error = new Error(`Invalid telemetry publication ${file}: ${reason}`);
    error.code = 'TELEMETRY_FIGURE';
    throw error;
}

function object(value, keys, file, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail(file, `${field} has invalid fields`);
    return value;
}

function assertText(value, max, file, field, empty = false) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(file, `${field} is invalid`);
}

function assertInt(value, min, max, file, field) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(file, `${field} is invalid`);
}

function validateBundle(bundle, file) {
    object(bundle, ['schemaVersion', 'panelId', 'capturedAt', 'scope', 'context', 'editorial', 'provenance', 'data', 'images'], file, 'bundle');
    if (bundle.schemaVersion !== 1 || !PANEL_IDS.has(bundle.panelId)) fail(file, 'unsupported schema version or panel');
    if (typeof bundle.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(bundle.capturedAt) || new Date(bundle.capturedAt).toISOString() !== bundle.capturedAt) fail(file, 'capturedAt is invalid');
    const scope = object(bundle.scope, ['year', 'circuit', 'sessionKey', 'driverNums', 'lapNum', 'tab'], file, 'scope');
    assertInt(scope.year, 2023, 2100, file, 'scope.year');
    assertText(scope.circuit, 80, file, 'scope.circuit');
    if (!/^[A-Za-z0-9 ._'-]+$/.test(scope.circuit)) fail(file, 'scope.circuit is invalid');
    assertInt(scope.sessionKey, 1, Number.MAX_SAFE_INTEGER, file, 'scope.sessionKey');
    assertInt(scope.lapNum, 1, 200, file, 'scope.lapNum');
    if (scope.tab !== 'telemetry' || !Array.isArray(scope.driverNums) || scope.driverNums.length < 1 || scope.driverNums.length > 4) fail(file, 'scope does not resolve to a telemetry figure');
    scope.driverNums.forEach(n => assertInt(n, 1, 99, file, 'scope.driverNums'));
    if (new Set(scope.driverNums).size !== scope.driverNums.length) fail(file, 'scope.driverNums contains duplicates');
    const context = object(bundle.context, ['grandPrix', 'session'], file, 'context');
    assertText(context.grandPrix, 160, file, 'context.grandPrix');
    assertText(context.session, 100, file, 'context.session');
    const editorial = object(bundle.editorial, ['title', 'caption', 'description'], file, 'editorial');
    assertText(editorial.title, 160, file, 'editorial.title');
    assertText(editorial.caption, 2000, file, 'editorial.caption', true);
    assertText(editorial.description, 2000, file, 'editorial.description');
    const data = object(bundle.data, ['kind', 'axis', 'drivers', 'points', 'guides'], file, 'data');
    const kind = bundle.panelId === 'telemetry-speed-trace' ? 'speed' : 'pedals';
    if (data.kind !== kind || !['progress', 'sample'].includes(data.axis) || !Array.isArray(data.drivers) || data.drivers.length !== scope.driverNums.length) fail(file, 'panel and plot data do not match');
    data.drivers.forEach((driver, index) => {
        object(driver, ['number', 'fullName', 'acronym', 'teamColour', 'lineDash', 'brakeDash'], file, 'data.drivers');
        if (driver.number !== scope.driverNums[index]) fail(file, 'driver order differs from scope');
        assertText(driver.fullName, 100, file, 'driver.fullName'); assertText(driver.acronym, 12, file, 'driver.acronym');
        if (typeof driver.teamColour !== 'string' || !/^#[a-f\d]{6}$/i.test(driver.teamColour)) fail(file, 'driver colour is invalid');
        for (const key of ['lineDash', 'brakeDash']) if (driver[key] !== undefined && (typeof driver[key] !== 'string' || driver[key].length > 40 || !/^\d+(?: \d+)*$/.test(driver[key]))) fail(file, `driver.${key} is invalid`);
    });
    const provenance = object(bundle.provenance, ['source', 'method', 'guideExplanation', 'partialAcknowledged', 'drivers'], file, 'provenance');
    if (provenance.source !== 'OpenF1' || typeof provenance.partialAcknowledged !== 'boolean' || !Array.isArray(provenance.drivers) || provenance.drivers.length !== data.drivers.length) fail(file, 'provenance is invalid');
    assertText(provenance.method, 500, file, 'provenance.method'); assertText(provenance.guideExplanation, 500, file, 'provenance.guideExplanation', true);
    const statuses = provenance.drivers.map((driver, index) => {
        object(driver, ['driverNumber', 'status', 'sampleCount'], file, 'provenance.drivers');
        if (driver.driverNumber !== data.drivers[index].number || !['complete', 'missing'].includes(driver.status)) fail(file, 'driver provenance order/status is invalid');
        assertInt(driver.sampleCount, 0, 100000, file, 'provenance.sampleCount');
        if ((driver.status === 'missing') !== (driver.sampleCount === 0)) fail(file, 'driver provenance count is inconsistent');
        return driver.status;
    });
    if (statuses.includes('missing') && !provenance.partialAcknowledged) fail(file, 'partial data lacks author acknowledgement');
    if (!Array.isArray(data.points) || data.points.length < 2 || data.points.length > 4096) fail(file, 'data.points count is invalid');
    const channels = kind === 'speed' ? ['speed'] : ['throttle', 'brake'];
    const x = data.axis === 'progress' ? 'progress' : 'idx';
    const allowedKeys = new Set([x, ...(data.axis === 'progress' ? channels.flatMap(channel => data.drivers.map(driver => `${channel}_${driver.number}`)) : channels)]);
    const observed = new Set(); let previous = -1;
    data.points.forEach(point => {
        object(point, [...allowedKeys], file, 'data.points');
        if (typeof point[x] !== 'number' || !Number.isFinite(point[x]) || point[x] < previous || point[x] < 0 || point[x] > (data.axis === 'progress' ? 100 : 100000)) fail(file, `data.points.${x} is invalid`);
        if (data.axis === 'sample' && !Number.isSafeInteger(point[x])) fail(file, 'sample axis values must be integers');
        previous = point[x];
        for (const key of allowedKeys) if (key !== x && point[key] !== null && point[key] !== undefined) {
            const max = kind === 'speed' ? 600 : 105; const min = key.startsWith('brake') ? -105 : 0;
            if (typeof point[key] !== 'number' || !Number.isFinite(point[key]) || point[key] < min || point[key] > max) fail(file, `data.points.${key} is invalid`);
            observed.add(key);
        }
    });
    if (!observed.size) fail(file, 'figure has no plotted data');
    data.drivers.forEach((driver, index) => {
        const hasData = channels.some(channel => observed.has(data.axis === 'sample' ? channel : `${channel}_${driver.number}`));
        if (data.axis === 'sample' && index > 0 && statuses[index] === 'complete') fail(file, 'sample axis cannot claim secondary drivers');
        if ((statuses[index] === 'complete') !== (data.axis === 'sample' && index > 0 ? false : hasData)) fail(file, 'data completeness does not match provenance');
    });
    if (!Array.isArray(data.guides) || data.guides.length > 100 || (data.axis === 'sample' && data.guides.length)) fail(file, 'guide data is invalid');
    data.guides.forEach(guide => {
        object(guide, ['progress', 'label'], file, 'data.guides');
        if (typeof guide.progress !== 'number' || !Number.isFinite(guide.progress) || guide.progress < 0 || guide.progress > 100) fail(file, 'guide position is invalid');
        assertText(guide.label, 40, file, 'guide.label');
    });
    if (data.guides.length && !provenance.guideExplanation.trim()) fail(file, 'guide explanation is missing');
    object(bundle.images, IMAGE_KEYS, file, 'images');
    for (const key of IMAGE_KEYS) {
        const image = object(bundle.images[key], ['svg', 'width', 'height'], file, `images.${key}`);
        assertInt(image.width, 1, 4096, file, `images.${key}.width`); assertInt(image.height, 1, 4096, file, `images.${key}.height`);
        if (typeof image.svg !== 'string' || Buffer.byteLength(image.svg) > 1024 * 1024 || Buffer.byteLength(image.svg) < 5) fail(file, `images.${key}.svg size is invalid`);
        validateSvg(image.svg, image.width, image.height, file, key);
    }
    if (Buffer.byteLength(JSON.stringify(bundle)) > 5 * 1024 * 1024) fail(file, 'bundle exceeds 5 MiB');
}

function validateSvg(svg, width, height, file, variant) {
    if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|@import|url\s*\(\s*(?!#)/i.test(svg) || /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(svg)) fail(file, `${variant} contains a forbidden XML declaration, entity or external resource`);
    const validity = XMLValidator.validate(svg, { allowBooleanAttributes: false });
    if (validity !== true) fail(file, `${variant} is not valid SVG XML`);
    let parsed;
    try { parsed = parser.parse(svg); } catch (_) { fail(file, `${variant} could not be parsed as SVG XML`); }
    const ids = new Set(); const references = [];
    const visit = nodes => nodes.forEach(node => {
        if (!node || typeof node !== 'object') return;
        const names = Object.keys(node).filter(key => !key.startsWith(':') && key !== '#text');
        for (const name of names) {
            if (!SVG_TAGS.has(name)) fail(file, `${variant} uses forbidden SVG element <${name}>`);
            const parts = node[name]; const attrs = node[':@'] || {};
            for (const [attr, value] of Object.entries(attrs)) {
                if (!SVG_ATTRS.has(attr) || /^on/i.test(attr)) fail(file, `${variant} uses forbidden SVG attribute ${attr}`);
                if (typeof value !== 'string' || (attr !== 'xmlns' && /(?:javascript:|data:|https?:|\/\/|@import)/i.test(value))) fail(file, `${variant} contains an external SVG reference`);
                if (attr === 'style' && value !== 'width: 100%; height: 100%;') fail(file, `${variant} contains unapproved inline SVG style`);
                if (attr === 'offset' && !/^\d+(?:\.\d+)?%?$/.test(value)) fail(file, `${variant} contains an invalid SVG offset`);
                if (attr === 'id') { if (ids.has(value)) fail(file, `${variant} has duplicate SVG identifiers`); ids.add(value); }
                if (value.includes('url(')) { const match = /^url\(#([A-Za-z_][\w:.-]*)\)$/.exec(value); if (!match) fail(file, `${variant} has a non-local SVG reference`); references.push(match[1]); }
            }
            if (name === 'style') {
                const css = (parts || []).map(part => part['#text'] || '').join('').trim();
                if (!/^\.recharts-text\{font-family:Arial,\s*'DejaVu Sans',\s*sans-serif;font-variant-numeric:tabular-nums\}\.recharts-cartesian-grid line,\.recharts-cartesian-axis-line,\.recharts-cartesian-axis-tick-line\{stroke:#[a-f\d]{6}\}$/i.test(css)) fail(file, `${variant} contains unapproved SVG CSS`);
            }
            visit((parts || []).filter(part => part && typeof part === 'object'));
        }
    });
    visit(parsed);
    references.forEach(id => { if (!ids.has(id)) fail(file, `${variant} references a missing SVG identifier`); });
    const root = parsed[0]?.[':@'];
    if (!root || root.width !== String(width) || root.height !== String(height) || root.xmlns !== 'http://www.w3.org/2000/svg') fail(file, `${variant} SVG dimensions or namespace disagree with bundle`);
    const viewBox = String(root.viewBox || '').split(/[ ,]+/).map(Number);
    if (viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== width || viewBox[3] !== height) fail(file, `${variant} viewBox disagrees with declared dimensions`);
}

function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (!value || typeof value !== 'object') return JSON.stringify(value);
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function resolveBundle(entryPath, basename) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.f1embed\.json$/.test(basename)) fail(String(basename), 'marker must contain a safe .f1embed.json basename');
    const candidates = [path.join(entryPath, basename), path.join(entryPath, 'embeds', basename)];
    const filePath = candidates.find(candidate => fs.existsSync(candidate));
    if (!filePath) fail(basename, `file was not found in ${entryPath} or ${path.join(entryPath, 'embeds')}`);
    const entryReal = fs.realpathSync(entryPath); const fileReal = fs.realpathSync(filePath);
    if (!fileReal.startsWith(`${entryReal}${path.sep}`)) fail(basename, 'file escaped the article folder');
    let bundle;
    try { bundle = JSON.parse(fs.readFileSync(fileReal, 'utf8')); }
    catch (error) { fail(fileReal, `could not parse JSON (${error.message})`); }
    validateBundle(bundle, fileReal);
    return { bundle, filePath: fileReal };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTelemetryFigure(basename, entryPath) {
    const { bundle, filePath } = resolveBundle(entryPath, basename);
    const digest = crypto.createHash('sha256').update(stable(bundle)).digest('hex').slice(0, 20);
    const directory = path.join(entryPath, 'embeds');
    fs.mkdirSync(directory, { recursive: true });
    if (fs.lstatSync(directory).isSymbolicLink() || !fs.realpathSync(directory).startsWith(`${fs.realpathSync(entryPath)}${path.sep}`)) fail(filePath, 'asset directory must remain inside the article folder');
    const entryName = path.basename(entryPath);
    const assetBase = `/blog-module/blog-entries/${encodeURIComponent(entryName)}/embeds/`;
    const variantPaths = {};
    for (const key of IMAGE_KEYS) {
        const name = `telemetry-${digest}-${key}.svg`;
        fs.writeFileSync(path.join(directory, name), bundle.images[key].svg, 'utf8');
        variantPaths[key] = assetBase + name;
    }
    const dataName = `telemetry-${digest}-data.json`;
    const { images: _images, ...interactiveData } = bundle;
    fs.writeFileSync(path.join(directory, dataName), JSON.stringify(interactiveData), 'utf8');
    const dataPath = assetBase + dataName;
    const linkBase = process.env.TELEMETRY_BASE_URL || 'https://f1stories.gr/telemetry/';
    let url;
    try { url = new URL(linkBase); } catch (_) { fail(filePath, 'TELEMETRY_BASE_URL is not a URL'); }
    const allowedBases = [
        'https://f1stories.gr/telemetry/', 'https://www.f1stories.gr/telemetry/',
        'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/', 'https://georgiosbalatzis.github.io/f1StoriesPage/f1telemetry/'
    ].map(value => new URL(value));
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/') || !allowedBases.some(base => base.origin === url.origin && base.pathname === url.pathname)) fail(filePath, 'TELEMETRY_BASE_URL is not an approved dashboard base');
    url.searchParams.set('year', String(bundle.scope.year)); url.searchParams.set('circuit', bundle.scope.circuit);
    url.searchParams.set('session', String(bundle.scope.sessionKey)); url.searchParams.set('drivers', bundle.scope.driverNums.join(','));
    url.searchParams.set('lap', String(bundle.scope.lapNum)); url.searchParams.set('tab', 'telemetry'); url.hash = bundle.panelId;
    const context = `${bundle.scope.year} · ${bundle.context.grandPrix} · ${bundle.context.session} · ${bundle.data.drivers.map(driver => `${driver.fullName} (${driver.acronym})`).join(' / ')} · Lap ${bundle.scope.lapNum}`;
    const missingDrivers = bundle.provenance.drivers.filter(driver => driver.status === 'missing').map(driver => {
        const identity = bundle.data.drivers.find(item => item.number === driver.driverNumber);
        return identity ? `${identity.fullName} (${identity.acronym})` : `#${driver.driverNumber}`;
    });
    const source = `OpenF1 · captured ${bundle.capturedAt}${missingDrivers.length ? ` · partial data: ${missingDrivers.join(', ')}` : ''}`;
    const title = `<h3>${escapeHtml(bundle.editorial.title)}</h3>`;
    const caption = bundle.editorial.caption ? `<figcaption>${escapeHtml(bundle.editorial.caption)}</figcaption>` : '';
    const picture = (theme, narrowKey, wideKey) => `<picture class="f1-telemetry-picture f1-telemetry-picture--${theme}"><source media="(min-width: 700px)" srcset="${variantPaths[wideKey]}" width="${bundle.images[wideKey].width}" height="${bundle.images[wideKey].height}"><img class="f1-telemetry-image" src="${variantPaths[narrowKey]}" width="${bundle.images[narrowKey].width}" height="${bundle.images[narrowKey].height}" alt="${escapeHtml(bundle.editorial.description)}"></picture>`;
    const dataUrl = dataPath;
    const manifestUrl = new URL('interactive/manifest.json', linkBase).href;
    return `<figure class="f1-telemetry-figure" data-panel="${bundle.panelId}" data-digest="${digest}" data-telemetry-data="${escapeHtml(dataUrl)}" data-runtime-manifest="${escapeHtml(manifestUrl)}"><p class="f1-telemetry-label">ΤΗΛΕΜΕΤΡΙΑ</p>${title}<p class="f1-telemetry-context">${escapeHtml(context)}</p>${picture('light', 'narrowLight', 'wideLight')}${picture('dark', 'narrowDark', 'wideDark')}<p class="f1-telemetry-source">${escapeHtml(source)}</p>${caption}<p class="f1-telemetry-analysis"><a href="${escapeHtml(url.href)}">Άνοιγμα πλήρους ανάλυσης</a></p></figure>`;
}

module.exports = { renderTelemetryFigure, validateBundle, validateSvg, resolveBundle };
