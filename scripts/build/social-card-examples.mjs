// Review fixtures only; these titles are never inserted into the publication index.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSocialCard } from './social-cards.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const examples = [
    { name: 'short', title: 'Μια νίκη γεμάτη ιστορίες', category: 'Ειδήσεις', author: 'Θέμης Χαρβάλης', image: '20261020W/2.webp' },
    { name: 'long', title: 'Πιασ(τ)άρικη Κυριαρχία και Βαρκελώνη στις Φλόγες! Ο Piastri Θριαμβεύει, ο Verstappen στο Μάτι του Κυκλώνα στο Ισπανικό GP του 2025!', category: 'Ανάλυση', author: 'Γιώργος Μπαλατζής', image: '20250602-1G/1.webp' },
    { name: 'technical', title: 'Γιατί το νέο πάτωμα δεν έφερε τα δέκατα που υποσχέθηκε: αεροδυναμική, ελαστικά και αγωνιστικός ρυθμός', category: 'Τεχνικά', author: 'Γιώργος Μπαλατζής', image: '20261015G/1.webp' },
    { name: 'optional', title: 'Μια ιστορία από την πίστα', image: '20261020W/1.webp' },
    { name: 'punctuation', title: '«F1» & <ρυθμός>: τ’ αγώνα, "νέα" και O’Connor', category: 'Άποψη', image: '20261020W/2.webp' },
    { name: 'home', home: true }
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const output = path.resolve(process.argv[2] || '/tmp/f1-social-card-examples');
    fs.mkdirSync(output, { recursive: true });
    for (const example of examples) {
        const image = example.image ? fs.readFileSync(path.join(root, 'blog-module/blog-entries', example.image)) : null;
        const { data, layout } = await renderSocialCard({ ...example, image });
        fs.writeFileSync(path.join(output, example.name + '.jpg'), data);
        console.log(example.name, data.length, JSON.stringify(layout));
    }
}
