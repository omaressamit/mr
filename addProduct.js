// addProduct.js

let lastProductClickTime = 0; // Initialize timestamp for adding products

async function addProduct() {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire('خطأ', 'يجب تسجيل الدخول كمسؤول لإضافة منتج', 'error');
        return;
    }

    // Double-click prevention (5 seconds)
    const now = Date.now();
    if (now - lastProductClickTime < 5000) {
        Swal.fire('خطأ', 'يرجى الانتظار 5 ثوانٍ قبل إضافة صنف آخر.', 'error');
        return;
    }
    lastProductClickTime = now; // Update timestamp

    const branchName = document.getElementById('add-product-branch-select').value;
    const productName = document.getElementById('new-product-name').value.trim();

    if (!branchName || !productName) {
        Swal.fire('خطأ', 'يرجى إدخال اسم الفرع واسم الصنف.', 'error');
        return;
    }

    const { value: productDetails } = await Swal.fire({
        title: 'إضافة صنف جديد',
        html:
            `<input id="swal-input1" class="swal2-input" placeholder="الكمية (بالجرام)" type="number" step="0.01">` +
            `<input id="swal-input2" class="swal2-input" placeholder="سعر الشراء" type="number">`,
        focusConfirm: false,
        preConfirm: () => {
            const quantity = parseFloat(document.getElementById('swal-input1').value);
            const purchasePrice = parseFloat(document.getElementById('swal-input2').value);

            if (isNaN(quantity) || quantity <= 0 || isNaN(purchasePrice) || purchasePrice <= 0) {
                Swal.showValidationMessage('يرجى إدخال قيم صحيحة للكمية والسعر');
            }
            return { quantity, purchasePrice };
        }
    });

    if (productDetails) {
        const { quantity, purchasePrice } = productDetails;

        const selectedBranch = branches.find(b => b.name === branchName);
        if (!selectedBranch) {
            Swal.fire('خطأ', 'الفرع غير موجود', 'error');
            return;
        }

        // Ensure the branch has a products array
        selectedBranch.products = selectedBranch.products || [];

        const existingProductIndex = selectedBranch.products.findIndex(p => p.name === productName);

        if (existingProductIndex !== -1) {
            // Product *does* exist, add to existing.
            let previousTotalCost = selectedBranch.products[existingProductIndex].purchasePrice;
            if (isNaN(previousTotalCost)) {
                previousTotalCost = 0;
            }
            selectedBranch.products[existingProductIndex].purchasePrice = previousTotalCost + (quantity * purchasePrice);
            selectedBranch.products[existingProductIndex].quantity += quantity;
        } else {
            // Add new product to the branch
            selectedBranch.products.push({
                name: productName,
                quantity: quantity,
                purchasePrice: quantity * purchasePrice // Initial total purchase price
            });
        }

        await saveData();
        document.getElementById('new-product-name').value = '';

        // Dispatch a custom event after successfully adding the product
        document.dispatchEvent(new CustomEvent('productAdded'));


        Swal.fire({
            title: 'تم',
            text: 'تم إضافة/تحديث الصنف بنجاح',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

function updateProductsTable() {
    const container = document.getElementById('products-tables-container');
    container.innerHTML = ''; // Clear previous tables

    if (branches.length === 0) {
        container.innerHTML = '<p>لا توجد فروع لعرض الأصناف.</p>';
        return;
    }

    branches.forEach(branch => {
        if (!branch.products || branch.products.length === 0) {
            const noProductsDiv = document.createElement('div');
            noProductsDiv.innerHTML = `<h4>${branch.name}</h4><p>لا توجد أصناف في هذا الفرع.</p>`;
            container.appendChild(noProductsDiv);
            return; // Skip to the next branch if no products
        }

        const tableWrapper = document.createElement('div'); //div for each table.
        tableWrapper.classList.add('table-wrapper');       // add class to it
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        thead.innerHTML = `
              <tr>
                  <th colspan="4" style="text-align: center; background-color: #4CAF50; color: white;">${branch.name}</th>
              </tr>
              <tr>
                  <th>اسم الصنف</th>
                  <th>الكمية (بالجرام)</th>
                  <th>سعر الشراء</th>
                  <th></th>
              </tr>
          `;
        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrapper.appendChild(table); //add table in table wrapper
        container.appendChild(tableWrapper);// add table wrapper that contains (table)

        branch.products.forEach((product, index) => {
            const row = document.createElement('tr');
            const actionsCell = document.createElement('td');

            const editButton = document.createElement('button');
            editButton.textContent = 'تعديل';
            editButton.className = 'edit-btn';
            editButton.onclick = () => editProduct(branch.name, index); // Pass branch name
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'حذف';
            deleteButton.className = 'delete-btn';
            deleteButton.onclick = () => deleteProduct(branch.name, index); // Pass branch name
            actionsCell.appendChild(deleteButton);

            row.innerHTML = `
                  <td>${product.name}</td>
                  <td>${product.quantity.toFixed(2)}</td>
                  <td>${product.purchasePrice.toFixed(2)}</td>
              `;            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });
    });
}

async function editProduct(branchName, index) {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire('خطأ', 'يجب تسجيل الدخول كمسؤول لتعديل المنتجات', 'error');
        return;
    }

    const branch = branches.find(b => b.name === branchName);
    if (!branch || !branch.products || index < 0 || index >= branch.products.length) {
        Swal.fire('خطأ', 'الفرع أو الصنف غير موجود', 'error');
        return;
    }

    const product = branch.products[index];

    const { value: updatedDetails } = await Swal.fire({
        title: 'تعديل الصنف',
        html:
            `<input id="swal-input1" class="swal2-input" placeholder="الكمية (بالجرام)" type="number" step="0.01" value="${product.quantity}">` +
            `<input id="swal-input2" class="swal2-input" placeholder="سعر الشراء" type="number" value="${product.purchasePrice}">`,
        focusConfirm: false,
        preConfirm: () => {
            const quantity = parseFloat(document.getElementById('swal-input1').value);
            const purchasePrice = parseFloat(document.getElementById('swal-input2').value);
            if (isNaN(quantity) || quantity <= 0 || isNaN(purchasePrice) || purchasePrice <= 0) {
                Swal.showValidationMessage('يرجى إدخال قيم صحيحة للكمية والسعر');
            }
            return { quantity, purchasePrice };
        }
    });

    if (updatedDetails) {
        const { quantity, purchasePrice } = updatedDetails;

        // Update the product in the specific branch
        branch.products[index] = {
            name: product.name, // Keep the name
            quantity: quantity,
            purchasePrice: purchasePrice
        };

        await saveData();

        document.dispatchEvent(new CustomEvent('productAdded'));

        Swal.fire({
            title: 'تم',
            text: 'تم تحديث الصنف بنجاح',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

async function deleteProduct(branchName, index) {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire('خطأ', 'يجب تسجيل الدخول كمسؤول لحذف المنتجات', 'error');
        return;
    }

    const branch = branches.find(b => b.name === branchName);
    if (!branch || !branch.products || index < 0 || index >= branch.products.length) {
        Swal.fire('خطأ', 'الفرع أو الصنف غير موجود', 'error');
        return;
    }

    const productName = branch.products[index].name;

    const result = await Swal.fire({
        title: 'تأكيد الحذف',
        text: `هل أنت متأكد من حذف الصنف "${productName}" من فرع "${branchName}"؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });

    if (result.isConfirmed) {
        // Delete the product from the specific branch
        branch.products.splice(index, 1);
        await saveData();
        // Dispatch event to refresh the product tables
        document.dispatchEvent(new CustomEvent('productAdded'));

        Swal.fire({
            title: 'تم الحذف',
            text: 'تم حذف الصنف بنجاح',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }
}