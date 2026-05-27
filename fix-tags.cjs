const fs = require('fs');
const path = require('path');

function fixTag(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    content = content.replace(/<<\/h4>/g, '</h4>');
    content = content.replace(/<<\/h3>/g, '</h3>');
    content = content.replace(/<<\/p>/g, '</p>');
    content = content.replace(/<<\/span>/g, '</span>');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.git' || file === 'temp_repo') continue;
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else {
            fixTag(fullPath);
        }
    }
}

walkDir(path.resolve('.'));
console.log('Done fixing <</ tags!');
