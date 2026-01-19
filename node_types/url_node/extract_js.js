const fs = require('fs');
const path = require('path');

const htmlPath = '/Users/caneratik/Mosaic/node_types/url_node/index.html';
const content = fs.readFileSync(htmlPath, 'utf8');

// Extract script content
const scriptStart = content.indexOf('<script>') + 8;
const scriptEnd = content.lastIndexOf('</script>');
const scriptContent = content.substring(scriptStart, scriptEnd);

const jsPath = path.join(path.dirname(htmlPath), 'temp_syntax_check.js');
fs.writeFileSync(jsPath, scriptContent);

console.log('Extracted JS to:', jsPath);
