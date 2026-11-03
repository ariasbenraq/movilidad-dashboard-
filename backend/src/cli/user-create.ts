import * as argon2 from 'argon2';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { validateNewUser } from '../auth/auth.rules.js';
import { AppDataSource } from '../database/data-source.js';

/** Reads a line from the terminal without echoing it. */
function readHidden(prompt: string): Promise<string> {
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (done: () => void) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      done();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          finish(() => resolve(value));
          return;
        }
        if (ch === '\u0003') {
          finish(() => reject(new Error('Cancelled')));
          return;
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  if (!stdin.isTTY) {
    throw new Error(
      'Run this in an interactive terminal: the password is never read from arguments or the environment.',
    );
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const username = (await rl.question('Username: ')).trim();
  rl.close();

  const password = await readHidden('Password: ');
  const confirm = await readHidden('Repeat password: ');
  if (password !== confirm) throw new Error('Passwords do not match.');

  const invalid = validateNewUser(username, password);
  if (invalid) throw new Error(invalid);

  const hash = await argon2.hash(password);
  await AppDataSource.initialize();
  try {
    const created: { id: string }[] = await AppDataSource.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING RETURNING id`,
      [username, hash],
    );
    if (created.length === 0) throw new Error('That username already exists.');
    console.log(`User "${username}" created.`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
