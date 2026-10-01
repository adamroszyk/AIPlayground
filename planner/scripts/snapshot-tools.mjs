// Records each server's tools/list as the "approved" snapshot that later deployments must stay compatible with.
// Run only when you intentionally change the tool surface: node scripts/snapshot-tools.mjs
import { writeFile } from "node:fs/promises";
import { startWorker, mcpClient } from "../tests/helpers.mjs";

for (const [dir, port, insp] of [["home", 8801, 9401], ["wedding", 8802, 9402]]) {
  const w = startWorker(`apps/${dir}`, port, insp);
  try {
    await w.ready();
    const { result } = await mcpClient(w.base).rpc("tools/list");
    await writeFile(`apps/${dir}/plugin/tools.snapshot.json`, JSON.stringify(result.tools, null, 2) + "\n");
    console.log(`${dir}: ${result.tools.length} tools recorded`);
  } finally { w.stop(); }
}
