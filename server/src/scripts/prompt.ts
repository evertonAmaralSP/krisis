import { createInterface } from 'node:readline';

/** Pergunta no terminal sem ecoar o que é digitado. */
export function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    rlAny._writeToOutput = (s: string) => {
      if (!muted) rlAny.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

export async function askNewPassword(): Promise<string> {
  const first = await askHidden('Nova senha (mínimo 12 caracteres): ');
  if (first.length < 12) throw new Error('A senha precisa ter pelo menos 12 caracteres.');
  const second = await askHidden('Repita a senha: ');
  if (first !== second) throw new Error('As senhas não conferem.');
  return first;
}
