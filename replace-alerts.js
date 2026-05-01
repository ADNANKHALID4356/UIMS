const fs = require('fs');
const path = require('path');

const files = [
    'src/frontend/pages/ProductsPage.jsx',
    'src/frontend/pages/GrainsPage.jsx',
    'src/frontend/pages/EditTransactionPage.jsx',
    'src/frontend/pages/EntityLedgerPage.jsx',
    'src/frontend/pages/ProductCategoriesPage.jsx',
    'src/frontend/pages/NewTransactionPage.jsx',
    'src/frontend/components/transaction/MultiItemTransactionForm.jsx'
];

const replacements = [
    // Validation and warnings
    { from: /alert\('Please /g, to: "toast.warning('Please " },
    { from: /alert\('At least /g, to: "toast.warning('At least " },
    { from: /alert\('Maximum /g, to: "toast.warning('Maximum " },
    { from: /alert\(`Warning:/g, to: "toast.warning(`Warning:" },
    
    // Errors
    { from: /alert\('Error /g, to: "toast.error('Error " },
    { from: /alert\('Failed /g, to: "toast.error('Failed " },
    { from: /alert\('Cannot /g, to: "toast.error('Cannot " },
    { from: /alert\('Session /g, to: "toast.error('Session " },
    { from: /alert\('Validation /g, to: "toast.error('Validation " },
    { from: /alert\(`Error:/g, to: "toast.error(`" },
    { from: /alert\(`❌ /g, to: "toast.error(`" },
    
    // Success messages
    { from: /alert\(`([^`]+) successfully/g, to: "toast.success(`$1 successfully" },
    { from: /alert\(`([^`]+) created successfully/g, to: "toast.success(`$1 created successfully" },
    { from: /alert\(`Stock /g, to: "toast.success(`Stock " },
    { from: /alert\('Stock /g, to: "toast.success('Stock " },
    { from: /alert\('Transaction /g, to: "toast.success('Transaction " },
    { from: /alert\(`Transaction /g, to: "toast.success(`Transaction " },
    { from: /alert\(`✅ /g, to: "toast.success(`" },
    { from: /alert\(`Grain /g, to: "toast.success(`Grain " },
    { from: /alert\(`Product /g, to: "toast.success(`Product " },
    { from: /alert\(`Category /g, to: "toast.success(`Category " },
    { from: /alert\('Settlement /g, to: "toast.success('Settlement " }
];

files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`Processing: ${file}`);
        let content = fs.readFileSync(fullPath, 'utf8');
        
        replacements.forEach(({ from, to }) => {
            content = content.replace(from, to);
        });
        
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Completed: ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
});

console.log('Alert replacement complete!');
