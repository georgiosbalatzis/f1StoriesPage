// Shared strict contract. No draft/editor types are imported by this experiment.
export const sections = {
    executive: 'Κύρια ευρήματα', facts: 'Πραγματολογικοί ισχυρισμοί με πηγές',
    statistics: 'Αγωνιστικά στατιστικά', technical: 'Τεχνικές εξηγήσεις',
    alternatives: 'Εναλλακτικές εξηγήσεις', contradictions: 'Αντιφάσεις / αντικρουόμενα στοιχεία',
    unverified: 'Μη επαληθευμένες υποθέσεις',
};
export const kinds = {
    official_record: 'Επίσημη καταγραφή', source_report: 'Αναφορά πηγής',
    calculated_statistic: 'Υπολογισμένο στατιστικό', technical_interpretation: 'Τεχνική ερμηνεία',
    prediction: 'Πρόβλεψη', unsupported_hypothesis: 'Μη τεκμηριωμένη υπόθεση',
};
const str = (maxLength = 1600) => ({ type: 'string', minLength: 1, maxLength });
const arr = (items, maxItems = 16) => ({ type: 'array', items, maxItems });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const statistic = obj(Object.fromEntries(['value', 'unit', 'population', 'period', 'dataSource', 'method', 'exclusions'].map(k => [k, str(500)])));
const claim = obj({ id: str(40), text: str(), kind: { type: 'string', enum: Object.keys(kinds) }, sourceIds: arr(str(40), 8), statistic: nullable(statistic) });
export const dossierSchema = obj({
    scope: str(),
    ...Object.fromEntries(Object.keys(sections).map(k => [k, arr(claim)])),
    limitations: arr(str()), outline: arr(str(300), 10),
    sources: arr(obj({ id: str(40), url: str(2000), title: str(400), publicationDate: nullable(str(10)) }), 24),
});

// The same subset is sent as strict JSON Schema and enforced on the server.
export function validateSchema(value, schema = dossierSchema, at = '$') {
    if (schema.anyOf) {
        if (schema.anyOf.some(s => { try { validateSchema(value, s, at); return true; } catch { return false; } })) return value;
        throw new Error(`Invalid structured output: ${at}`);
    }
    const fail = () => { throw new Error(`Invalid structured output: ${at}`); };
    if (schema.type === 'null') { if (value !== null) fail(); }
    if (schema.type === 'string' && (typeof value !== 'string' || !value.trim() || value.length > schema.maxLength)) fail();
    if (schema.enum && !schema.enum.includes(value)) fail();
    if (schema.type === 'array') {
        if (!Array.isArray(value) || value.length > schema.maxItems) fail();
        value.forEach((v, i) => validateSchema(v, schema.items, `${at}[${i}]`));
    }
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== schema.required.length) fail();
        for (const k of schema.required) {
            if (!Object.hasOwn(value, k)) fail();
            validateSchema(value[k], schema.properties[k], `${at}.${k}`);
        }
    }
    return value;
}

export function validateInput(input) {
    const allowed = ['question', 'season', 'grandPrix', 'session', 'category', 'mode', 'activateLive'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw new Error('Μη έγκυρα πεδία έρευνας.');
    const text = (key, max, required = false) => {
        const v = input[key] ?? '';
        if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(v) || (required && v.trim().length < 8)) throw new Error(`Μη έγκυρο πεδίο: ${key}.`);
        return v.trim();
    };
    const question = text('question', 1200, true), season = text('season', 4);
    if (!/^\d{4}$/.test(season) || +season < 1950 || +season > 2100) throw new Error('Η σεζόν πρέπει να είναι μεταξύ 1950 και 2100.');
    if (!['Technical', 'Analysis', 'History', 'News', 'Opinion'].includes(input.category)) throw new Error('Μη έγκυρη κατηγορία.');
    if (!['DEMO', 'LIVE'].includes(input.mode) || typeof input.activateLive !== 'boolean') throw new Error('Μη έγκυρη λειτουργία.');
    const session = text('session', 30);
    if (!['', 'Practice', 'Qualifying', 'Sprint', 'Race'].includes(session)) throw new Error('Μη έγκυρο σκέλος.');
    return { question, season, grandPrix: text('grandPrix', 100), session, category: input.category, mode: input.mode, activateLive: input.activateLive };
}

export function scopeText(input) {
    return `Ερώτημα: ${input.question}\nΣεζόν: ${input.season} · ${input.grandPrix || 'χωρίς συγκεκριμένο Grand Prix'} · ${input.session || 'χωρίς σκέλος'} · ${input.category}`;
}
