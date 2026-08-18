const fs = require('fs');
const path = require('path');

const dirsToScan = ['components', 'src'];
const vietnameseRegex = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                // Ignore comments
                if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;

                // Ignore console.log and errors
                if (line.includes('console.') || line.includes('Error(') || line.includes('throw new')) return;

                // Match Vietnamese
                if (vietnameseRegex.test(line)) {
                    // Check if it's already inside t( or i18n
                    // A simple check, might have false positives but good for a quick scan
                    if (!line.includes('t(') && !line.includes('t"')) {
                        console.log(`[${fullPath}:${index + 1}] => ${line.trim()}`);
                    }
                }
            });
        }
    }
}

dirsToScan.forEach(dir => {
    const fullDirPath = path.join(__dirname, dir);
    if (fs.existsSync(fullDirPath)) {
        console.log(`Scanning ${dir}...`);
        scanDirectory(fullDirPath);
    }
});
