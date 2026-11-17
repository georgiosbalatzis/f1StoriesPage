import fs from 'node:fs';
import path from 'node:path';

export const SNAPSHOT_PATH = 'dashboard/data/snapshot.json';

export function snapshotArtifact(file, root = process.cwd()) {
    const read = file => {
        try { return fs.readFileSync(file); }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    };
    const source = read(path.join(root, SNAPSHOT_PATH));
    const artifact = read(file);
    if (source && !artifact) throw new Error('snapshot present in source but missing from artifact');
    if (!source && artifact) throw new Error('snapshot missing from source but present in artifact');
    if (source && !source.equals(artifact)) throw new Error('snapshot artifact bytes differ from source');
    return artifact;
}
