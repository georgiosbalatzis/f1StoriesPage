(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.F1S_ARTICLE_CORRECTIONS = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    var keys = ['type', 'date', 'section', 'reason', 'decision', 'approvedBy', 'approvedOn'];
    function day(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        var date = new Date(value + 'T00:00:00Z');
        return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    function validate(records) {
        if (!Array.isArray(records) || records.length > 20) throw new Error('Invalid corrections list');
        var seen = {};
        var previous = '';
        records.forEach(function (record) {
            if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).length !== keys.length || keys.some(function (key) { return !Object.prototype.hasOwnProperty.call(record, key); })) throw new Error('Invalid correction keys');
            if (['factual-correction', 'substantial-update'].indexOf(record.type) === -1 || record.decision !== 'approved') throw new Error('Invalid correction type or decision');
            if (!day(record.date) || !day(record.approvedOn) || record.approvedOn > record.date) throw new Error('Invalid correction dates');
            [['section', 200], ['reason', 1000], ['approvedBy', 100]].forEach(function (field) {
                var value = record[field[0]];
                if (typeof value !== 'string' || !value.trim() || value.length > field[1] || /[\r\n\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid correction ' + field[0]);
            });
            if (record.date < previous) throw new Error('Correction dates regress');
            previous = record.date;
            var signature = JSON.stringify(keys.map(function (key) { return record[key]; }));
            if (seen[signature]) throw new Error('Duplicate correction');
            seen[signature] = true;
        });
        return records;
    }
    function parse(value) {
        if (typeof value !== 'string') throw new Error('Invalid corrections JSON');
        return validate(JSON.parse(value));
    }
    function serialize(records) {
        return JSON.stringify(validate(records).map(function (record) {
            var ordered = {};
            keys.forEach(function (key) { ordered[key] = record[key]; });
            return ordered;
        }));
    }
    return { parse: parse, serialize: serialize, validate: validate };
}));
