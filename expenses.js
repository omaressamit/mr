// --- expenses.js ---

async function recordExpense() {
    // if (!currentUser || currentUser.role !== 'admin') { // REMOVE THIS CHECK
    if (!currentUser) { // Keep only user check login.
        Swal.fire('خطأ', 'يجب تسجيل الدخول لتسجيل المصروفات', 'error'); // Changed message slightly
        return;
    }

    const branchName = document.getElementById('expense-branch-select').value;
    const expenseType = document.getElementById('expense-type').value;
    const amount = parseFloat(document.getElementById('expense-amount').value.trim());
    const description = document.getElementById('expense-description').value.trim();

    if (!branchName || !expenseType || isNaN(amount) || amount <= 0) {
        Swal.fire('خطأ', 'يرجى ملء جميع الحقول المطلوبة والتأكد من إدخال قيمة صحيحة للمصروف', 'error');
        return;
    }
    let expenseData = {
        date: new Date().toISOString(),
        branch: branchName,
        expenseType: expenseType,
        amount: amount,
        description: description,
        user: currentUser.username // User who recorded the expense
    };

    // Handle 'مرتبات' specific fields
    if (expenseType === 'مرتبات') {
        // Ensure only admin can record salaries
        if (currentUser.role !== 'admin') {
             Swal.fire('خطأ', 'فقط المسؤول يمكنه تسجيل مصروفات المرتبات', 'error');
             return;
        }
        const expenseUser = document.getElementById('expense-user-select').value;

        if (!expenseUser) {
            Swal.fire('خطأ', 'يرجى اختيار المستخدم للمرتب', 'error');
            return;
        }
        expenseData.expenseUser = expenseUser; // User receiving the salary
    }
    // Handle 'شراء فضة كسر' specific fields
    else if (expenseType === "شراء فضة كسر") {
        const scrapType = document.getElementById('expense-scrap-type').value; // Now a select
        const scrapQuantity = parseFloat(document.getElementById('expense-scrap-quantity').value);

        if (!scrapType || isNaN(scrapQuantity) || scrapQuantity <= 0) {
            Swal.fire('خطأ', "يرجى إدخال بيانات صحيحة لنوع وكمية الكسر", 'error');
            return;
        }
        //----  ADD PRODUCT QUANTITY UPDATES HERE ----
        const selectedBranch = branches.find(b => b.name === branchName);
        if (!selectedBranch) {
            Swal.fire('خطأ', 'الفرع المحدد غير موجود', 'error'); // More specific error
            return;
        }
        // Ensure products array exists
        selectedBranch.products = selectedBranch.products || [];

        // Find Product by selected scrap Type
        const productIndex = selectedBranch.products.findIndex(p => p.name === scrapType);
        if (productIndex === -1) {
             Swal.fire('خطأ', `الصنف '${scrapType}' غير موجود في فرع '${branchName}'`, 'error'); // More specific error
             return;
        }

        // Update quantity and purchase price (Total Cost)
        selectedBranch.products[productIndex].quantity += scrapQuantity;
        // Here 'amount' is the total cost paid for the scrap, NOT price per gram.
        // The total purchase price for the product should increase by the total amount paid.
        let currentTotalCost = selectedBranch.products[productIndex].purchasePrice || 0;
        if (isNaN(currentTotalCost)) { currentTotalCost = 0; } // Sanity check
        selectedBranch.products[productIndex].purchasePrice = currentTotalCost + amount; // Add the total expense amount

        // Store scrap details in the expense record
        expenseData.scrapType = scrapType;
        expenseData.scrapQuantity = scrapQuantity;
        // --- END OF PRODUCT QUANTITY UPDATES ---
    }

    // Add expense to the correct branch in the expenses object
    if (!expenses[branchName]) {
        expenses[branchName] = []; // Initialize array for the branch if it doesn't exist
    }
    expenses[branchName].push(expenseData);

    await saveData(); // Persist data

    // Reset the form
    document.getElementById('expense-branch-select').value = '';
    document.getElementById('expense-type').value = 'أخرى'; // Reset type select
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-description').value = '';

    // Reset and hide conditional fields
    document.getElementById('expense-user-div').style.display = 'none';
    document.getElementById('expense-scrap-fields').style.display = 'none';
    document.getElementById('expense-user-select').value = '';
    document.getElementById('expense-scrap-type').value = '';
    document.getElementById('expense-scrap-quantity').value = '';

    document.getElementById('expense-branch-select').focus(); // Set focus back to branch select

    // Dispatch events for UI updates
    document.dispatchEvent(new CustomEvent('expenseRecorded')); // To refresh the expense list
    if (expenseType === "شراء فضة كسر") {
        document.dispatchEvent(new CustomEvent('productAdded')); // To refresh product tables if scrap was bought
    }

    Swal.fire({
        title: 'تم',
        text: 'تم تسجيل المصروف بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}

// Handles visibility of specific form fields based on expense type
function updateExpenseForm() {
    const expenseType = document.getElementById('expense-type').value;
    const userSelectDiv = document.getElementById('expense-user-div');
    const scrapFields = document.getElementById('expense-scrap-fields');
    const branchSelect = document.getElementById('expense-branch-select'); // Get Branch select element

    // Hide all conditional sections initially
    userSelectDiv.style.display = 'none';
    scrapFields.style.display = 'none';

    if (expenseType === "مرتبات") {
        // Show salary fields ONLY if the logged-in user is admin
        if (currentUser && currentUser.role === 'admin') {
            userSelectDiv.style.display = 'block';
            populateUserSelect(); // Populate the user dropdown
        } else {
             // If not admin, reset the selection to 'أخرى' to prevent recording salary
             document.getElementById('expense-type').value = 'أخرى';
             // Optionally show a message:
             // Swal.fire('تنبيه', 'فقط المسؤول يمكنه تسجيل مصروفات المرتبات.', 'warning');
        }
    } else if (expenseType === "شراء فضة كسر") {
        scrapFields.style.display = 'block';
        // Populate the scrap type select with products from the selected branch
        const selectedBranchName = branchSelect.value;
        const scrapTypeSelect = document.getElementById('expense-scrap-type');
        scrapTypeSelect.innerHTML = '<option value="">اختر الصنف</option>'; // Default option

        if (selectedBranchName) {
            const selectedBranch = branches.find(b => b.name === selectedBranchName);
            if (selectedBranch && selectedBranch.products) {
                selectedBranch.products.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.name;
                    option.textContent = product.name;
                    scrapTypeSelect.appendChild(option);
                });
            }
        } else {
            // Optionally disable or show a message if no branch is selected
            scrapTypeSelect.innerHTML = '<option value="">اختر الفرع أولاً</option>';
        }
    }
    // No specific action needed for 'أخرى' as conditional fields are hidden by default
}

// Populates the user select dropdown for salary expenses
function populateUserSelect() {
    const userSelect = document.getElementById('expense-user-select');
    userSelect.innerHTML = "<option value=''>اختر المستخدم</option>"; // Default empty option

    if (typeof users !== 'undefined' && Array.isArray(users)) {
        users.forEach(user => {
            // Only include non-admin users as options for receiving salary
            if (user.role !== 'admin') {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.username;
                userSelect.appendChild(option);
            }
        });
    }
}

// Displays the list of expenses based on filters
function showExpenses() {
    if (!currentUser) return; // Should not happen if login check is everywhere, but good practice

    // Get filter values
    const branchNameFilter = document.getElementById('expenses-branch-filter').value;
    const dateFromStr = document.getElementById('expenses-date-from').value;
    const dateToStr = document.getElementById('expenses-date-to').value;
    const searchTerm = document.getElementById('search-expenses').value.trim().toLowerCase();

    // Get UI elements
    const expensesListTbody = document.getElementById('expenses-list'); // Target tbody
    const expensesTableWrapper = document.getElementById('expenses-table-wrapper');

    // Date From validation is crucial for filtering
    if (!dateFromStr) {
        Swal.fire('خطأ', 'يرجى تحديد تاريخ بداية الفترة لعرض المصروفات.', 'error');
        // Hide table and clear content if no start date
        if(expensesTableWrapper) expensesTableWrapper.style.display = 'none';
        expensesListTbody.innerHTML = '';
        return; // Stop execution
    }

    // Make table wrapper visible now that validation passed
    if(expensesTableWrapper) expensesTableWrapper.style.display = 'block';

    // Prepare dates for comparison
    const dateFrom = new Date(dateFromStr);
    dateFrom.setHours(0, 0, 0, 0); // Start of the day
    const dateTo = dateToStr ? new Date(dateToStr) : null;
    if (dateTo) {
        dateTo.setHours(23, 59, 59, 999); // End of the day
    }

    expensesListTbody.innerHTML = ''; // Clear previous results before adding new ones

    let overallTotalExpensesAmount = 0; // Accumulator for the grand total expense amount
    let overallTotalScrapQuantity = 0;  // Accumulator for the grand total scrap quantity

    // Iterate through each branch in the expenses object
    for (const currentBranchName in expenses) {
        // Ensure it's a property of the object and not from the prototype chain
        if (expenses.hasOwnProperty(currentBranchName)) {

            // --- Filtering Logic ---
            // 1. Branch Filter: Match selected branch OR show all if no branch is selected
            const branchFilterMatch = !branchNameFilter || currentBranchName === branchNameFilter;

            // 2. User Access Filter: If no specific branch is filtered, non-admins only see their assigned branches
            let userAccessMatch = true;
            if (!branchNameFilter && currentUser.role !== 'admin') {
                 const expenseBranchData = branches.find(b => b.name === currentBranchName);
                 // User must be listed in the users array of the branch
                 userAccessMatch = expenseBranchData && expenseBranchData.users && expenseBranchData.users.includes(currentUser.username);
            }

            // Proceed only if branch filter and user access match, and the branch has expenses
             if (branchFilterMatch && userAccessMatch && Array.isArray(expenses[currentBranchName])) {
                const branchExpensesRaw = expenses[currentBranchName];

                // 3. Date and Search Term Filter
                const filteredBranchExpenses = branchExpensesRaw.filter(expense => {
                    // Basic check for valid expense object and date
                    if (!expense || !expense.date) return false;

                    let expenseDate;
                    try {
                         expenseDate = new Date(expense.date);
                         if (isNaN(expenseDate.getTime())) return false; // Invalid date check
                    } catch (e) { return false; }


                    // Date Check: Compare expense date with filter range
                    const dateMatch = expenseDate.getTime() >= dateFrom.getTime() &&
                                      (!dateTo || expenseDate.getTime() <= dateTo.getTime());

                    // Search Term Check: Match against various fields (case-insensitive)
                     // Using optional chaining (?.) for safety in case properties are missing
                    const searchMatch = !searchTerm || (
                        expense.expenseType?.toLowerCase().includes(searchTerm) ||
                        expense.description?.toLowerCase().includes(searchTerm) ||
                        expense.branch?.toLowerCase().includes(searchTerm) ||
                        (expense.expenseUser && expense.expenseUser.toLowerCase().includes(searchTerm)) || // User associated with salary
                        (expense.scrapType && expense.scrapType.toLowerCase().includes(searchTerm)) || // Scrap type
                        expense.amount?.toString().toLowerCase().includes(searchTerm) || // Amount as string
                        (expense.scrapQuantity && expense.scrapQuantity.toString().toLowerCase().includes(searchTerm)) // Scrap quantity as string
                    );

                    // Expense must match both date and search criteria
                    return dateMatch && searchMatch;
                });

                // If there are expenses for this branch after filtering, display them
                if (filteredBranchExpenses.length > 0) {
                    let branchTotalAmount = 0; // Total amount for this specific branch
                    let branchTotalScrap = 0;  // Total scrap quantity for this specific branch

                    // Add a header row for the branch
                    const branchHeaderRow = expensesListTbody.insertRow();
                    branchHeaderRow.innerHTML = `<td colspan="8" style="background-color: #4CAF50; color: white; text-align: center; font-weight: bold;">${currentBranchName}</td>`;

                    // Sort expenses within the branch by date (newest first)
                    filteredBranchExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

                    // --- Create Table Rows for Each Expense ---
                    filteredBranchExpenses.forEach(expense => {
                        const row = expensesListTbody.insertRow();
                        const options = { year: 'numeric', month: 'long', day: 'numeric' };
                        let formattedDate = 'تاريخ غير صالح';
                        try { formattedDate = new Date(expense.date).toLocaleDateString('ar-EG', options); } catch(e){}

                        const amount = parseFloat(expense.amount || 0); // Ensure amount is a number, default to 0
                        const scrapQuantity = parseFloat(expense.scrapQuantity || 0); // Ensure scrap quantity is a number

                        // --- Populate Cells ---
                        row.insertCell(0).textContent = formattedDate;
                        row.insertCell(1).textContent = expense.branch;
                         // Display the expense type ('مرتبات', 'شراء فضة كسر', 'أخرى', etc.)
                        row.insertCell(2).textContent = expense.expenseType;
                         // Display the user if it's a salary expense, otherwise empty
                        row.insertCell(3).textContent = expense.expenseUser || ''; // Shows user for salaries
                         // Display scrap details only if the type is 'شراء فضة كسر'
                        const scrapQuantityDisplay = (expense.expenseType === 'شراء فضة كسر' && expense.scrapType && !isNaN(scrapQuantity))
                                                     ? `${expense.scrapType} - ${scrapQuantity.toFixed(2)} جرام`
                                                     : ''; // Show scrap type and quantity or empty
                        row.insertCell(4).textContent = scrapQuantityDisplay;
                        row.insertCell(5).textContent = amount.toFixed(2); // Format amount to 2 decimal places
                        row.insertCell(6).textContent = expense.description;

                         // Actions Cell (Edit/Delete)
                        const actionsCell = row.insertCell(7); // Add cell at the end
                        const editBtn = document.createElement('button');
                        editBtn.textContent = "تعديل";
                        editBtn.classList.add('edit-btn');
                        // Pass the expense object and branch name for context
                        editBtn.onclick = () => editExpense(expense, currentBranchName);
                        actionsCell.appendChild(editBtn);

                        const deleteBtn = document.createElement('button');
                        deleteBtn.textContent = 'حذف';
                        deleteBtn.classList.add('delete-btn');
                        // Pass the expense object and branch name for context
                        deleteBtn.onclick = () => deleteExpense(expense, currentBranchName);
                        actionsCell.appendChild(deleteBtn);


                        // Accumulate totals for the branch
                        branchTotalAmount += amount;
                        if (expense.expenseType === 'شراء فضة كسر' && !isNaN(scrapQuantity)) {
                            branchTotalScrap += scrapQuantity;
                        }
                    });

                    // Add a total row for the branch
                    const branchTotalRow = expensesListTbody.insertRow();
                    let branchTotalHTML = `<strong>إجمالي مصروفات ${currentBranchName}: ${branchTotalAmount.toFixed(2)} جنيه</strong>`;
                    if (branchTotalScrap > 0) {
                         branchTotalHTML += ` | <strong>إجمالي وزن الكسر: ${branchTotalScrap.toFixed(2)} جرام</strong>`;
                    }
                    branchTotalRow.innerHTML = `<td colspan="8" style="text-align: center; background-color: #8bc34a;">${branchTotalHTML}</td>`;

                    // Accumulate overall totals
                    overallTotalExpensesAmount += branchTotalAmount;
                    overallTotalScrapQuantity += branchTotalScrap;
                }
             }
        }
    }

    // --- Final Check and Summary ---
    // Check if any rows were added to the table body
    if (expensesListTbody.rows.length === 0) {
        // If no rows were added at all (not even branch headers)
         expensesListTbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">لا توجد بيانات مصروفات للعرض تطابق الفلاتر المحددة.</td></tr>';
    } else {
        // If rows exist, add the overall total row
        const overallTotalRow = expensesListTbody.insertRow();
        let overallTotalHTML = `<strong> إجمالي المصروفات الكلي: ${overallTotalExpensesAmount.toFixed(2)} جنيه </strong>`;
        if (overallTotalScrapQuantity > 0) {
             overallTotalHTML += ` | <strong> إجمالي وزن الكسر المشترى الكلي: ${overallTotalScrapQuantity.toFixed(2)} جرام </strong>`;
        }
        overallTotalRow.innerHTML = `
            <td colspan="8" style="text-align: center; background-color: #2196f3; color: white; font-weight: bold;">
                ${overallTotalHTML}
            </td>`;
    }
}


async function editExpense(expense, branchName) {
     // Basic validation
    if (!expense || !branchName) {
        Swal.fire('خطأ', 'بيانات المصروف غير صالحة للتعديل.', 'error');
        return;
    }
    // Admin check for editing salaries
     if (expense.expenseType === 'مرتبات' && (!currentUser || currentUser.role !== 'admin')) {
        Swal.fire('خطأ', 'فقط المسؤول يمكنه تعديل مصروفات المرتبات.', 'error');
        return;
     }

    // Can only edit amount and description. Other fields are for context.
    const { value: updatedExpenseData } = await Swal.fire({
        title: "تعديل المصروف",
        html:
            `<div style="text-align: right;">` + // Align labels right
            `<label style="display: block; margin-top: 10px;">الفرع:</label>` +
            `<input class="swal2-input" value="${branchName}" readonly>` + // Readonly field
            `<label style="display: block; margin-top: 10px;">نوع المصروف:</label>` +
            `<input class="swal2-input" value="${expense.expenseType}" readonly>` + // Readonly field
            // Conditionally show User for Salary
            (expense.expenseType === 'مرتبات' ?
                `<label style="display: block; margin-top: 10px;">المستخدم (للمرتب):</label><input class="swal2-input" value = "${expense.expenseUser || 'N/A'}" readonly >` : '') +
            // Conditionally show Scrap Details
            (expense.expenseType === 'شراء فضة كسر' ?
                `<label style="display: block; margin-top: 10px;">تفاصيل الكسر:</label>`+
                `<input class="swal2-input" value="${expense.scrapType || 'N/A'}" readonly style="margin-bottom: 5px;">`+ // Readonly scrap type
                `<input class="swal2-input" value = "${expense.scrapQuantity?.toFixed(2) || 'N/A'} جرام" readonly>` // Readonly scrap quantity
                : ""
            ) +
            `<label style="display: block; margin-top: 10px;">قيمة المصروف:</label>` +
            `<input id="swal-edit-amount" class="swal2-input" value="${expense.amount}" type="number" step="0.01">` + // Editable amount
            `<label style="display: block; margin-top: 10px;">التوضيح:</label>` +
            `<textarea id="swal-edit-description" class="swal2-textarea" style="width: 95%">${expense.description || ''}</textarea>` + // Editable description
            `</div>`,
        focusConfirm: false,
        preConfirm: () => {
            const newAmount = parseFloat(document.getElementById('swal-edit-amount').value);
            const newDescription = document.getElementById('swal-edit-description').value.trim();

            if (isNaN(newAmount) || newAmount <= 0) {
                Swal.showValidationMessage("يرجى إدخال قيمة صحيحة وموجبة للمصروف");
                return false; // Prevent confirmation
            }
            // Return only the editable fields
            return { amount: newAmount, description: newDescription };
        }
    });

    if (updatedExpenseData) {
        // Find the correct expense within the specific branch's array
        if (!expenses[branchName] || !Array.isArray(expenses[branchName])) {
             Swal.fire('خطأ', 'لم يتم العثور على بيانات المصروفات لهذا الفرع.', 'error');
             return;
        }

        // Find index using a robust comparison (e.g., date and original amount/user)
        // Using date + user who recorded it is usually unique enough for a specific day
        const expenseIndex = expenses[branchName].findIndex(ex =>
             ex.date === expense.date &&
             ex.user === expense.user && // User who recorded
             ex.expenseType === expense.expenseType && // Match type
              // Add more fields if needed for uniqueness, e.g., original amount
             ex.amount === expense.amount
        );


        if (expenseIndex !== -1) {
             // --- IMPORTANT: Adjust product cost if editing a 'شراء فضة كسر' expense amount ---
             const originalExpense = expenses[branchName][expenseIndex];
             if (originalExpense.expenseType === 'شراء فضة كسر') {
                 const amountDifference = updatedExpenseData.amount - originalExpense.amount; // Calculate change in cost
                 const selectedBranch = branches.find(b => b.name === branchName);
                 if (selectedBranch && selectedBranch.products) {
                     const productIndex = selectedBranch.products.findIndex(p => p.name === originalExpense.scrapType);
                     if (productIndex !== -1) {
                         // Adjust the total purchase price of the product
                         let currentTotalCost = selectedBranch.products[productIndex].purchasePrice || 0;
                         selectedBranch.products[productIndex].purchasePrice = currentTotalCost + amountDifference;

                          // Ensure price doesn't go below zero
                          if (selectedBranch.products[productIndex].purchasePrice < 0) {
                             console.warn(`Product purchase price for ${originalExpense.scrapType} in ${branchName} went below zero after editing expense amount. Setting to 0.`);
                             selectedBranch.products[productIndex].purchasePrice = 0;
                          }
                          // Product quantity remains unchanged as we only edit the cost here
                          document.dispatchEvent(new CustomEvent('productAdded')); // Refresh product tables due to cost change
                     } else {
                         console.warn(`Product '${originalExpense.scrapType}' not found in branch '${branchName}' when trying to adjust cost during expense edit.`);
                     }
                 }
             }
             // --- End Product Cost Adjustment ---

            // Update the expense record with new amount and description
            expenses[branchName][expenseIndex] = {
                ...expenses[branchName][expenseIndex], // Keep original non-editable data
                amount: updatedExpenseData.amount,
                description: updatedExpenseData.description,
            };

            await saveData(); // Save changes

            document.dispatchEvent(new CustomEvent('expenseRecorded')); // Refresh the expense list UI
            Swal.fire('تم', "تم تحديث المصروف بنجاح", 'success');

        } else {
            console.error("Expense not found for editing:", expense, "in branch:", branchName);
            Swal.fire('خطأ', 'لم يتم العثور على المصروف المحدد للتعديل.', 'error');
        }
    }
}

async function deleteExpense(expense, branchName) {
    // Basic validation
    if (!expense || !branchName) {
        Swal.fire('خطأ', 'بيانات المصروف غير صالحة للحذف.', 'error');
        return;
    }
     // Admin check for deleting salaries
     if (expense.expenseType === 'مرتبات' && (!currentUser || currentUser.role !== 'admin')) {
        Swal.fire('خطأ', 'فقط المسؤول يمكنه حذف مصروفات المرتبات.', 'error');
        return;
     }

    const confirmationResult = await Swal.fire({
        title: "تأكيد الحذف",
        html: `هل أنت متأكد من حذف مصروف (${expense.expenseType}) بقيمة ${expense.amount}؟<br>ملاحظة: إذا كان المصروف هو "شراء فضة كسر"، فسيتم تعديل كمية وتكلفة الصنف في المخزون.`,
        icon: 'warning',
        confirmButtonText: "نعم , احذف",
        cancelButtonText: "إلغاء",
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });

    if (confirmationResult.isConfirmed) {
        if (!expenses[branchName] || !Array.isArray(expenses[branchName])) {
            Swal.fire('خطأ', 'لم يتم العثور على بيانات المصروفات لهذا الفرع.', 'error');
            return;
        }

        // Find the index using a robust comparison
        const expenseIndex = expenses[branchName].findIndex(ex =>
             ex.date === expense.date &&
             ex.user === expense.user &&
             ex.expenseType === expense.expenseType &&
             ex.amount === expense.amount // Compare original amount
             // Add potentially expenseUser or scrapType/Quantity if needed for absolute uniqueness
        );

        if (expenseIndex !== -1) {
            const expenseToDelete = { ...expenses[branchName][expenseIndex] }; // Copy before splicing

            // <<-- IMPORTANT: Reverse product quantity/price changes if deleting a 'شراء فضة كسر' expense -->>
            if (expenseToDelete.expenseType === 'شراء فضة كسر' && expenseToDelete.scrapType && typeof expenseToDelete.scrapQuantity === 'number' && !isNaN(expenseToDelete.scrapQuantity)) {
                const selectedBranch = branches.find(b => b.name === branchName);
                if (selectedBranch && selectedBranch.products) {
                    const productIndex = selectedBranch.products.findIndex(p => p.name === expenseToDelete.scrapType);
                    if (productIndex !== -1) {
                        // Reduce quantity by the amount that was added
                        selectedBranch.products[productIndex].quantity -= expenseToDelete.scrapQuantity;

                         // Reduce total purchase price by the amount that was recorded for this expense
                         let currentTotalCost = selectedBranch.products[productIndex].purchasePrice || 0;
                         selectedBranch.products[productIndex].purchasePrice = currentTotalCost - expenseToDelete.amount; // Subtract the total expense cost

                         // Ensure quantity and price don't go below zero due to potential inconsistencies
                         if (selectedBranch.products[productIndex].quantity < 0) {
                            console.warn(`Product quantity for ${expenseToDelete.scrapType} in ${branchName} went below zero after deleting expense. Setting to 0.`);
                            selectedBranch.products[productIndex].quantity = 0;
                         }
                         if (selectedBranch.products[productIndex].purchasePrice < 0) {
                            console.warn(`Product purchase price for ${expenseToDelete.scrapType} in ${branchName} went below zero after deleting expense. Setting to 0.`);
                            selectedBranch.products[productIndex].purchasePrice = 0;
                         }
                         // Dispatch event to update product tables because inventory changed
                         document.dispatchEvent(new CustomEvent('productAdded'));
                    } else {
                        console.warn(`Product '${expenseToDelete.scrapType}' not found in branch '${branchName}' when trying to reverse expense deletion.`);
                        // Show warning to user? Data inconsistency.
                         Swal.fire('تحذير', `لم يتم العثور على الصنف '${expenseToDelete.scrapType}' لتعديل المخزون أثناء حذف المصروف. قد يكون المخزون غير دقيق.`, 'warning');
                    }
                } else {
                    console.warn(`Branch '${branchName}' not found during expense deletion inventory adjustment.`);
                }
            }
            // --- End Product Adjustment ---

            // Now, remove the expense record itself from the branch's array
            expenses[branchName].splice(expenseIndex, 1);

            // If the branch array becomes empty after deletion, remove the branch key? (Optional cleanup)
            // if (expenses[branchName].length === 0) {
            //     delete expenses[branchName];
            // }

            await saveData(); // Save the updated expenses object

            document.dispatchEvent(new CustomEvent('expenseRecorded')); // Refresh expense table UI
            Swal.fire('تم الحذف', 'تم حذف المصروف بنجاح', 'success');

        } else {
             console.error("Expense not found for deletion:", expense, "in branch:", branchName);
             Swal.fire('خطأ', 'لم يتم العثور على المصروف المحدد للحذف.', 'error');
        }
    }
}

// Called when navigating to the expenses page or refreshing data
function updateExpensesPage(){
    // Populate the branch filter dropdown
    updateBranchSelect('expenses-branch-filter');
    // Populate the branch select for recording expenses
    updateBranchSelect('expense-branch-select');
    // Update the form fields based on the initially selected expense type (or default)
    updateExpenseForm();
    // Initially hide the expense table until a search is performed
    const expensesTableWrapper = document.getElementById('expenses-table-wrapper');
    if (expensesTableWrapper) {
        expensesTableWrapper.style.display = 'none';
    }
     const expensesListTbody = document.getElementById('expenses-list');
     if (expensesListTbody) {
        expensesListTbody.innerHTML = ''; // Clear any previous results
     }
}