const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPng = path.join(__dirname, 'public', 'limonlogo.png');
const outputIco = path.join(__dirname, 'public', 'icon.ico');

pngToIco(inputPng)
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('Icon created successfully!');
  })
  .catch(console.error);
