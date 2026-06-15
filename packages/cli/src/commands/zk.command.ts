import { type Command } from "commander";

export function getOrCreateZkCommand(program: Command): Command {
  const existing = program.commands.find((command) => command.name() === "zk");
  if (existing) {
    return existing;
  }

  return program
    .command("zk")
    .description("Zero-knowledge proof tooling for Circom circuits and Soroban verifiers");
}
