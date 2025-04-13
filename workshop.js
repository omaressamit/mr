// workshop.js

let lastWorkshopClickTime = 0; // NEW: Timestamp for workshop operations

async function recordWorkshopOperation() {
    if (!currentUser) {
        Swal.fire('خطأ', 'يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    const now = Date.now();
    if (now - lastWorkshopClickTime < 5000) {
        Swal.fire('خطأ', 'يرجى الانتظار 5 ثوانٍ قبل تسجيل عملية أخرى.', 'error');
        return;
    }
    lastWorkshopClickTime = now;

    const branchName = document.getElementById('workshop-branch-select').value;
    const description = document.getElementById('workshop-description').value.trim();
    const price = parseFloat(document.getElementById('workshop-price').value.trim());
    const customerPhone = document.getElementById('workshop-customer-phone').value.trim();
    const paymentMethod = document.getElementById('workshop-payment-method').value;
    const customerDetails = document.getElementById('workshop-customer-details').value.trim();


    if (!branchName || !description || isNaN(price) || !paymentMethod) {
        Swal.fire('خطأ', 'يرجى إدخال جميع الحقول المطلوبة والتأكد من صحة القيم', 'error');
        return;
    }

    if (price <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال السعر', 'error');
        return;
    }

    if (currentUser.role !== 'admin') {
        const selectedBranch = branches.find(b => b.name === branchName);
        if (!selectedBranch || !selectedBranch.users.includes(currentUser.username)) {
            Swal.fire('خطأ', 'غير مصرح لك بتسجيل عمليات لهذا الفرع', 'error');
            return;
        }
    }

    const newOperation = {
        date: new Date().toISOString(),
        branch: branchName,
        description: description,
        price: price,
        customerPhone: customerPhone,
        paymentMethod: paymentMethod,
        customerDetails: customerDetails,
        user: currentUser.username,
        type: 'workshop' // ADDED: Mark as workshop operation
    };

    workshopOperations.push(newOperation);
    await saveData();

    // Reset form fields
    document.getElementById('workshop-description').value = '';
    document.getElementById('workshop-price').value = '';
    document.getElementById('workshop-customer-phone').value = '';
    document.getElementById('workshop-payment-method').value = 'نقدي';
    document.getElementById('workshop-customer-details').value = '';

    document.dispatchEvent(new CustomEvent('workshopRecorded'));
    // Dispatch 'saleRecorded' event to update daily sales table on sales page
    document.dispatchEvent(new CustomEvent('saleRecorded')); // ADDED: Dispatch saleRecorded event

    Swal.fire({
        title: 'تم',
        text: 'تم تسجيل عملية الورشة بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}

function showWorkshopOperations() {
    const branchName = document.getElementById('workshop-branch-filter').value;
    const dateFromStr = document.getElementById('workshop-date-from').value; // << Get start date
    const dateToStr = document.getElementById('workshop-date-to').value;
    const container = document.getElementById('workshop-tables-container');

    // <<-- NEW VALIDATION -->>
    if (!dateFromStr) {
        Swal.fire('خطأ', 'يرجى تحديد تاريخ بداية الفترة للاستعلام.', 'error');
        // Hide container and clear content
        container.style.display = 'none';
        container.innerHTML = '';
        return; // Stop execution
    }
    // <<-- END VALIDATION -->>

    // Make container visible now that validation passed
    container.style.display = 'block';
    container.innerHTML = ''; // Clear previous tables


    const dateFrom = new Date(dateFromStr); // Safe now
    const dateTo = dateToStr ? new Date(dateToStr) : null;
    if (dateTo) {
        dateTo.setHours(23, 59, 59, 999); // End of day
    }

    // Use a local copy or filter directly
    const filteredOperations = workshopOperations.filter(operation => {
        // Basic check for valid operation and date
        if (!operation || !operation.date) return false;
        const operationDate = new Date(operation.date).getTime();

        // Branch Filter
        const branchMatch = !branchName || operation.branch === branchName;

        // Date Filter (dateFrom is guaranteed)
        const dateMatch = operationDate >= dateFrom.getTime() &&
                          (!dateTo || operationDate <= dateTo.getTime());

         // User Access Check (Only relevant if NO branch is selected in the filter)
         let userAccessMatch = true;
         if (!branchName && currentUser.role !== 'admin') {
             const operationBranch = branches.find(b => b.name === operation.branch);
             userAccessMatch = operationBranch && operationBranch.users.includes(currentUser.username);
         }

        return branchMatch && dateMatch && userAccessMatch;
    });


    if (filteredOperations.length === 0) {
        container.innerHTML = '<p>لا توجد عمليات ورشة مسجلة تطابق البحث.</p>'; // Updated message
        return;
    }

    const operationsByBranch = {};

    // Group filtered operations by branch
    filteredOperations.forEach(operation => {
        if (!operationsByBranch[operation.branch]) {
            operationsByBranch[operation.branch] = [];
        }
        operationsByBranch[operation.branch].push(operation);
    });


    let overallTotalPrice = 0; // For overall total

    // Create a table for each branch
    for (const currentBranchName in operationsByBranch) {
        // No need for user check here, already done in initial filter
        const branchOperations = operationsByBranch[currentBranchName];

        // Sort operations within the branch by date (newest first)
        branchOperations.sort((a, b) => new Date(b.date) - new Date(a.date));


        const tableWrapper = document.createElement('div');
        tableWrapper.classList.add('table-wrapper');
        const table = document.createElement('table');
        table.classList.add('workshop-table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        thead.innerHTML = `
            <tr>
                <th colspan="8" style="text-align: center; background-color: #4CAF50; color: white;">${currentBranchName}</th>
            </tr>
            <tr>
                <th>التاريخ</th>
                <th>وصف العملية</th>
                <th>السعر</th>
                <th>رقم هاتف العميل</th>
                <th>وسيلة الدفع</th>
                <th>بيانات العميل</th>
                <th>المستخدم</th>
                <th></th>
            </tr>
        `;
        table.appendChild(thead);
        table.appendChild(tbody);

        let totalBranchPrice = 0;

        branchOperations.forEach(operation => {
            const row = document.createElement('tr');
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            const formattedDate = new Date(operation.date).toLocaleDateString('ar-EG', options);
            const price = parseFloat(operation.price || 0); // Ensure price is number

            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = "تعديل";
            editBtn.classList.add('edit-btn');
            editBtn.onclick = () => editWorkshopOperation(operation);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'حذف';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => deleteWorkshopOperation(operation);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${operation.description}</td>
                <td>${price.toFixed(2)}</td>
                <td>${operation.customerPhone || ''}</td>
                <td>${operation.paymentMethod}</td>
                <td>${operation.customerDetails || ''}</td>
                <td>${operation.user}</td>
            `;
            row.appendChild(actionsCell);

            tbody.appendChild(row);
            totalBranchPrice += price;
            overallTotalPrice += price; // Accumulate overall total
        });

         // Add total row for the branch
        const totalRow = document.createElement('tr');
        totalRow.innerHTML = `
            <td colspan="8" style="text-align: center; background-color: #8bc34a;">
                <strong>إجمالي سعر الورشة للفرع: ${totalBranchPrice.toFixed(2)} جنيه</strong>
            </td>
        `;
        tbody.appendChild(totalRow);


        tableWrapper.appendChild(table);
        container.appendChild(tableWrapper);

    }
    // Add Overall Total Row if multiple branches were displayed or if only one branch filtered
     if (Object.keys(operationsByBranch).length > 0) {
        const overallTotalRow = document.createElement('tr');
        overallTotalRow.innerHTML = `
            <td colspan="8" style="text-align: center; background-color: #2196f3; color: white; font-weight: bold;">
                إجمالي سعر عمليات الورشة للفترة المحددة: ${overallTotalPrice.toFixed(2)} جنيه
            </td>
        `;
        // Append to the last table's tbody or directly to container? Appending to container might be simpler visually.
         const lastTable = container.querySelector('.workshop-table:last-of-type');
         if(lastTable) {
             lastTable.appendChild(overallTotalRow); // Append to last table
         } else {
             // Fallback if no table found (shouldn't happen if keys > 0)
              container.innerHTML += `<div style="text-align: center; background-color: #2196f3; padding: 10px; margin-top: 10px; color: white; font-weight: bold;">إجمالي سعر عمليات الورشة للفترة المحددة: ${overallTotalPrice.toFixed(2)} جنيه</div>`;
         }
    }
}

// **وظيفة جديدة لتهيئة صفحة الورشة**
function updateWorkshopPage() {
    updateBranchSelect('workshop-branch-select'); // لملء قائمة الفروع لإضافة عملية جديدة
    updateBranchSelect('workshop-branch-filter'); // لملء قائمة الفروع في الفلاتر
    document.getElementById('workshop-tables-container').style.display = 'none'; // **إخفاء الجدول عند تحميل الصفحة**
}


async function editWorkshopOperation(operation) { //get expense all data

    const { value: updateOperation } = await Swal.fire({
        title: "تعديل العملية",
        html: // Add All Data and Details
            `<label>الفرع</label>` +
            `<input id="swal-input-branch" class="swal2-input" value="${operation.branch}" readonly>` +
            `<label>وصف العملية</label>` +
            `<textarea id = "swal-input-desc" class="swal2-textarea">${operation.description}</textarea>` +
            `<label>  السعر</label>`+
            `<input id="swal-input-price" class="swal2-input" value="${operation.price}" type="number">` +
            `<label>رقم هاتف العميل</label>`+
            `<input id="swal-input-phone" class="swal2-input" value = "${operation.customerPhone}" >` +
            `<label for="swal-input-payment">وسيلة الدفع:</label>
            <select id="swal-input-payment" class="swal2-select">
                <option value="نقدي" ${operation.paymentMethod === 'نقدي' ? 'selected' : ''}>نقدي</option>
                <option value="فيزا" ${operation.paymentMethod === 'فيزا' ? 'selected' : ''}>فيزا</option>
                <option value="انستاباي" ${operation.paymentMethod === 'انستاباي' ? 'selected' : ''}>انستاباي</option>
            </select>`+
            `<label> بيانات العميل</label>`+
            `<textarea id="swal-input-details" class="swal2-textarea">${operation.customerDetails}</textarea>`,
        focusConfirm: false,

        preConfirm: () => {
            const price = parseFloat(document.getElementById('swal-input-price').value); // Convert to number
            const description = document.getElementById('swal-input-desc').value;
            const customerPhone = document.getElementById('swal-input-phone').value;
            const paymentMethod = document.getElementById('swal-input-payment').value;
            const customerDetails = document.getElementById('swal-input-details').value;

            //validation data amount value:
            if (isNaN(price) || price <= 0) {  //Check  and
                Swal.showValidationMessage("يرجي إدخال قيم صحيحة للمصروف");

            }
            return { price, description, customerPhone, paymentMethod, customerDetails } //return other amount, desc. , other the same and its read-only no updated.

        }
    });
    //if the condition in fire is confirmed , means update data to current .
    if (updateOperation) {  //check
        const operationIndex = workshopOperations.findIndex(op => op.date === operation.date && op.user === operation.user)

        if (operationIndex !== -1) { //if this user, it saved: , found with these properties: data,user
            //Update Values to
            workshopOperations[operationIndex] = {  //retreive expenses
                ...workshopOperations[operationIndex], //to ensure and return branchExpense the old is existing with new data added .
                price: updateOperation.price,
                description: updateOperation.description,
                customerPhone: updateOperation.customerPhone,
                paymentMethod: updateOperation.paymentMethod,
                customerDetails: updateOperation.customerDetails

            }
            await saveData(); //

            document.dispatchEvent(new CustomEvent('workshopRecorded'));
            Swal.fire('تم', "تم تحديث العملية بنجاح", 'success');

        }
    }
}
async function deleteWorkshopOperation(operation) { //delete

    const confirm = await Swal.fire({
        title: "تأكيد الحذف",
        text: "هل تريد حذف العملية",
        icon: 'warning', // Change to warning.
        confirmButtonText: "نعم , احذف", //
        cancelButtonText: "إلغاء",
        showCancelButton: true,
        confirmButtonColor: '#d33',

    })
    //   expenses
    if (confirm.isConfirmed) {  //when deleted
        const operationIndex = workshopOperations.findIndex(op => op.date === operation.date && op.user === operation.user) //same conditon to ensured .

        if (operationIndex != -1) {
            workshopOperations.splice(operationIndex, 1); //delete specific values

            await saveData();
            document.dispatchEvent(new CustomEvent('workshopRecorded'));
            Swal.fire('تم الحذف', 'تم حذف العملية بنجاح', 'success'); //

        }

    }
}