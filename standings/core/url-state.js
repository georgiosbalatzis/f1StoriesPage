export function createUrlState({ tabs = [], shareTargets = {} } = {}) {
    const validTabs = new Set(tabs);
    const sanitizeTab = value => validTabs.has(value) ? value : (tabs[0] || 'drivers');
    const sanitizeFocus = value => value && shareTargets[value] ? value : '';
    function read(search = '') {
        const params = new URLSearchParams(search);
        const focus = sanitizeFocus(params.get('focus'));
        return { tab: focus ? shareTargets[focus].tab : sanitizeTab(params.get('tab')), focus, embed: params.get('embed') === '1' };
    }
    function write(url, state) {
        const next = new URL(url); next.search = ''; next.hash = '';
        next.searchParams.set('tab', sanitizeTab(state.tab));
        if (state.focus && sanitizeFocus(state.focus)) next.searchParams.set('focus', state.focus);
        if (state.embed) next.searchParams.set('embed', '1');
        return next.toString();
    }
    return { read, write, sanitizeTab, sanitizeFocus };
}
