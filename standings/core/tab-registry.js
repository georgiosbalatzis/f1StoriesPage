export function createTabRegistry({ tabs = [], modules = {} } = {}) {
    const allowed = new Set(tabs.map(tab => typeof tab === 'string' ? tab : tab.id));
    const loaded = new Map();
    async function load(tab) {
        if (!allowed.has(tab) || !modules[tab]) return null;
        if (!loaded.has(tab)) loaded.set(tab, import(modules[tab]));
        return loaded.get(tab);
    }
    return { load, has: tab => allowed.has(tab), loaded };
}
