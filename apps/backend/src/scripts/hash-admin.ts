import * as bcrypt from 'bcrypt';

async function main() {
  const password = 'admin123';

  const hash = await bcrypt.hash(password, 10);

  console.log(hash);
}

main();
