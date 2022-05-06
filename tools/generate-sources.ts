const fs = require('fs');

const data = fs.readFileSync('./tools/config/sources.json','utf8');

fs.writeFileSync("./src/sources.ts", "export const SOURCE_DEFINITION = `" + data + "`");
