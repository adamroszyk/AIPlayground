import readline from "node:readline";

/** Asks one question in the terminal. With `hidden`, typed characters show as * and are never echoed. Works the same in bash and zsh. */
export function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) return Promise.reject(new Error(`This needs an interactive terminal to ask: ${question.trim()}`));
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    const write = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (s) => { if (muted && s !== "\r\n" && s !== "\n" && s !== "\r") process.stdout.write("*".repeat(Math.min(s.length, 1))); else process.stdout.write(s); };
    void write;
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(answer.trim()); });
    muted = hidden;
  });
}

export const looksLikeToken = (s) => /^[A-Za-z0-9_-]{30,}$/.test(s);
export const looksLikeAccountId = (s) => /^[0-9a-f]{32}$/i.test(s);
