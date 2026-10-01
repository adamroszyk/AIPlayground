// Prints the ChatGPT test script (or, with --record, a shot list for the demo video).: the exact prompts to try, the tool each should call, and what to look for.  npm run prompts
const record = process.argv.includes("--record");
const out = [];
const EXTRA = {
  home: "Click the edit link ChatGPT gives you. In the editor, drag the armchair into the doorway: show the checks failing and naming the rule. Press Plan layout: back to all passing. Show the Materials panel. Then return to ChatGPT.",
  wedding: "Click the edit link ChatGPT gives you. In the editor, drag a guest onto a seat at another table: show the rule failing. Try a full table: show the refusal message. Press Plan seating: back to all passing. Then return to ChatGPT.",
};
if (record) {
  console.log(`DEMO VIDEO SHOT LIST (one continuous screen recording per plugin, about 3 to 4 minutes)

Before you start
  - ChatGPT in a new chat with the plugin connected (developer mode, or the installed plugin). Close other windows and notifications.
  - macOS: press Shift+Command+5, choose "Record Selected Portion" or "Record Entire Screen", turn the microphone on in Options, press Record.
  - If ChatGPT asks a follow-up (sizes, positions, who sits where), just answer in one line with typical values, for example: sofa 84 x 36 in, coffee table 40 x 20 in, TV unit 60 x 16 in; or a short guest list. Keep going: a follow-up question is normal.
  - Speak plainly and slowly. Reviewers want to see each prompt typed or pasted, the tool being used, and the result.
  - Stop with the menu-bar button. Upload to YouTube as Unlisted (or Loom, or Google Drive with "Anyone with the link"). Open the link in a private window to be sure it plays without signing in.
  - Then run: npm run demo-url -- roomwise <link>   (or aisle), then: npm run package:plugins, and upload the new ZIP.
`);
}
for (const [dir, url, label] of [["home", "ROOMWISE_URL", "Roomwise"], ["wedding", "AISLE_URL", "Aisle"]]) {
  const { spec } = await import(`../apps/${dir}/plugin/spec.ts`);
  if (record) {
    out.push(`\n\n######## ${label}: recording plan ########\n`);
    out.push(`0. Say who you are and what ${label} does in two sentences (${spec.shortDescription}). Say what it does NOT do (photos, ordering, vendors, payments).`);
    spec.cases.positive.forEach((c, i) => out.push(`\n${i + 1}. Paste: ${c.prompt}\n   Show: ChatGPT using the ${c.tools_triggered} tool, then the result and the widget.\n   Say : "${c.expected_behavior}"${i === 0 ? `\n   Then: ${EXTRA[dir]}` : ""}`));
    spec.cases.negative.forEach((c, i) => out.push(`\n${spec.cases.positive.length + i + 1}. Paste: ${c.prompt}\n   Show: ChatGPT declining or explaining it cannot do this (${c.description}). Say: "${label} stays within its scope."`));
    out.push(`\n${spec.cases.positive.length + spec.cases.negative.length + 1}. Finish: open the privacy page (${dir === "home" ? "roomwise" : "aisle"} site /privacy/) for five seconds and say plans are private links that expire after 90 days. Stop recording.`);
    continue;
  }
  out.push(`\n=== ${label}: ${spec.cases.positive.length} prompts that should work ===`);
  spec.cases.positive.forEach((c, i) => out.push(`\n${i + 1}. ${c.description}\n   Say:    ${c.prompt}\n   Tool:   ${c.tools_triggered}\n   Expect: ${c.expected_behavior}`));
  out.push(`\n=== ${label}: ${spec.cases.negative.length} prompts that should be declined (no tool call that does the thing) ===`);
  spec.cases.negative.forEach((c, i) => out.push(`\n${i + 1}. ${c.description}\n   Say:    ${c.prompt}`));
}
console.log(out.join("\n"));
