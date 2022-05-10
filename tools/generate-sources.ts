const fs = require('fs');
const { exec } = require("child_process");

exec("rm -rf _support/sources/", (error, stdout, stderr) => {
  exec("git clone git@github.com:joinself/sources.git _support/sources", (error, stdout, stderr) => {
    const data = fs.readFileSync('./_support/sources/sources.json','utf8');
    fs.writeFileSync("./src/sources.ts", "export const SOURCE_DEFINITION = " + data + "");
  })
})


