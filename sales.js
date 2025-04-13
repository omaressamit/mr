// sales.js

let lastSaleClickTime = 0; // Initialize timestamp

async function recordSale() {
    if (!currentUser) {
        Swal.fire('خطأ', 'يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    // Double-click prevention:
    const now = Date.now();
    if (now - lastSaleClickTime < 5000) {
        Swal.fire('خطأ', 'يرجى الانتظار 5 ثوانٍ قبل تسجيل عملية بيع أخرى.', 'error');
        return;
    }
    lastSaleClickTime = now; // Update the timestamp *before* any async operations


    const branchName = document.getElementById('branch-select').value;
    const productName = document.getElementById('product-select').value.trim();
    const saleQuantity = parseFloat(document.getElementById('sale-quantity').value.trim());
    const salePrice = parseFloat(document.getElementById('sale-price').value.trim());
    const customerPhone = document.getElementById('customer-phone').value.trim(); // Get phone number
    const details = document.getElementById('sale-details').value.trim();
    const paymentMethod = document.getElementById('payment-method').value; // Get payment method
    const customerDetails = document.getElementById('customer-details').value.trim(); // Get customer details


    if (!branchName || !productName || isNaN(saleQuantity) || isNaN(salePrice) || !paymentMethod) {
        Swal.fire('خطأ', 'يرجى إدخال جميع الحقول المطلوبة والتأكد من صحة القيم', 'error');
        return;
    }
    if (saleQuantity <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال كمية صحيحة أكبر من صفر', 'error');
        return;
    }
    if (salePrice <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال سعر بيع صحيح أكبر من صفر', 'error');
        return;
    }
    // Check if the user is authorized for the selected branch (if not admin)
    if (currentUser.role !== 'admin') {
        const selectedBranch = branches.find(b => b.name === branchName);
        if (!selectedBranch || !selectedBranch.users.includes(currentUser.username)) {
            Swal.fire('خطأ', 'غير مصرح لك بتسجيل مبيعات لهذا الفرع', 'error');
            return;
        }
    }
    const selectedBranch = branches.find(b => b.name === branchName);
    if (!selectedBranch) {
        Swal.fire('خطأ', 'الفرع غير موجود', 'error');
        return;
    }

    const productIndex = selectedBranch.products ? selectedBranch.products.findIndex(p => p.name === productName) : -1;

    if (productIndex === -1) {
        Swal.fire('خطأ', 'الصنف غير موجود في هذا الفرع', 'error');
        return;
    }

    if (selectedBranch.products[productIndex].quantity < saleQuantity) {
        Swal.fire('خطأ', 'لا توجد كمية كافية من هذا الصنف في الفرع', 'error');
        return;
    }

    // Deduct quantity and adjust purchase price (branch-specific)
    selectedBranch.products[productIndex].quantity -= saleQuantity;
    const costOfSale = (selectedBranch.products[productIndex].purchasePrice / (selectedBranch.products[productIndex].quantity + saleQuantity)) * saleQuantity; // Calculate based on *original* quantity
    selectedBranch.products[productIndex].purchasePrice -= costOfSale;

    sales.push({
        date: new Date().toISOString(), // Store Dates with ISO
        branch: branchName,
        product: productName,
        quantity: saleQuantity,
        price: salePrice,
        customerPhone: customerPhone, // Add phone number to sale object
        details: details,
        user: currentUser.username,
        paymentMethod: paymentMethod, // Store the payment method
        customerDetails: customerDetails, // Store customer details
        type: 'sale' // ADDED: Mark as sale operation
    });

    await saveData();

    document.getElementById('sale-quantity').value = '';
    document.getElementById('sale-price').value = '';
    document.getElementById('customer-phone').value = ''; // Clear phone input
    document.getElementById('sale-details').value = '';
    document.getElementById('payment-method').value = 'نقدي'; // Reset to default
    document.getElementById('customer-details').value = ''; // Clear customer details
    populateProductSelect('sales');

    // Dispatch custom event to signal a sale has been recorded
    document.dispatchEvent(new CustomEvent('saleRecorded'));

    Swal.fire({
        title: 'تم',
        text: 'تم تسجيل عملية البيع بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}

function updateTargetDisplay() {
    if (!currentUser) return;

    let totalSales = 0;
    sales.forEach(sale => { // ONLY iterate over sales NOW
        if (sale.user === currentUser.username) {
            totalSales += parseFloat(sale.price);  // Make sure it number.
        }
    });

    const targetTableBody = document.querySelector('#target-table tbody');
    targetTableBody.innerHTML = ''; // Clear any existing rows
    const row = document.createElement('tr');
    row.innerHTML = `
       <td>${currentUser.username}</td>
     <td>${totalSales.toFixed(2)}</td>
     `;
    targetTableBody.appendChild(row);
}

function updateDailySalesTable() {
    if (!currentUser) return;

     //add this for options, To Local String
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };  // add this line, make it options.
    const today = new Date().toLocaleDateString('ar-EG', options); // make sure now format as now , formatted with options to get all values,
    const dailySalesTableBody = document.querySelector('#daily-sales-table tbody');
    dailySalesTableBody.innerHTML = '';

    let totalDailySales = 0; // Initialize total
    let dailySalesCount = 0; // Initialize total records of today

    // Load Today Sales and Workshop Operations
    const todaySalesAndWorkshop = [...sales, ...workshopOperations].filter(transaction => { // Combined array and filter
        const transactionDateFormatted = new Date(transaction.date).toLocaleDateString('ar-EG', options);
        return transaction.user === currentUser.username && transactionDateFormatted === today;
    });


    //if No Today Sales, Handle, And return from Function
    if (todaySalesAndWorkshop.length === 0) {
        const row = dailySalesTableBody.insertRow();
        row.innerHTML = `<td colspan="5"> لا يوجد مبيعات لهذا اليوم </td>`;
        return; // Return and stop, we dont need running.
    }
    //Sort TodaySales By newer First
    todaySalesAndWorkshop.sort((a, b) => new Date(b.date) - new Date(a.date));

    //Display and loop for todaySales
    for (const transaction of todaySalesAndWorkshop) { // Use (for..of) instead (for..in)
            const row = dailySalesTableBody.insertRow();
            let productName = '';
            if (transaction.type === 'sale') {
                productName = transaction.product;
                row.innerHTML += `<td>${productName}</td>`; // Product Name for Sales
                row.innerHTML += `<td>${transaction.quantity}</td>`;// Quantity For Sale
            } else if (transaction.type === 'workshop') {
                productName = 'خدمة ورشة'; // Or a more generic name if needed
                row.innerHTML += `<td>${productName}</td>`; // Generic product for workshop
                row.innerHTML += `<td> - </td>`; // No quantity for workshop
            }

            row.innerHTML += `<td>${transaction.price}</td>`;
            if (transaction.type === 'sale') {
                row.innerHTML += `<td>${transaction.details}</td>`; // Details for Sales
            } else if (transaction.type === 'workshop') {
                row.innerHTML += `<td>${transaction.description}</td>`; // Description for workshop
            }
            row.innerHTML += `<td>${transaction.paymentMethod}</td>`;


            dailySalesTableBody.appendChild(row); // I need add, any new insert
            totalDailySales += parseFloat(transaction.price);
            dailySalesCount++; // Increase when add new Record
    }
    const totalRow = dailySalesTableBody.insertRow(); // After Showing today records
    totalRow.innerHTML = `
     <td colspan="5">
         <strong> إجمالي مبيعات اليوم : ${totalDailySales.toFixed(2)} </strong>
        </td>`; // Display the count.
}

function populateBranchEmployeeSelect() {
    const employeeSelect = document.getElementById('employee-select');
    employeeSelect.innerHTML = '<option value="">اختر موظف</option>';

    const currentBranchName = document.getElementById('branch-select').value;
    if (!currentBranchName) {
        console.log("No branch selected yet."); // Debugging log
        return;
    }

    const currentBranch = branches.find(b => b.name === currentBranchName);
    if (!currentBranch) {
        console.log(`Branch ${currentBranchName} not found.`); // Debugging log
        return;
    }
    if (!currentBranch.users) {
        console.log(`No users in branch ${currentBranchName}.`); // Debugging log
        return;
    }

    currentBranch.users.forEach(username => {
        const user = users.find(u => u.username === username);
        if (user && user.role !== 'admin') { // Exclude admins from employee list
            const option = document.createElement('option');
            option.value = username;
            option.textContent = username;
            employeeSelect.appendChild(option);
        }
    });
    console.log("Employee dropdown populated."); // Debugging log
}

async function queryEmployeeDailySales() {
    const selectedEmployeeUsername = document.getElementById('employee-select').value;
    if (!selectedEmployeeUsername) {
        Swal.fire('تنبيه', 'يرجى اختيار موظف للاستعلام عن مبيعاته اليومية.', 'warning');
        return;
    }

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date().toLocaleDateString('ar-EG', options);
    const employeeDailySalesTableBody = document.querySelector('#employee-daily-sales-table tbody');
    employeeDailySalesTableBody.innerHTML = '';
    let totalEmployeeDailySales = 0;

    const todayEmployeeSales = sales.filter(sale => {
        const saleDateFormatted = new Date(sale.date).toLocaleDateString('ar-EG', options);
        return sale.user === selectedEmployeeUsername && saleDateFormatted === today;
    });

    if (todayEmployeeSales.length === 0) {
        employeeDailySalesTableBody.innerHTML = `<tr><td colspan="5">لا يوجد مبيعات للموظف المحدد اليوم.</td></tr>`;
        return;
    }

    todayEmployeeSales.sort((a, b) => new Date(b.date) - new Date(a.date));

    todayEmployeeSales.forEach(sale => {
        const row = employeeDailySalesTableBody.insertRow();
        row.insertCell(0).textContent = sale.product;
        row.insertCell(1).textContent = sale.quantity;
        row.insertCell(2).textContent = sale.price;
        row.insertCell(3).textContent = sale.details;
        row.insertCell(4).textContent = sale.paymentMethod;
        totalEmployeeDailySales += parseFloat(sale.price);
    });

    const totalRow = employeeDailySalesTableBody.insertRow();
    totalRow.innerHTML = `<td colspan="5"><strong>إجمالي مبيعات الموظف اليوم: ${totalEmployeeDailySales.toFixed(2)}</strong></td>`;
}