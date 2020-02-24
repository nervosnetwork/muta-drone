import * as path from "path";
import * as fs from "fs";
import { randomBytes } from "crypto";
import { Command, flags } from "@oclif/command";

const TOML = require("@iarna/toml");
const secp256k1 = require("secp256k1");
const hex = require("hex");
const inquirer = require("inquirer");
const keccak256 = require("keccak256");

import { downloadTemplate, NODE_TEMPLATE } from "../util";

const U64_MAX = 1024 * 1024 * 1024 * 1024;

interface NodeInfo {
  name: string;
  chainID: string;
  cyclesLimit: number;
  blockInterval: number;
}

export default class Node extends Command {
  static description = "Create your blockchain with one click.";

  static examples = ["$ drone node"];

  static flags = {
    help: flags.help({ char: "h" })
  };

  async run() {
    this.parse(Node);

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "The name of your chain.",
        default: "muta-chain"
      },
      {
        type: "input",
        name: "chainID",
        message:
          "The chain id of your chain (32-Hash) (default: random generation)"
      },
      {
        type: "input",
        name: "cyclesLimit",
        message: "cycles limit",
        default: U64_MAX
      },
      {
        type: "input",
        name: "blockInterval",
        message: "The interval of block (millisecond), should be greater than 500. (default: 3000)",
        default: 3000
      },
    ]);

    let info: NodeInfo = {
      name: answers.name,
      chainID: answers.chainID === "" ? this.randomChainID() : answers.chainID,
      cyclesLimit: answers.cyclesLimit,
      blockInterval: answers.blockInterval,
    };

    const rootPath = path.join(process.cwd(), info.name);
    if (fs.existsSync(rootPath)) {
      this.error(`the same name already exists. ${rootPath}`);
      this.exit(1);
    }

    if (info.blockInterval < 500) {
      this.error(`the interval of block should be greater than 500`);
      this.exit(1);
    }

    await downloadTemplate(NODE_TEMPLATE, rootPath);

    // modify genesis config
    const genesisConfigPath = path.join(rootPath, "config/genesis.toml");
    const genesisTomlStr = fs.readFileSync(genesisConfigPath);
    let genesis = TOML.parse(genesisTomlStr);
    (genesis.timestamp = Date.now()),
      (genesis.prevhash = keccak256("").toString("hex"));
    let metadataPayloadStr = genesis.services[1].payload;
    let metadataPayload = JSON.parse(metadataPayloadStr);
    metadataPayload.chain_id = info.chainID;
    metadataPayload.cycles_limit = Number(info.cyclesLimit);
    metadataPayload.interval = Number(info.blockInterval);
    metadataPayloadStr = JSON.stringify(metadataPayload);
    genesis.services[1].payload = metadataPayloadStr;

    fs.writeFileSync(genesisConfigPath, TOML.stringify(genesis));

    this.log("All right, enjoy!");
    this.log("Enter the following command to start your chain");
    this.log(`$ cd ${info.name} && cargo run`);
    this.log(
      "When the rust compilation is complete, access graphiql play your chain."
    );
    this.log("$ open http://localhost:8000/graphiql");
  }

  randomChainID(): string {
    const bytes = randomBytes(32);
    return keccak256(bytes).toString("hex");
  }
}
