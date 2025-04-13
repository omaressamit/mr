function populateProductSelect(pageId) {
    let selectId;
    let branchSelectId;

    if (pageId === 'sales') {
        selectId = 'product-select';
        branchSelectId = 'branch-select';
    } else if (pageId === 'returns') {
        selectId = 'return-product-select';
        branchSelectId = 'returns-branch-select';
    } else if (pageId === 'receiving') {
        selectId = 'receive-product-select';
        branchSelectId = 'receiving-branch-select';
    }

    if (!selectId) return;

    const selectElement = document.getElementById(selectId);
    if (!selectElement) { // **ADD THIS CHECK**
        console.warn(`Select element with ID '${selectId}' not found in DOM when calling populateProductSelect for pageId: ${pageId}`);
        return; // Exit function if element is not found
    }
    const branchSelectElement = document.getElementById(branchSelectId);

    selectElement.innerHTML = ''; // Now this line will be executed only if selectElement is valid

    if (branchSelectElement) {
        const selectedBranchName = branchSelectElement.value;
        const selectedBranch = branches.find(b => b.name === selectedBranchName);

        if (selectedBranch && selectedBranch.products) {
            selectedBranch.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.name;
                option.textContent = `${product.name} (الكمية: ${product.quantity.toFixed(2)} بالجرام)`;
                selectElement.appendChild(option);
            });
        } else {
            selectElement.innerHTML = '<option value="">لا توجد أصناف لهذا الفرع</option>';
        }
    }
    // Add event listener to branch select to update product select
    if (branchSelectElement) {
        branchSelectElement.addEventListener('change', () => populateProductSelect(pageId));
    }
}