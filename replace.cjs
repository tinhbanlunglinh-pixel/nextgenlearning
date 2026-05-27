const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    const ext = path.extname(filePath);
    if (!['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.md'].includes(ext)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Perform text replacements
    content = content.replace(/MRS\. DUNG/g, "NEXTGEN ENGLISH");
    content = content.replace(/MRS\.DUNG/g, "NEXTGEN ENGLISH");
    content = content.replace(/MRS DUNG/g, "NEXTGEN ENGLISH");
    content = content.replace(/Mrs\. Dung/g, "Nextgen English");
    content = content.replace(/Mrs\.Dung/g, "Nextgen English");
    content = content.replace(/Mrs Dung/g, "Nextgen English");
    content = content.replace(/MrsDung/g, "NextgenEnglish");
    content = content.replace(/mrs_dung/g, "nextgen_english");
    content = content.replace(/English with Heart\. Success with Nextgen English/g, "Learn English, Lead the way");
    content = content.replace(/English with Heart/g, "Learn English, Lead the way");
    content = content.replace(/Học Tiếng Anh bằng cả Trái Tim\./g, "HỌC TIẾNG ANH . DẪN LỐI TƯƠNG LAI.");
    
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
            replaceInFile(fullPath);
        }
    }
}

walkDir(path.resolve('.'));
console.log('Done replacing texts!');
