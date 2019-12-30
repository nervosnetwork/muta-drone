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
  cryptoInfo: CryptoInfo;
  chainID: string;
  cyclesLimit: number;
  veriferSet: string[];
}

interface CryptoInfo {
  privkey: string;
  address: string;
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
        name: "privkey",
        message:
          "Private key of this node (secp256k1) (default: random generation)"
      },
      {
        type: "input",
        name: "veriferSet",
        message: "Verifier's address set, except you (eg. [0x1..., 0x2..])",
        default: []
      },
      {
        type: "input",
        name: "cyclesLimit",
        message: "cycles limit",
        default: U64_MAX
      }
    ]);

    let info: NodeInfo = {
      name: answers.name,
      cryptoInfo: this.getPrivkey(answers.privkey),
      chainID: answers.chainID === "" ? this.randomChainID() : answers.chainID,
      cyclesLimit: answers.cyclesLimit,
      veriferSet: answers.veriferSet
    };

    if (!info.veriferSet.find(s => s === info.cryptoInfo.address)) {
      info.veriferSet.push(info.cryptoInfo.address);
    }

    const rootPath = path.join(process.cwd(), info.name);
    if (fs.existsSync(rootPath)) {
      this.error(`the same name already exists. ${rootPath}`);
      this.exit(1);
    }

    await downloadTemplate(NODE_TEMPLATE, rootPath);

    // modify chain config
    const chainConfigPath = path.join(rootPath, "config/chain.toml");
    const configTomlStr = fs.readFileSync(chainConfigPath);
    const config = TOML.parse(configTomlStr);
    config.chain_id = info.chainID;
    config.privkey = info.cryptoInfo.privkey;
    config.consensus.cycles_limit = info.cyclesLimit;
    config.consensus.verifier_list = info.veriferSet;

    fs.writeFileSync(chainConfigPath, TOML.stringify(config));

    // modify genesis config
    const genesisConfigPath = path.join(rootPath, "config/genesis.toml");
    const genesisTomlStr = fs.readFileSync(genesisConfigPath);
    const gensis = TOML.parse(genesisTomlStr);
    (gensis.timestamp = Date.now()),
      (gensis.prevhash = keccak256("").toString("hex"));

    fs.writeFileSync(genesisConfigPath, TOML.stringify(gensis));

    this.log("All right, enjoy!");
    this.log("Enter the following command to start your chain");
    this.log("$ cd muta-chain && cargo run");
    this.log(
      "When the rust compilation is complete, access graphiql play your chain."
    );
    this.log("$ open http://localhost:8000/graphiql");
  }

  getPrivkey(privkey: string): CryptoInfo {
    let hex_privkey = privkey !== "" ? privkey : this.randomPrivkey();

    // get the public key in a compressed format
    const pubKey = secp256k1.publicKeyCreate(Buffer.from(hex_privkey, "hex"));

    return {
      privkey: hex_privkey,
      address: keccak256(pubKey)
        .slice(0, 20)
        .toString("hex")
    };
  }

  randomChainID(): string {
    const bytes = randomBytes(32);
    return keccak256(bytes).toString("hex");
  }

  randomPrivkey(): string {
    // generate privKey
    let privKey;
    do {
      privKey = randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privKey));

    return privKey.toString("hex");
  }
}
