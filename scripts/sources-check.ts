import { liveCheck } from "../lib/sources";
import { rules } from "../rules/ctc-ms-foreign";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Checks that every quoted excerpt is still on its CTC page. Fetches each page once, politely. Changes nothing. */
(async () => {
  let bad = 0;
  let lastUrl = "";
  for (const r of [...rules].sort((a, b) => a.source_url.localeCompare(b.source_url))) {
    if (r.source_url !== lastUrl) await sleep(1500);
    lastUrl = r.source_url;
    const res = await liveCheck(r.id, r.source_url, r.excerpt);
    if (res.result !== "found") bad++;
    console.log(`${r.id.padEnd(4)} ${res.result.padEnd(12)} ${r.source_url}`);
  }
  console.log(bad ? `${bad} rule(s) could not be confirmed. not_found needs a person to review; fetch_failed means try later.` : "all excerpts found");
})();
