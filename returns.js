
let lastReturnClickTime = 0; // Initialize timestamp for returns

async function recordReturn() {
    if (!currentUser) {
        Swal.fire('خطأ', 'يجب تسجيل الدخول أولاً', 'error');
        return;
    }

    // Double-click prevention (5 seconds)
    const now = Date.now();
    if (now - lastReturnClickTime < 5000) {
        Swal.fire('خطأ', 'يرجى الانتظار 5 ثوانٍ قبل تسجيل ارتجاع آخر.', 'error');
        return;
    }
    lastReturnClickTime = now; // Update timestamp


    // Use document.getElementById() correctly
    const branchName = document.getElementById('returns-branch-select').value;
    const productName = document.getElementById('return-product-select').value.trim();
    const returnQuantity = parseInt(document.getElementById('return-quantity').value.trim()) || 1;
    const returnPrice = parseFloat(document.getElementById('return-price').value.trim());
    const reason = document.getElementById('return-reason').value.trim();


    if (!branchName || !productName || !returnPrice || !reason || !returnQuantity) {
        Swal.fire('خطأ', 'يرجى إدخال جميع الحقول المطلوبة', 'error');
        return;
    }
    if (isNaN(returnQuantity) || returnQuantity <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال كمية صحيحة (عدد أكبر من صفر)', 'error');
        return;
    }
    if (isNaN(returnPrice) || returnPrice <= 0) {
        Swal.fire('خطأ', 'يرجى إدخال السعر صحيح أكبر من صفر', 'error');
        return;
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

    // Add back to the branch's product quantity and adjust purchase price
    selectedBranch.products[productIndex].quantity += returnQuantity;
    const returnCost = (selectedBranch.products[productIndex].purchasePrice / (selectedBranch.products[productIndex].quantity - returnQuantity)) * returnQuantity; // Calculate based on *original* quantity
    selectedBranch.products[productIndex].purchasePrice += returnCost;


    returns.push({
        date: new Date().toISOString(), // Use ISO strings
        branch: branchName,
        product: productName,
        quantity: returnQuantity,
        price: returnPrice,
        reason: reason,
        user: currentUser.username
    });

    await saveData();
    // Reset form fields
    document.getElementById('return-product-select').value = ''; // Reset select
    document.getElementById('return-quantity').value = '1'; // Reset quantity to default 1.
    document.getElementById('return-price').value = '';      // Reset other inputs.
    document.getElementById('return-reason').value = '';
    populateProductSelect('returns');

    // Dispatch event to notify that a return has been recorded
    document.dispatchEvent(new CustomEvent('returnRecorded'));


    Swal.fire({
        title: 'تم',
        text: 'تم تسجيل الارتجاع بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}