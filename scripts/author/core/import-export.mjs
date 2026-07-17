export async function exportDraft(zipFactory, draft, files = []) {
  const zip = zipFactory(); zip.file('draft.json', JSON.stringify(draft, null, 2));
  for (const file of files) zip.file(file.name, file.data);
  return zip.generateAsync({ type: 'blob' });
}

export async function importDraft(zipLoader, blob) {
  const zip = await zipLoader(blob); const entry = zip.file('draft.json');
  if (!entry) throw new Error('ZIP is missing draft.json');
  return JSON.parse(await entry.async('string'));
}
