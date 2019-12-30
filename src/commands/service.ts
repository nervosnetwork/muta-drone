import { Command, flags } from "@oclif/command";
import * as path from "path";
import * as fs from "fs";

const TOML = require("@iarna/toml");

import { downloadTemplate, SERVICE_TEMPLATE } from "../util";

export default class Service extends Command {
  static description = "Crate servive template";

  static examples = ["$ drone service hello"];

  static args = [{ name: "service_name", required: true }];

  static flags = {
    help: flags.help({ char: "h" })
  };

  async run() {
    const { args, flags } = this.parse(Service);

    const rootPath = path.join(process.cwd(), "services", args.service_name);

    if (fs.existsSync(rootPath)) {
      this.error(`the same name already exists. ${rootPath}`);
      this.exit(1);
    }

    await downloadTemplate(SERVICE_TEMPLATE, rootPath);

    // modify service cargo.toml
    const cargoTomlPath = path.join(rootPath, "Cargo.toml");
    const cargoTomlStr = fs.readFileSync(cargoTomlPath);
    const cargo = TOML.parse(cargoTomlStr);
    cargo.package.name = args.service_name;
    fs.writeFileSync(cargoTomlPath, TOML.stringify(cargo));

    // modify node cargo.toml
    const nodeCargoPath = path.join(process.cwd(), "Cargo.toml");
    const nodeCargoStr = fs.readFileSync(nodeCargoPath);
    const nodeCargo = TOML.parse(nodeCargoStr);
    nodeCargo.workspace.members.push(`services/${args.service_name}`);
    nodeCargo.dependencies[args.service_name] = {
      path: `services/${args.service_name}`
    };
    fs.writeFileSync(nodeCargoPath, TOML.stringify(nodeCargo));

    this.log(`Done! ${args.service_name} service path ${rootPath}`);
  }
}
