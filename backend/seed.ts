import bcrypt from "bcryptjs";
import { sequelize, User } from "./models";

async function main() {
  await sequelize.sync();
  const users = [
    { email: "admin@example.com",   password: "admin123",   role: "admin" },
    { email: "analyst@example.com", password: "analyst123", role: "analyst" },
    { email: "viewer@example.com",  password: "viewer123",  role: "viewer" },
  ];
  for (const u of users) {
    const exists = await User.findOne({ where: { email: u.email } });
    if (exists) continue;
    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.create({ email: u.email, passwordHash, role: u.role });
    console.log(`Created ${u.email} / ${u.password}`);
  }
  process.exit(0);
}

main();