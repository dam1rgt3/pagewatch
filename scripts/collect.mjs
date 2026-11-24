import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { boards, blankHistory, parseBoard, applyCheck, trimHistory } from "../src/monitor.mjs";

const target = process.argv[2] || "site/data/watch.json";
await mkdir(dirname(target), { recursive: true });
let history;
try { history = JSON.parse(await readFile(target, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  history = blankHistory();
}

const at = new Date().toISOString();
const results = await Promise.all(boards.map(async board => {
  try {
    const response = await fetch("https://boards-api.greenhouse.io/v1/boards/" + board.key + "/jobs", {
      headers: { Accept: "application/json", "User-Agent": "PageWatch-careers-monitor/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return { roles: parseBoard(await response.json()) };
  } catch (error) {
    console.warn(board.name + ": " + error.message);
    return { error: "Latest check unavailable" };
  }
}));
for (const [i, board] of boards.entries()) {
  applyCheck(history, board.key, results[i], at);
  Object.assign(history.boards[board.key], { name: board.name, careers: board.careers });
  console.log(board.name + ": " + (results[i].error || results[i].roles.length + " active postings"));
}
trimHistory(history, at);
await writeFile(target + ".tmp", JSON.stringify(history) + "\n");
await rename(target + ".tmp", target);
if (results.every(result => result.error) && !Object.values(history.boards).some(b => b.lastSuccess)) {
  throw Error("No source has a baseline yet.");
}
