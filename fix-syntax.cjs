const fs = require('fs');
const path = require('path');

const fixes = [
    { from: 'Lịch s?/span>', to: 'Lịch sử</span>' },
    { from: 'Ch?đ?,', to: 'Chủ đề\',' },
    { from: 'Liên H??/h4>', to: 'Liên Hệ</h4>' },
    { from: 'Liên H/h4>', to: 'Liên Hệ</h4>' },
    { from: 'NEXTGEN ENGLISH/p>', to: 'NEXTGEN ENGLISH"</p>' },
    { from: 'NEXTGEN ENGLISH??/p>', to: 'NEXTGEN ENGLISH"</p>' },
    { from: 'ENGLISH??/p>', to: 'ENGLISH"</p>' },
    { from: 'ENGLISH/p>', to: 'ENGLISH"</p>' },
    { from: 'h??nh', to: 'hành' },
    { from: 'B? ', to: 'Bỏ ' },
    { from: 'ng??i', to: 'người' },
    { from: 'c??Trái Tim', to: 'cả Trái Tim' },
    // CreativeMindMap.tsx
    { from: 'b?o', to: 'bảo' },
    { from: 'T?ng', to: 'Tổng' },
    { from: 'k?t', to: 'kết' },
    // InfographicPoster.tsx
    { from: '?i?m', to: 'Điểm' },
    // Just fix all broken tags globally
    { from: /\?\?\/p>/g, to: '"</p>' },
    { from: /\/p>/g, to: '"</p>' },
    { from: /\?\/span>/g, to: '</span>' },
    { from: /\/h4>/g, to: '</h4>' },
    { from: /\?\?\/h4>/g, to: '</h4>' },
    { from: /Ch\?đ\?,/g, to: 'Chủ đề\',' },
    { from: /Ch\?đ\?,/g, to: 'Chủ đề\',' },
    { from: /Lịch s\?\/span>/g, to: 'Lịch sử</span>' },
    { from: /Lịch s\?\/span>/g, to: 'Lịch sử</span>' },
    { from: /c\?\?Trái Tim/g, to: 'cả Trái Tim' },
    { from: /Liên H\?\?\/h4>/g, to: 'Liên Hệ</h4>' }
];

function fixSyntaxInFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    for (const fix of fixes) {
        if (typeof fix.from === 'string') {
            content = content.split(fix.from).join(fix.to);
        } else {
            content = content.replace(fix.from, fix.to);
        }
    }
    
    // Fallback fixes for missing closing tags or quotes
    content = content.replace(/Ch\?đ\?,/g, 'Chủ đề\',');
    content = content.replace(/Lịch s\?\/span>/g, 'Lịch sử</span>');
    content = content.replace(/ENGLISH\?\?\/p>/g, 'ENGLISH"</p>');
    content = content.replace(/Liên H\?\?\/h4>/g, 'Liên Hệ</h4>');
    
    // Fix string literals missing quotes
    content = content.replace(/const prompt = `MRS\. DUNG AI/g, 'const prompt = `NEXTGEN ENGLISH AI');
    content = content.replace(/Mrs\. Dung AI/g, 'NEXTGEN ENGLISH AI');

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
            fixSyntaxInFile(fullPath);
        }
    }
}

walkDir(path.resolve('.'));
console.log('Done fixing syntax!');
