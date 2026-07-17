export function createPublishingService({ fetchImpl = fetch, origin, owner, repo, baseBranch = 'main' }) {
  async function request(path, token, options = {}) {
    const response = await fetchImpl(`${origin}/repos/${owner}/${repo}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  return { request, baseBranch };
}
