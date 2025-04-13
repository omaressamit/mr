// --- receiving.js ---

let lastReceiveClickTime = 0; // Initialize timestamp for receiving

async function recordReceiving() {
    if (!currentUser) {
        Swal.fire('خطأ', 'يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    // Double-click prevention (5 seconds)
    const now = Date.now();
    if (now - lastReceiveClickTime < 5000) {
        Swal.fire('خطأ', 'يرجى الانتظار 5 ثوانٍ قبل تسجيل استلام بضاعة آخر.', 'error');
        return;
    }
    lastReceiveClickTime = now; // Update timestamp


    const branchName = document.getElementById('receiving-branch-select').value;
    const productName = document.getElementById('receive-product-select').value.trim();
    const quantity = parseFloat(document.getElementById('receive-quantity').value.trim());
    const purchasePrice = parseFloat(document.getElementById('purchase-price').value.trim());
    const supplierName = document.getElementById('supplier-name').value.trim();


    if (!branchName || !productName || !quantity || !purchasePrice || !supplierName) {
        Swal.fire('خطأ', 'يرجى إدخال جميع الحقول المطلوبة', 'error');
        return;
    }

    if (isNaN(quantity) || quantity <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال كمية صحيحة (عدد أكبر من صفر)', 'error');
        return;
    }

    if (isNaN(purchasePrice) || purchasePrice <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال سعر شراء صحيح (عدد أكبر من صفر)', 'error');
        return;
    }
    const selectedBranch = branches.find(b => b.name === branchName);
    if (!selectedBranch) {
        Swal.fire('خطأ', 'الفرع غير موجود', 'error');
        return;
    }
    // Ensure that the branch has a products array
    selectedBranch.products = selectedBranch.products || [];

    // Find the product index within the selected branch
    const productIndex = selectedBranch.products.findIndex(p => p.name === productName);

    if (productIndex === -1) {
        // Product doesn't exist in the branch, add as new
        selectedBranch.products.push({
            name: productName,
            quantity: quantity,
            purchasePrice: quantity * purchasePrice, // Initial purchase price
        });
    } else {
        // Product exists, update quantity and purchase price.
        let previousTotalCost = selectedBranch.products[productIndex].purchasePrice;
        if (isNaN(previousTotalCost)) {
            previousTotalCost = 0;
        }
        selectedBranch.products[productIndex].purchasePrice = previousTotalCost + (quantity * purchasePrice);
        selectedBranch.products[productIndex].quantity += quantity;
    }

    receiving.push({
        date: new Date().toISOString(), // ISO 8601 format
        branch: branchName,
        product: productName,
        quantity: quantity,
        purchasePrice: purchasePrice,
        supplierName: supplierName,
        user: currentUser.username
    });

    await saveData();
    // Clear fields after successfully received.
    document.getElementById('receive-quantity').value = '';
    document.getElementById('purchase-price').value = '';
    document.getElementById('supplier-name').value = '';

    populateProductSelect('receiving'); //update this dropdown

    // Dispatch a custom event
    document.dispatchEvent(new CustomEvent('receivingRecorded'));

    Swal.fire({
        title: 'تم',
        text: 'تم تسجيل الاستلام بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}

// RENAMED to showPurchases, and now handles filtering
function showPurchases() {
    if (!currentUser) return;

    const branchName = document.getElementById('receiving-branch-filter').value;
    const dateFromStr = document.getElementById('receiving-date-from').value; // << Get start date
    const dateToStr = document.getElementById('receiving-date-to').value;
    const purchasesList = document.getElementById('purchases-list'); // Target the tbody
    const purchasesTableWrapper = purchasesList.closest('.table-wrapper'); // Find the parent wrapper

    // <<-- NEW VALIDATION -->>
    if (!dateFromStr) {
        Swal.fire('خطأ', 'يرجى تحديد تاريخ بداية الفترة للاستعلام.', 'error');
        // Hide the table and prevent further processing
        if(purchasesTableWrapper) purchasesTableWrapper.style.display = 'none'; // Hide wrapper
        purchasesList.innerHTML = ''; // Clear table body
        return; // Stop execution
    }
    // <<-- END VALIDATION -->>

    // Make wrapper visible now that validation passed
    if(purchasesTableWrapper) purchasesTableWrapper.style.display = 'block';


    const dateFrom = new Date(dateFromStr); // Can create Date object now
    const dateTo = dateToStr ? new Date(dateToStr) : null;

    if (dateTo) {
        dateTo.setHours(23, 59, 59, 999);  // End of day
    }

    purchasesList.innerHTML = ''; // Clear previous results

    let totalPurchaseCost = 0; // Renamed for clarity: This is the total cost
    let totalQuantityReceived = 0; // To track total quantity

    const filteredReceiving = receiving.filter(receive => {
        const receiveDate = new Date(receive.date).getTime();

        // <<-- CORRECTED Branch Filtering Logic -->>
        // Filter by selected branch if one is chosen (applies to admin too)
        // If no branch is selected (''), admin sees all, user sees assigned branches (though filter likely covers this)
        const branchMatch = !branchName || receive.branch === branchName;

        // User Access Check (Only relevant if NO branch is selected in the filter)
        let userAccessMatch = true;
        if (!branchName && currentUser.role !== 'admin') {
             // Find if the user is assigned to the branch of *this* receiving record
             const receivingBranch = branches.find(b => b.name === receive.branch);
             userAccessMatch = receivingBranch && receivingBranch.users.includes(currentUser.username);
        }


        const dateMatch = receiveDate >= dateFrom.getTime() && // dateFrom is guaranteed now
                          (!dateTo || receiveDate <= dateTo.getTime());

        return branchMatch && userAccessMatch && dateMatch; // Combine all checks
    });


     if(filteredReceiving.length === 0){
         purchasesList.innerHTML = '<tr><td colspan="8">لا توجد سجلات مشتريات مطابقة للبحث.</td></tr>'; // Updated message, colspan=8
          // Keep table wrapper visible to show the message
          return;
     }

    // Sort by date (newest first) *after* filtering
    filteredReceiving.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredReceiving.forEach(receive => {
         const options = { year: 'numeric', month: 'long', day: 'numeric' };
         const formattedDate = new Date(receive.date).toLocaleDateString('ar-EG', options);
         const quantity = parseFloat(receive.quantity || 0);
         const pricePerUnit = parseFloat(receive.purchasePrice || 0); // This is price per unit (gram?)
         const cost = quantity * pricePerUnit; // Calculate actual cost for this record

         const row = purchasesList.insertRow();
         // Add edit/delete
         const actionsCell = document.createElement('td');
         const editBtn = document.createElement('button');
         editBtn.textContent = 'تعديل';
         editBtn.classList.add('edit-btn');
         editBtn.onclick = () => editReceiving(receive);

         const deleteBtn = document.createElement('button');
         deleteBtn.textContent = 'حذف';
         deleteBtn.classList.add('delete-btn');
         deleteBtn.onclick = () => deleteReceiving(receive);

         actionsCell.appendChild(editBtn);
         actionsCell.appendChild(deleteBtn);
         row.insertCell(0).textContent = formattedDate;
         row.insertCell(1).textContent = receive.branch;
         row.insertCell(2).textContent = receive.product;
         row.insertCell(3).textContent = quantity.toFixed(2) + " جرام"; // Format quantity
         row.insertCell(4).textContent = pricePerUnit.toFixed(2); // Format price per unit
         row.insertCell(5).textContent = receive.supplierName;
         row.insertCell(6).textContent = receive.user;
         row.appendChild(actionsCell); // Append actions cell last

         totalPurchaseCost += cost; // Accumulate total cost
         totalQuantityReceived += quantity; // Accumulate total quantity

    });

    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.innerHTML = `
        <td colspan="8" style="text-align: center; background-color: #8bc34a;">
            <strong>إجمالي الكمية المستلمة: ${totalQuantityReceived.toFixed(2)} جرام | إجمالي تكلفة الشراء: ${totalPurchaseCost.toFixed(2)} جنيه</strong>
        </td>
    `; // Updated total row content, colspan=8
    purchasesList.appendChild(totalRow);
}
async function editReceiving(receive) {
    const { value: updatedReceiving } = await Swal.fire({
        title: 'تعديل بيانات استلام',
        html:
            `<label>الفرع</label>` +
            `<input id="swal-input1" class="swal2-input"  value="${receive.branch}" readonly>` +
            `<label>الصنف</label>` +
            `<input id="swal-input2" class="swal2-input" value="${receive.product}" readonly>` +
            `<label>الكمية</label>` +
            `<input id="swal-input3" class="swal2-input" type="number" step="0.01" value="${receive.quantity}">` +
            `<label>سعر الشراء</label>` +
            `<input id="swal-input4" class="swal2-input" type="number" value="${receive.purchasePrice}">` +
            `<label>اسم المورد</label>` +
            `<input id="swal-input5" class="swal2-input" value="${receive.supplierName}">`, // Keep supplier
        focusConfirm: false,

        preConfirm: () => {
            const quantity = parseFloat(document.getElementById('swal-input3').value);
            const purchasePrice = parseFloat(document.getElementById('swal-input4').value);
            const supplierName = document.getElementById('swal-input5').value;
            if (isNaN(quantity) || quantity <= 0 || isNaN(purchasePrice) || purchasePrice <= 0) {
                Swal.showValidationMessage('يرجى إدخال قيم صحيحة للكمية والسعر'); // Corrected typo
            }
            return { quantity, purchasePrice, supplierName } //return new edits.
        }

    });

    if (updatedReceiving) { // after Edit

        // Find using date AND user (more robust than index).
        const receiveIndex = receiving.findIndex(r => r.date === receive.date && r.user === receive.user); //Find
        if (receiveIndex !== -1) {
            // Locate the relevant branch and product for updating quantities

            const originalBranch = branches.find(b => b.name === receiving[receiveIndex].branch); //find receiving
            const originalProduct = originalBranch.products.find(p => p.name === receiving[receiveIndex].product);  //prouduct of receiving

            originalProduct.quantity -= parseFloat(receiving[receiveIndex].quantity); //remove exist first ,and return old data

            const originalTotalCost = (originalProduct.purchasePrice / (originalProduct.quantity + parseFloat(receiving[receiveIndex].quantity))) * parseFloat(receiving[receiveIndex].quantity); // purchasesPrices, when change quantity change pruchases, price
            originalProduct.purchasePrice -= originalTotalCost;// update purchesesPrice
            //Then UPdate All receiving values.
            receiving[receiveIndex] = {
                ...receiving[receiveIndex],
                quantity: updatedReceiving.quantity,
                purchasePrice: updatedReceiving.purchasePrice,
                supplierName: updatedReceiving.supplierName  //keep exist value if not updated ,

            };
            //THen Added And Calculate the  Quantity, and, purchases,price New Vlaues.
            originalProduct.quantity += parseFloat(receiving[receiveIndex].quantity);  // add New
            const newTotalCost = (originalProduct.purchasePrice / (originalProduct.quantity - parseFloat(receiving[receiveIndex].quantity))) * parseFloat(receiving[receiveIndex].quantity) // added pur
            originalProduct.purchasePrice += newTotalCost // sum new purchases price

            await saveData(); //save data
            populateProductSelect('sales') // to be consistent data of product sales and all
            populateProductSelect('returns');
            populateProductSelect('receiving');
            populateProductSelect('scrap');
            updateProductsTable();  //Refresh tables
            showPurchases();  //To Appear to User any edits
            Swal.fire('تم', 'تم تحديث بيانات الاستلام بنجاح', 'success') //Fire to
        }

    }
}

async function deleteReceiving(receive) { //to handle delete receiving and reutrn previous, and after deleted return products data
    const confirm = await Swal.fire({
        title: "تأكيد الحذف",
        text: "هل أنت متأكد من حذف بيانات الاستلام هذه؟",
        icon: 'warning',
        showCancelButton: true, // Add other.
        confirmButtonText: "نعم , احذف",
        cancelButtonText: "إلغاء"
    });

    if (confirm.isConfirmed) { // Delete Purchases if exist.
        //Find using date, and , user , to ensure correctly deleted from array, (more accurate way, instead using find index of receivings.)
        const receiveIndex = receiving.findIndex(r => r.date === receive.date && r.user == receive.user);

        if (receiveIndex != -1) { //check exist
            const branch = branches.find(b => b.name == receiving[receiveIndex].branch);
            const product = branch.products.find(p => p.name === receiving[receiveIndex].product);
            product.quantity -= parseFloat(receiving[receiveIndex].quantity);  // return products quantity when delete it
            const costOfPurchase = (product.purchasePrice / (product.quantity +  parseFloat(receiving[receiveIndex].quantity)) ) * parseFloat(receiving[receiveIndex].quantity);

            product.purchasePrice -= costOfPurchase //recalculate purchases
            //Then splice and deleted receive Index , from List.
            receiving.splice(receiveIndex , 1);
            await saveData();
            populateProductSelect('sales')
            populateProductSelect('returns');
            populateProductSelect('receiving');
            populateProductSelect('scrap');
            updateProductsTable();// Refresh
            document.dispatchEvent(new CustomEvent('receivingDeleted'));  //Dispacth

            Swal.fire('تم الحذف' , 'تم حذف بيانات الاستلام بنجاح' , 'success');

        }
    }
}

//Added this function to
function updateReceivingPage(){
     updateBranchSelect('receiving-branch-filter');
     //Added this to consistent
    const branchSelect = document.getElementById('receiving-branch-select'); //for default selected, on products ,
    const productSelect = document.getElementById('receive-product-select'); //for product

    productSelect.innerHTML = '<option value=""> اختر الصنف</option>';

    branchSelect.addEventListener('change' , ()=>{ //when select other branch change, update products

        const selectedBranch = branches.find(b=> b.name === branchSelect.value); //find Branch
        if(selectedBranch && selectedBranch.products){ //if selected

            selectedBranch.products.forEach(product =>{
                const option = document.createElement('option');
                option.textContent = product.name;
                option.value = product.name;
                productSelect.appendChild(option);
            });
        }

    });
}