// Prints the ChatGPT test script: the exact prompts to try, the tool each should call, and what to look for.  npm run prompts
const out = [];
for (const [dir, url, label] of [["home", "ROOMWISE_URL", "Roomwise"], ["wedding", "AISLE_URL", "Aisle"]]) {
  const { spec } = await import(`../apps/${dir}/plugin/spec.ts`);
  out.push(`\n=== ${label}: ${spec.cases.positive.length} prompts that should work ===`);
  spec.cases.positive.forEach((c, i) => out.push(`\n${i + 1}. ${c.description}\n   Say:    ${c.prompt}\n   Tool:   ${c.tools_triggered}\n   Expect: ${c.expected_behavior}`));
  out.push(`\n=== ${label}: ${spec.cases.negative.length} prompts that should be declined (no tool call that does the thing) ===`);
  spec.cases.negative.forEach((c, i) => out.push(`\n${i + 1}. ${c.description}\n   Say:    ${c.prompt}`));
}
console.log(out.join("\n"));
