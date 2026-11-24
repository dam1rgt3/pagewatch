export const boards = [
  { key: "figma", name: "Figma", careers: "https://www.figma.com/careers/" },
  { key: "duolingo", name: "Duolingo", careers: "https://careers.duolingo.com/" },
  { key: "anthropic", name: "Anthropic", careers: "https://www.anthropic.com/careers/jobs" },
];

export const blankHistory = () => ({ version: 1, boards: {}, events: [] });
const tidy = s => typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "";

export function parseBoard(payload) {
  if (!Array.isArray(payload?.jobs) || !Number.isSafeInteger(payload.meta?.total) ||
      payload.meta.total !== payload.jobs.length) {
    throw new Error("Incomplete job list");
  }
  const roles = new Map();
  for (const job of payload.jobs) {
    if (job && job.internal_job_id === null) continue; // Greenhouse prospect posts.
    if (!job || !Number.isSafeInteger(job.id) || job.id <= 0 || !tidy(job.title)) {
      throw new Error("Invalid posting");
    }
    const url = new URL(job.absolute_url);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid job link");
    const id = String(job.id);
    if (roles.has(id)) throw new Error("Duplicate posting ID");
    roles.set(id, { id, title: tidy(job.title), location: tidy(job.location?.name), url: url.href });
  }
  return [...roles.values()].sort((a,b) => a.id.localeCompare(b.id, "en"));
}

export function compare(previous, roles, at, key) {
  const events = [], missing = [];
  if (previous?.lastSuccess) {
    const pending = new Map(previous.missing.map(r => [r.id, r]));
    const old = new Map([...previous.roles, ...previous.missing].map(r => [r.id, r]));
    const current = new Set(roles.map(r => r.id));
    for (const role of roles) {
      const before = old.get(role.id);
      if (!before) events.push({ at, key, type: "added", after: role });
      else if (role.title !== before.title || role.location !== before.location) {
        events.push({ at, key, type: "updated", before, after: role });
      }
    }
    for (const before of old.values()) {
      if (current.has(before.id)) continue;
      if (pending.has(before.id)) events.push({ at, key, type: "removed", before });
      else missing.push(before);
    }
  }
  return {
    board: { firstSeen: previous?.firstSeen || at, lastSuccess: at, lastAttempt: at,
      error: null, roles, missing },
    events,
  };
}

export function applyCheck(history, key, result, at) {
  if (history.version !== 1 || !Array.isArray(history.events) || !history.boards) throw Error("Unknown history format");
  const previous = history.boards[key];
  if (result.error) {
    history.boards[key] = { firstSeen: null, lastSuccess: null, roles: [], missing: [],
      ...previous, lastAttempt: at, error: result.error };
    return;
  }
  const change = compare(previous, result.roles, at, key);
  history.boards[key] = change.board;
  history.events.push(...change.events);
}

export function trimHistory(history, now) {
  const cutoff = Date.parse(now) - 90 * 86400000;
  history.events = history.events.filter(event => Date.parse(event.at) >= cutoff)
    .sort((a,b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key) ||
      (a.after || a.before).id.localeCompare((b.after || b.before).id));
}
