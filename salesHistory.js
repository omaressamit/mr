// --- salesHistory.js ---

function showSalesHistory() {
    let totalReturnsAmount = 0;

    // Get filter values
    const searchTerm = document.getElementById('search-sales').value.trim().toLowerCase();
    const selectedBranch = document.getElementById('branch-filter').value;
    const dateFromStr = document.getElementById('date-from').value;
    const dateToStr = document.getElementById('date-to').value;
    const dateFrom = dateFromStr ? new Date(dateFromStr) : null;
    const dateTo = dateToStr ? new Date(dateToStr) : null;

    // Ensure dateTo includes the entire day
    if (dateTo) {
        dateTo.setHours(23, 59, 59, 999);
    }

    // Filter Sales based on ALL criteria
    const filteredSales = sales.filter(sale => {
        if (!sale || !sale.date || !sale.product) return false; // Basic validity check
        let saleDateMs;
        try {
            saleDateMs = new Date(sale.date).getTime();
            if (isNaN(saleDateMs)) return false;
        } catch (e) { return false; }

        const branchMatch = !selectedBranch || sale.branch === selectedBranch;
        const dateMatch = (!dateFrom || saleDateMs >= dateFrom.getTime()) && (!dateTo || saleDateMs <= dateTo.getTime());
        const searchMatch = !searchTerm || (
            sale.product.toLowerCase().includes(searchTerm) ||
            (sale.details && sale.details.toLowerCase().includes(searchTerm)) || // Check if details exist
            (sale.user && sale.user.toLowerCase().includes(searchTerm)) ||
            (sale.branch && sale.branch.toLowerCase().includes(searchTerm)) ||
            sale.date.includes(searchTerm) || // Keep basic string search on date
            (sale.customerPhone && sale.customerPhone.includes(searchTerm)) ||
            (sale.customerDetails && sale.customerDetails.toLowerCase().includes(searchTerm))
        );
        return branchMatch && dateMatch && searchMatch;
    });

    // Filter Returns based on ALL criteria
    const filteredReturns = returns.filter(returnItem => {
        if (!returnItem || !returnItem.date || !returnItem.product) return false;
        let returnDateMs;
        try {
             returnDateMs = new Date(returnItem.date).getTime();
             if (isNaN(returnDateMs)) return false;
        } catch (e) { return false; }

        const branchMatch = !selectedBranch || returnItem.branch === selectedBranch;
        const dateMatch = (!dateFrom || returnDateMs >= dateFrom.getTime()) && (!dateTo || returnDateMs <= dateTo.getTime());
        const searchMatch = !searchTerm || (
            returnItem.product.toLowerCase().includes(searchTerm) ||
            (returnItem.reason && returnItem.reason.toLowerCase().includes(searchTerm)) ||
            (returnItem.user && returnItem.user.toLowerCase().includes(searchTerm)) ||
            returnItem.date.includes(searchTerm)
        );
        return branchMatch && dateMatch && searchMatch;
    });

    // Filter Workshop Operations based on Branch and Date
    const filteredWorkshopOperations = workshopOperations.filter(operation => {
        if (!operation || !operation.date) return false;
        let operationDateMs;
         try {
             operationDateMs = new Date(operation.date).getTime();
              if (isNaN(operationDateMs)) return false;
         } catch (e) { return false; }

        const branchMatch = !selectedBranch || operation.branch === selectedBranch;
        const dateMatch = (!dateFrom || operationDateMs >= dateFrom.getTime()) && (!dateTo || operationDateMs <= dateTo.getTime());
        return branchMatch && dateMatch;
    });

    // --- Get UI Elements ---
    const salesTableBody = document.querySelector('#sales-table tbody');
    const returnsTableBody = document.querySelector('#returns-table tbody');
    salesTableBody.innerHTML = '';
    returnsTableBody.innerHTML = '';

    // --- Check if any data matches the filters ---
    if (filteredSales.length === 0 && filteredReturns.length === 0 && filteredWorkshopOperations.length === 0) {
        salesTableBody.innerHTML = `<tr><td colspan="11" style="text-align: center;">لا يوجد سجل مبيعات أو عمليات ورشة تطابق البحث.</td></tr>`;
        returnsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">لا يوجد سجل ارتجاعات تطابق البحث.</td></tr>`;
        return; // Exit if no relevant data
    }

    // --- Start Calculations ---
    const salesByBranch = {};
    let totalExpensesAmount = 0;
    let overallTotalSales = 0;
    let totalPurchasesForPeriod = 0; // Initialize purchase total for the specific period
    let totalFilteredWorkshopRevenue = 0;

    // Calculate Expenses for the period and branch
    for (const branchName in expenses) {
        if (expenses.hasOwnProperty(branchName)) {
             if (!selectedBranch || branchName === selectedBranch) { // Apply branch filter
                const branchExpenses = expenses[branchName];
                if (Array.isArray(branchExpenses)) {
                    branchExpenses.forEach(expense => {
                         if (!expense || !expense.date) return; // Skip if invalid
                         let expenseDateMs;
                         try {
                              expenseDateMs = new Date(expense.date).getTime();
                              if (isNaN(expenseDateMs)) return;
                         } catch (e) { return; }

                         const dateMatch = (!dateFrom || expenseDateMs >= dateFrom.getTime()) && (!dateTo || expenseDateMs <= dateTo.getTime());
                         if (dateMatch) {
                             totalExpensesAmount += parseFloat(expense.amount) || 0;
                         }
                    });
                }
             }
        }
    }

    // Filter Receiving (Purchases) for the period and branch
    const filteredReceivingForPeriod = receiving.filter(receive => {
        if (!receive || !receive.date) return false;
        let receiveDateMs;
        try {
             receiveDateMs = new Date(receive.date).getTime();
             if (isNaN(receiveDateMs)) return false;
        } catch (e) { return false; }

        const branchMatch = !selectedBranch || receive.branch === selectedBranch;
        const dateMatch = (!dateFrom || receiveDateMs >= dateFrom.getTime()) && (!dateTo || receiveDateMs <= dateTo.getTime());
        return branchMatch && dateMatch;
    });

    // Calculate Total Purchases cost *for the filtered period*
    filteredReceivingForPeriod.forEach(receive => {
        const quantity = parseFloat(receive.quantity);
        const price = parseFloat(receive.purchasePrice);
        // Ensure valid numbers before calculating cost
        if (!isNaN(quantity) && !isNaN(price) && quantity > 0 && price >= 0) {
            totalPurchasesForPeriod += quantity * price;
        } else if (receive) {
            console.warn("Skipping purchase cost calculation for record due to invalid quantity/price:", receive);
        }
    });

    // Group Sales by Branch and calculate overall sales
    filteredSales.forEach(sale => {
        if (!salesByBranch[sale.branch]) {
            salesByBranch[sale.branch] = { sales: [], total: 0, purchases: 0, workshop: 0 };
        }
        const salePrice = parseFloat(sale.price) || 0;
        salesByBranch[sale.branch].sales.push(sale);
        salesByBranch[sale.branch].total += salePrice;
        overallTotalSales += salePrice;
    });

    // Calculate Purchases cost *per branch* for the filtered period
    for (const branchName in salesByBranch) {
        let branchPurchaseCost = 0;
        const branchReceiving = filteredReceivingForPeriod.filter(r => r.branch === branchName);
        branchReceiving.forEach(rec => {
            const quantity = parseFloat(rec.quantity);
            const price = parseFloat(rec.purchasePrice);
            if (!isNaN(quantity) && !isNaN(price) && quantity > 0 && price >= 0) {
                branchPurchaseCost += quantity * price;
            }
        });
        salesByBranch[branchName].purchases = branchPurchaseCost;
    }

    // Group Workshop Operations by Branch (if needed) and calculate totals
    filteredWorkshopOperations.forEach(operation => {
        const operationPrice = parseFloat(operation.price) || 0;
        totalFilteredWorkshopRevenue += operationPrice;

        // Add to branch data, creating branch if it only had workshop ops
        if (!salesByBranch[operation.branch]) {
            salesByBranch[operation.branch] = { sales: [], total: 0, purchases: 0, workshop: 0 };
            // Calculate purchases for this newly added branch for the period
            let branchPurchaseCost = 0;
            const branchReceiving = filteredReceivingForPeriod.filter(r => r.branch === operation.branch);
            branchReceiving.forEach(rec => {
                const quantity = parseFloat(rec.quantity);
                const price = parseFloat(rec.purchasePrice);
                 if (!isNaN(quantity) && !isNaN(price) && quantity > 0 && price >= 0) {
                    branchPurchaseCost += quantity * price;
                }
            });
            salesByBranch[operation.branch].purchases = branchPurchaseCost;
        }
        salesByBranch[operation.branch].workshop += operationPrice;
    });

    // Calculate total returns amount from filtered returns
    filteredReturns.forEach(returnItem => {
        totalReturnsAmount += parseFloat(returnItem.price) || 0;
    });

    // --- Display Logic ---

    // Sort sales within each branch by date (newest first)
    for (const branchData of Object.values(salesByBranch)) {
        if (branchData.sales && branchData.sales.length > 0) {
            branchData.sales.sort((a, b) => {
                 try {
                     return new Date(b.date).getTime() - new Date(a.date).getTime();
                 } catch(e) { return 0; } // Handle potential invalid dates during sort
            });
        }
    }

    // --- Sales Table Display ---
    let hasSalesOrWorkshopData = false; // Flag to check if we need the total row
    for (const [branchName, branchData] of Object.entries(salesByBranch)) {
        // Only display branch header if there are sales or workshop operations for it
         if (branchData.sales.length > 0 || branchData.workshop > 0) {
            hasSalesOrWorkshopData = true;
            const branchHeader = document.createElement('tr');
            // Display branch-specific totals, including the calculated period purchases
            const branchNetProfit = branchData.total + branchData.workshop - branchData.purchases;
            branchHeader.innerHTML = `
                <td colspan="11" style="background-color: #4CAF50; text-align: center;">
                    <strong>${branchName} - إجمالي المبيعات: ${branchData.total.toFixed(2)} - إجمالي المشتريات: ${branchData.purchases.toFixed(2)} - إجمالي الورشة: ${branchData.workshop.toFixed(2)} - صافي الربح: ${branchNetProfit.toFixed(2)}</strong>
                </td>
            `;
            salesTableBody.appendChild(branchHeader);

            // Display sales rows for the branch
            for (const sale of branchData.sales) {
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                let formattedDate = 'تاريخ غير صالح';
                try { formattedDate = new Date(sale.date).toLocaleDateString('ar-EG', options); } catch(e){}

                const row = document.createElement('tr');
                row.classList.add('sales-row'); // Add class for event listener
                row.dataset.saleDetails = JSON.stringify(sale); // Store sale details

                const actionsCell = document.createElement('td');
                const editBtn = document.createElement('button');
                editBtn.textContent = 'تعديل';
                editBtn.classList.add('edit-btn');
                editBtn.onclick = (event) => {
                    event.stopPropagation(); // Prevent row click listener
                    editSale(sale);
                };
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.classList.add('delete-btn');
                deleteBtn.onclick = (event) => {
                    event.stopPropagation(); // Prevent row click listener
                    deleteSale(sale);
                };
                actionsCell.appendChild(editBtn);
                actionsCell.appendChild(deleteBtn);

                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${sale.branch || ''}</td>
                    <td>${sale.product || ''}</td>
                    <td>${sale.quantity || 0}</td>
                    <td>${(parseFloat(sale.price) || 0).toFixed(2)}</td>
                    <td>${sale.customerPhone || ''}</td>
                    <td>${sale.details || ''}</td>
                    <td>${sale.customerDetails || ''}</td>
                    <td>${sale.user || ''}</td>
                    <td>${sale.paymentMethod || ''}</td>
                `;
                row.appendChild(actionsCell);
                salesTableBody.appendChild(row);
            }
         }
    }

    // Add final total row for Sales/Workshop section if there was data
    if (hasSalesOrWorkshopData) {
        const totalSalesRow = document.createElement('tr');
        totalSalesRow.innerHTML = `
            <td colspan="11" style="text-align: center; background-color: #f39c12;">
                <strong>إجمالي المبيعات: ${overallTotalSales.toFixed(2)} | إجمالي الورشة: ${totalFilteredWorkshopRevenue.toFixed(2)}</strong>
            </td>
        `;
        salesTableBody.appendChild(totalSalesRow);

        // Calculate final net profit using period-specific purchases
        const finalTotalRevenue = overallTotalSales + totalFilteredWorkshopRevenue;
        const finalNetProfit = finalTotalRevenue - totalReturnsAmount - totalExpensesAmount - totalPurchasesForPeriod;

        const summaryTotalRow = document.createElement('tr');
        // Display the final summary including the calculated period purchases total
        summaryTotalRow.innerHTML = `
            <td colspan="11" style="background-color: #2196F3; text-align: center; font-weight: bold;">
            إجمالي الإيرادات: ${finalTotalRevenue.toFixed(2)} | إجمالي المرتجعات: ${totalReturnsAmount.toFixed(2)} | إجمالي المصروفات: ${totalExpensesAmount.toFixed(2)}  | إجمالي المشتريات: ${totalPurchasesForPeriod.toFixed(2)} | صافي الربح: ${finalNetProfit.toFixed(2)}
            </td>
        `;
        salesTableBody.appendChild(summaryTotalRow);
    } else if (filteredSales.length === 0 && filteredWorkshopOperations.length === 0) {

        salesTableBody.innerHTML = `<tr><td colspan="11" style="text-align: center;">لا يوجد سجل مبيعات أو عمليات ورشة تطابق البحث.</td></tr>`;
    }


    // --- Returns Table Display ---
    if (filteredReturns.length === 0) {
        returnsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">لا يوجد سجل ارتجاعات تطابق البحث.</td></tr>`;
    } else {
        // Sort returns by date (newest first)
        filteredReturns.sort((a, b) => {
             try {
                 return new Date(b.date).getTime() - new Date(a.date).getTime();
             } catch(e) { return 0; }
        });

        for (const returnItem of filteredReturns) {
             const options = { year: 'numeric', month: 'long', day: 'numeric' };
             let formattedDate = 'تاريخ غير صالح';
             try { formattedDate = new Date(returnItem.date).toLocaleDateString('ar-EG', options); } catch(e){}

            const row = document.createElement('tr');
            const price = parseFloat(returnItem.price) || 0;
            const quantity = parseFloat(returnItem.quantity) || 0; // Use parseFloat for consistency

            const actionsCell = document.createElement('td');
            const editBtn = document.createElement('button');
            editBtn.textContent = 'تعديل';
            editBtn.classList.add('edit-btn');
            editBtn.onclick = () => editReturn(returnItem);
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'حذف';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => deleteReturn(returnItem);
            actionsCell.appendChild(deleteBtn);

            row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${returnItem.product || ''}</td>
                    <td>${quantity.toFixed(2)}</td>
                    <td>${price.toFixed(2)}</td>
                    <td>${returnItem.reason || ''}</td>
                    <td>${returnItem.user || ''}</td>
                `;
            row.appendChild(actionsCell);
            returnsTableBody.appendChild(row);
        }
        // Add total row for returns
        const totalReturnsRow = document.createElement('tr');
        totalReturnsRow.innerHTML = `
          <td colspan="7" style="background-color: #ff5722; text-align:center; font-weight: bold;">
            <strong>إجمالي المرتجعات: ${totalReturnsAmount.toFixed(2)}</strong>
          </td>
        `;
        returnsTableBody.appendChild(totalReturnsRow);
    }

    const salesTable = document.getElementById('sales-table');
    const newSalesTableBody = salesTable.querySelector('tbody'); // Get the potentially new tbody element

     if (newSalesTableBody._salesRowClickListener) {
         newSalesTableBody.removeEventListener('click', newSalesTableBody._salesRowClickListener);
     }

    newSalesTableBody._salesRowClickListener = function(event) { // Store listener reference
        const clickedRow = event.target.closest('.sales-row');
        if (clickedRow && clickedRow.dataset.saleDetails) {
            try {
                const saleDetails = JSON.parse(clickedRow.dataset.saleDetails);
                displaySaleDetailsDialog(saleDetails);
            } catch (e) {
                console.error("Error parsing sale details from row dataset:", e);
                Swal.fire('خطأ', 'لا يمكن عرض تفاصيل هذه العملية.', 'error');
            }
        }
    };
    newSalesTableBody.addEventListener('click', newSalesTableBody._salesRowClickListener);
}

function updateBranchFilter() {
    const branchFilter = document.getElementById('branch-filter');
    if (!branchFilter) return;
    const currentVal = branchFilter.value; // Preserve selection if possible
    branchFilter.innerHTML = '<option value="">الكل</option>';

    if (typeof branches !== 'undefined' && Array.isArray(branches)) {
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.name;
            option.textContent = branch.name;
            if (branch.name === currentVal) {
                option.selected = true; // Reselect previous value
            }
            branchFilter.appendChild(option);
        });
    } else {
        console.warn("Branches data not available for filter update.");
    }
}

// IMPORTANT: Call showSalesHistory *only* when the user clicks "Search"
function performSearch() {
    const dateFromStr = document.getElementById('date-from').value;
    const salesTableBody = document.querySelector('#sales-table tbody');
    const returnsTableBody = document.querySelector('#returns-table tbody');

    // Date From validation
    if (!dateFromStr) {
        Swal.fire('خطأ', 'يرجى تحديد تاريخ بداية الفترة للبحث.', 'error');
        if (salesTableBody) salesTableBody.innerHTML = ''; // Clear content
        if (returnsTableBody) returnsTableBody.innerHTML = ''; // Clear content
        return; // Stop
    }

    showSalesHistory(); // Show results ONLY if dateFromStr exists
}

async function editSale(sale) {
    if (!sale) {
        console.error("editSale called with invalid sale data");
        Swal.fire('خطأ', 'بيانات عملية البيع غير صالحة للتعديل.', 'error');
        return;
    }

    const { value: updatedSale } = await Swal.fire({
        title: 'تعديل عملية البيع',
        html:
            `<label for="swal-input1">الفرع</label>` +
            `<input id="swal-input1" class="swal2-input"  value="${sale.branch || ''}" readonly>` +
            `<label for="swal-input2">الصنف</label>` +
            `<input id="swal-input2" class="swal2-input" value="${sale.product || ''}" readonly>` +
            `<label for="swal-input3">الكمية (بالجرام)</label>` +
            `<input id="swal-input3" class="swal2-input" type="number" step="0.01" value="${sale.quantity || 0}">` +
            `<label for="swal-input4">سعر البيع</label>` +
            `<input id="swal-input4" class="swal2-input" type="number" value="${sale.price || 0}">` +
            `<label for="swal-input5">رقم هاتف العميل (اختياري)</label>` +
            `<input id="swal-input5" class="swal2-input" type="tel" value="${sale.customerPhone || ''}">` +
            `<label for="swal-input6">التفاصيل</label>` +
            `<textarea id="swal-input6" class="swal2-textarea">${sale.details || ''}</textarea>` +
            `<label for="swal-input7">بيانات العميل (اختياري)</label>` +
            `<textarea id="swal-input7" class="swal2-textarea">${sale.customerDetails || ''}</textarea>` +
             `<label for="swal-input-payment">وسيلة الدفع:</label>
            <select id="swal-input-payment" class="swal2-select">
                <option value="نقدي" ${sale.paymentMethod === 'نقدي' ? 'selected' : ''}>نقدي</option>
                <option value="فيزا" ${sale.paymentMethod === 'فيزا' ? 'selected' : ''}>فيزا</option>
                <option value="انستاباي" ${sale.paymentMethod === 'انستاباي' ? 'selected' : ''}>انستاباي</option>
            </select>`, // Added Payment Method
        focusConfirm: false,
        preConfirm: () => {
            const quantity = parseFloat(document.getElementById('swal-input3').value);
            const price = parseFloat(document.getElementById('swal-input4').value);
            const customerPhone = document.getElementById('swal-input5').value.trim();
            const details = document.getElementById('swal-input6').value.trim();
            const customerDetails = document.getElementById('swal-input7').value.trim();
            const paymentMethod = document.getElementById('swal-input-payment').value; // Get Payment Method

            if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price <= 0) {
                Swal.showValidationMessage('يرجى إدخال قيم صحيحة للكمية والسعر');
                return false; // Prevent confirmation
            }
            // Return all fields
            return { quantity, price, customerPhone, details, customerDetails, paymentMethod };
        }
    });

    if (updatedSale) {
        // Find using a combination of fields for better accuracy
        const saleIndex = sales.findIndex(s => s.date === sale.date && s.user === sale.user && s.product === sale.product && s.branch === sale.branch);

        if (saleIndex !== -1) {
            const originalSaleData = { ...sales[saleIndex] }; // Copy before modifying
            const originalBranch = branches.find(b => b.name === originalSaleData.branch);

            if (!originalBranch || !originalBranch.products) {
                console.error(`Branch or products not found during sale edit: ${originalSaleData.branch}`);
                Swal.fire('خطأ', 'لم يتم العثور على بيانات الفرع أو الأصناف الأصلية.', 'error');
                return;
            }

            const originalProductIndex = originalBranch.products.findIndex(p => p.name === originalSaleData.product);

            if (originalProductIndex === -1) {
                 console.error(`Original product not found during sale edit: ${originalSaleData.product} in branch: ${originalSaleData.branch}`);
                 Swal.fire('خطأ', 'لم يتم العثور على بيانات الصنف الأصلية.', 'error');
                 return;
            }

             const product = originalBranch.products[originalProductIndex];
             const oldQuantity = parseFloat(originalSaleData.quantity) || 0;
             const newQuantity = parseFloat(updatedSale.quantity) || 0;
             const quantityChange = newQuantity - oldQuantity; // Positive if increased, negative if decreased

            // --- Reverse the old sale effect ---
            product.quantity += oldQuantity;
            // Recalculate cost basis before adding back cost
            const costBasisBeforeReversal = (product.quantity > 0) ? product.purchasePrice / product.quantity : 0;
            const originalCostOfSale = costBasisBeforeReversal * oldQuantity;
            product.purchasePrice += originalCostOfSale;


             // --- Check if sufficient quantity for the *change* ---
            // Note: This logic assumes the *current* product quantity (after reversal) must cover the *new* total quantity.
             if (product.quantity < newQuantity) {
                Swal.fire('تحذير', `الكمية الحالية (${product.quantity.toFixed(2)}) للصنف ${product.name} غير كافية لتغطية الكمية الجديدة المطلوبة (${newQuantity.toFixed(2)}). سيتم حفظ التعديل لكن قد تحتاج لمراجعة المخزون.`, 'warning');
                // Don't block the save, but warn the user. Inventory might become negative.
             }

             // --- Update the sale record ---
             sales[saleIndex] = {
                 ...sales[saleIndex], // Keep original date/user etc.
                 quantity: newQuantity,
                 price: updatedSale.price,
                 customerPhone: updatedSale.customerPhone,
                 details: updatedSale.details,
                 customerDetails: updatedSale.customerDetails,
                 paymentMethod: updatedSale.paymentMethod // Update payment method
             };

            // --- Apply the new sale effect ---
            product.quantity -= newQuantity;
            // Recalculate cost basis before deducting new cost
            const costBasisBeforeNewSale = (product.quantity + newQuantity > 0) ? product.purchasePrice / (product.quantity + newQuantity) : 0;
            const newCostOfSale = costBasisBeforeNewSale * newQuantity;
            product.purchasePrice -= newCostOfSale;

            // Ensure product quantity and price don't go below zero (logically shouldn't if purchasePrice is total cost)
             if (product.quantity < 0) {
                console.warn(`Product quantity for ${product.name} went negative after edit. Setting to 0.`);
                product.quantity = 0;
             }
              if (product.purchasePrice < 0) {
                 console.warn(`Product purchase price for ${product.name} went negative after edit. Setting to 0.`);
                 product.purchasePrice = 0;
              }

            await saveData();

            // Refresh relevant UI parts
            updateProductsTable(); // Update inventory display
            showSalesHistory(); // Refresh the history view itself
            updateDailySalesTable(); // Refresh user's daily sales view if applicable
            populateProductSelect('sales'); // Refresh dropdowns if needed
            populateProductSelect('returns');
            populateProductSelect('receiving');

            Swal.fire('تم', 'تم تحديث عملية البيع بنجاح', 'success');
        } else {
             console.error("Sale to edit not found in sales array:", sale);
             Swal.fire('خطأ', 'لم يتم العثور على عملية البيع المراد تعديلها.', 'error');
        }
    }
}


async function deleteSale(sale) {
     if (!sale) {
         console.error("deleteSale called with invalid sale data");
         Swal.fire('خطأ', 'بيانات عملية البيع غير صالحة للحذف.', 'error');
         return;
     }

     let formattedDateStr = 'تاريخ غير متاح';
     try { formattedDateStr = new Date(sale.date).toLocaleDateString('ar-EG'); } catch (e) {}

    const confirmResult = await Swal.fire({
        title: 'تأكيد الحذف',
        text: `هل أنت متأكد من حذف عملية بيع الصنف "${sale.product || 'غير معروف'}" بتاريخ ${formattedDateStr}؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });

    if (confirmResult.isConfirmed) {
        // Find the index using multiple fields for robustness
        const saleIndex = sales.findIndex(s => s.date === sale.date && s.user === sale.user && s.product === sale.product && s.branch === sale.branch && s.price === sale.price);

        if (saleIndex !== -1) {
             const saleToDelete = { ...sales[saleIndex] }; // Copy data before splicing
             const quantityToDelete = parseFloat(saleToDelete.quantity) || 0;

            // Adjust inventory: Find branch and product
            const branch = branches.find(b => b.name === saleToDelete.branch);

            if (!branch || !branch.products) {
                 console.error(`Branch or products not found during sale deletion: ${saleToDelete.branch}. Inventory may not be adjusted.`);
                 // Proceed with deletion but inventory won't be accurate
            } else {
                const productIndex = branch.products.findIndex(p => p.name === saleToDelete.product);
                if (productIndex !== -1) {
                     const product = branch.products[productIndex];
                    // Add back the quantity sold
                    product.quantity += quantityToDelete;

                    // Calculate and add back the cost of the sale
                    // Estimate cost per gram *before* adding back quantity
                    const costBasisBeforeReversal = (product.quantity > 0) ? product.purchasePrice / product.quantity : 0;
                    const costOfSale = costBasisBeforeReversal * quantityToDelete;
                    product.purchasePrice += costOfSale;

                     // Ensure purchase price isn't negative after adding cost back
                     if (product.purchasePrice < 0) {
                          console.warn(`Product purchase price for ${product.name} went negative after adding back cost during delete. Setting to 0.`);
                          product.purchasePrice = 0;
                     }

                } else {
                     console.warn(`Product ${saleToDelete.product} not found in branch ${saleToDelete.branch} during sale deletion. Inventory not adjusted.`);
                }
            }

            // Remove Sale from Sales Array
            sales.splice(saleIndex, 1);
            await saveData();

            // Refresh UI
            updateProductsTable(); // Update inventory display
            document.dispatchEvent(new CustomEvent('saleDeleted')); // Refresh sales history
            updateDailySalesTable(); // Also refresh daily sales if applicable
            populateProductSelect('sales');
            populateProductSelect('returns');
            populateProductSelect('receiving');


            Swal.fire('تم الحذف', 'تم حذف عملية البيع بنجاح', 'success');
        } else {
             console.error("Sale to delete not found:", sale);
             Swal.fire('خطأ', 'لم يتم العثور على عملية البيع المراد حذفها.', 'error');
        }
    }
}

async function editReturn(returnItem) {
     if (!returnItem) {
         console.error("editReturn called with invalid return data");
          Swal.fire('خطأ', 'بيانات الارتجاع غير صالحة للتعديل.', 'error');
         return;
     }
    const { value: updatedReturn } = await Swal.fire({
        title: 'تعديل الارتجاع',
        html:
            `<label>الفرع</label>` +
            `<input id="swal-input1" class="swal2-input" value="${returnItem.branch || ''}" readonly>` +
            `<label>الصنف</label>` +
            `<input id="swal-input2" class="swal2-input" value="${returnItem.product || ''}" readonly>` +
            `<label>الكمية</label>` +
            `<input id="swal-input3" class="swal2-input" type="number" step="0.01" value="${returnItem.quantity || 0}">` +
            `<label>السعر المسترد</label>` + // Clarified label
            `<input id="swal-input4" class="swal2-input" type="number" value="${returnItem.price || 0}">` +
            `<label>السبب</label>` +
            `<textarea id="swal-input5" class="swal2-textarea">${returnItem.reason || ''}</textarea>`,
        focusConfirm: false,
        preConfirm: () => {
            const quantity = parseFloat(document.getElementById('swal-input3').value);
            const price = parseFloat(document.getElementById('swal-input4').value);
            const reason = document.getElementById('swal-input5').value.trim();
            if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) { // Allow zero price return? Changed to price < 0
                Swal.showValidationMessage('يرجى إدخال كمية صحيحة وسعر غير سالب');
                return false;
            }
            return { quantity, price, reason };
        }
    });

    if (updatedReturn) {
        const returnIndex = returns.findIndex(r => r.date === returnItem.date && r.user === returnItem.user && r.product === returnItem.product && r.branch === returnItem.branch);

        if (returnIndex !== -1) {
             const originalReturnData = { ...returns[returnIndex] };
             const oldQuantity = parseFloat(originalReturnData.quantity) || 0;
             const newQuantity = parseFloat(updatedReturn.quantity) || 0;

             const originalBranch = branches.find(b => b.name === originalReturnData.branch);

             if (!originalBranch || !originalBranch.products) {
                 console.error(`Branch or products not found during return edit: ${originalReturnData.branch}`);
                 Swal.fire('خطأ', 'لم يتم العثور على بيانات الفرع أو الأصناف الأصلية للارتجاع.', 'error');
                 return;
             }
             const originalProductIndex = originalBranch.products.findIndex(p => p.name === originalReturnData.product);

             if (originalProductIndex === -1) {
                 console.error(`Original product not found during return edit: ${originalReturnData.product}`);
                 Swal.fire('خطأ', 'لم يتم العثور على بيانات الصنف الأصلية للارتجاع.', 'error');
                 return;
             }
             const product = originalBranch.products[originalProductIndex];

            // --- Reverse the old return effect ---
            product.quantity -= oldQuantity;
            // Estimate cost per gram *before* deducting old quantity cost
             const costBasisBeforeReversal = (product.quantity + oldQuantity > 0) ? product.purchasePrice / (product.quantity + oldQuantity) : 0;
             const originalReturnCost = costBasisBeforeReversal * oldQuantity;
            product.purchasePrice -= originalReturnCost;

             // Ensure non-negative after reversal before applying new
             if (product.quantity < 0) {
                console.warn(`Product quantity for ${product.name} went negative after reversing return. Setting to 0.`);
                product.quantity = 0;
             }
             if (product.purchasePrice < 0) {
                console.warn(`Product purchase price for ${product.name} went negative after reversing return cost. Setting to 0.`);
                product.purchasePrice = 0;
             }


            // --- Update the return record ---
            returns[returnIndex] = {
                ...returns[returnIndex],
                quantity: newQuantity,
                price: updatedReturn.price,
                reason: updatedReturn.reason
            };

            // --- Apply the new return effect ---
            product.quantity += newQuantity;
             // Estimate cost per gram *before* adding new cost
            const costBasisBeforeNewReturn = (product.quantity > 0) ? product.purchasePrice / product.quantity : 0;
            const newReturnCost = costBasisBeforeNewReturn * newQuantity;
            product.purchasePrice += newReturnCost;

            // Ensure non-negative values final check
             if (product.purchasePrice < 0) {
                 console.warn(`Product purchase price for ${product.name} went negative after applying new return cost. Setting to 0.`);
                 product.purchasePrice = 0;
             }


            await saveData();

            // Refresh UI
            updateProductsTable();
            showSalesHistory();
            populateProductSelect('sales');
            populateProductSelect('returns');
            populateProductSelect('receiving');

            Swal.fire('تم', 'تم تحديث الارتجاع بنجاح', 'success');
        } else {
             console.error("Return to edit not found:", returnItem);
             Swal.fire('خطأ', 'لم يتم العثور على الارتجاع المراد تعديله.', 'error');
        }
    }
}

async function deleteReturn(returnItem) {
     if (!returnItem) {
         console.error("deleteReturn called with invalid return data");
         Swal.fire('خطأ', 'بيانات الارتجاع غير صالحة للحذف.', 'error');
         return;
     }
    const confirmResult = await Swal.fire({
        title: 'تأكيد الحذف',
        text: `هل أنت متأكد من حذف ارتجاع الصنف "${returnItem.product || 'غير معروف'}"؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });
    if (confirmResult.isConfirmed) {
        const returnIndex = returns.findIndex(r => r.date === returnItem.date && r.user === returnItem.user && r.product === returnItem.product && r.branch === returnItem.branch && r.price === returnItem.price);

        if (returnIndex !== -1) {
             const returnToDelete = { ...returns[returnIndex] };
             const quantityToDelete = parseFloat(returnToDelete.quantity) || 0;

            // Adjust Inventory
            const branch = branches.find(b => b.name === returnToDelete.branch);

             if (!branch || !branch.products) {
                 console.error(`Branch or products not found for return deletion: ${returnToDelete.branch}. Inventory may not be adjusted.`);
             } else {
                 const productIndex = branch.products.findIndex(p => p.name === returnToDelete.product);
                 if (productIndex !== -1) {
                     const product = branch.products[productIndex];
                    // Reverse the return: Deduct quantity
                    product.quantity -= quantityToDelete;

                    // Reverse the cost addition: Deduct cost
                    // Estimate cost per gram *before* deducting cost
                     const costBasisBeforeReversal = (product.quantity + quantityToDelete > 0) ? product.purchasePrice / (product.quantity + quantityToDelete) : 0;
                     const returnCost = costBasisBeforeReversal * quantityToDelete;
                    product.purchasePrice -= returnCost;

                     // Ensure non-negative values
                     if (product.quantity < 0) {
                         console.warn(`Product quantity for ${product.name} went negative after return deletion. Setting to 0.`);
                         product.quantity = 0;
                     }
                     if (product.purchasePrice < 0) {
                          console.warn(`Product purchase price for ${product.name} went negative after return deletion. Setting to 0.`);
                          product.purchasePrice = 0;
                     }

                 } else {
                      console.warn(`Product ${returnToDelete.product} not found in branch ${returnToDelete.branch} during return deletion. Inventory not adjusted.`);
                 }
             }

            // Remove return record
            returns.splice(returnIndex, 1);
            await saveData();

            // Refresh UI
            updateProductsTable();
            document.dispatchEvent(new CustomEvent('returnDeleted')); // Refresh sales history
            populateProductSelect('sales');
            populateProductSelect('returns');
            populateProductSelect('receiving');


            Swal.fire('تم الحذف', 'تم حذف الارتجاع بنجاح', 'success');
        } else {
             console.error("Return to delete not found:", returnItem);
             Swal.fire('خطأ', 'لم يتم العثور على الارتجاع المراد حذفه.', 'error');
        }
    }
}

function displaySaleDetailsDialog(saleDetails) {
     if (!saleDetails) {
         console.error("displaySaleDetailsDialog called with invalid data");
         return;
     }
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    let formattedDate = 'غير متاح';
    try {
        formattedDate = saleDetails.date ? new Date(saleDetails.date).toLocaleString('ar-EG', options) : 'غير متاح';
    } catch(e) { console.error("Error formatting date for dialog:", saleDetails.date, e); }


    Swal.fire({
        title: 'تفاصيل عملية البيع',
        html: `
            <div style="text-align: right; max-height: 400px; overflow-y: auto; padding: 5px 10px;">
                <p><strong>التاريخ:</strong> ${formattedDate}</p>
                <p><strong>الفرع:</strong> ${saleDetails.branch || 'غير متاح'}</p>
                <p><strong>الصنف:</strong> ${saleDetails.product || 'غير متاح'}</p>
                <p><strong>الكمية:</strong> ${saleDetails.quantity || 0}</p>
                <p><strong>السعر:</strong> ${(parseFloat(saleDetails.price) || 0).toFixed(2)}</p>
                <p><strong>رقم هاتف العميل:</strong> ${saleDetails.customerPhone || 'لا يوجد'}</p>
                <p><strong>بيانات العميل:</strong> ${saleDetails.customerDetails || 'لا يوجد'}</p>
                <p><strong>التفاصيل:</strong> ${saleDetails.details || 'لا يوجد'}</p>
                <p><strong>المستخدم:</strong> ${saleDetails.user || 'غير متاح'}</p>
                <p><strong>وسيلة الدفع:</strong> ${saleDetails.paymentMethod || 'غير متاح'}</p>
            </div>
        `,
        confirmButtonText: 'إغلاق',
        customClass: { // Optional: Adjust width for better readability
            popup: 'swal-wide'
        }
    });
}

// Add custom CSS for the wide Swal if needed
const styleSheet = document.createElement("style");
styleSheet.textContent = ".swal-wide { width: 550px !important; }"; // Adjust width as needed
document.head.appendChild(styleSheet);