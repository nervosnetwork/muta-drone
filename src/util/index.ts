import * as path from "path";
import * as os from "os";
import * as util from "util";
import * as shelljs from "shelljs";

const download = require("download-git-repo");
const asyncDownload = util.promisify(download);

export const NODE_TEMPLATE = "node-template";
export const SERVICE_TEMPLATE = "service-template";

export async function downloadTemplate(template: string, targetPath: string) {
  console.log("Downloading template....");
  const templatePath = path.join(os.tmpdir(), "muta");
  await asyncDownload("yejiayu/muta-template", templatePath);

  console.log("Copying template....");
  shelljs.cp("-r", path.join(templatePath, template), targetPath);
  shelljs.rm("-rf", templatePath);
}
