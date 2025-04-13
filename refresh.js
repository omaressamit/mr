// refresh.js

async function refreshData() {
    // Display a loading message
    Swal.fire({
        title: 'تحديث البيانات',
        text: '...جاري تحديث البيانات',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Reload data from Firebase
        await loadData();
        refreshAllPagesData(); // Call the new function to refresh all pages data
        // Close the loading message
        Swal.close();

    } catch (error) {
       handleError(error , "حدث خطأ في تحديث البيانات");
    }
}

function refreshAllPagesData() {
    // Get the currently active page to re-show it after refresh (optional, for keeping user context)
    let activePageId = null;
    let activePageElement = document.querySelector('.nav-bar a.active');
    if (activePageElement) {
        activePageId = activePageElement.getAttribute('href').substring(1);
    }

    // --- Refresh data for each page ---

    // Sales Page
    updateTargetDisplay(); // تحديث عرض التارجت (جزء ثابت من الصفحة)
    populateProductSelect('sales'); // تحديث قائمة الأصناف المنسدلة
    updateDailySalesTable(); // تحديث جدول مبيعات اليوم للمستخدم الحالي (جزء ثابت من الصفحة)
    updateBranchSelect('branch-select'); // تحديث قائمة الفروع المنسدلة

    // Sales History Page
    updateBranchFilter(); // تحديث قائمة الفروع *للفلتر* (وليس عرض الجدول)
    // showSalesHistory(); // <<-- تم التعليق/الحذف: لا نعرض الجدول تلقائياً

    // Add Product Page
    updateBranchSelect('add-product-branch-select'); // تحديث قائمة الفروع المنسدلة
    updateProductsTable(); // تحديث جدول الأصناف (محتوى رئيسي للصفحة)

    // Returns Page
    updateBranchSelect('returns-branch-select'); // تحديث قائمة الفروع المنسدلة
    populateProductSelect('returns'); // تحديث قائمة الأصناف المنسدلة

    // Receiving Goods Page
    updateBranchSelect('receiving-branch-select'); // تحديث قائمة الفروع المنسدلة
    populateProductSelect('receiving'); // تحديث قائمة الأصناف المنسدلة
    updateBranchSelect('receiving-branch-filter'); // تحديث قائمة الفروع *للفلتر*
    // showPurchases(); // <<-- تم التعليق/الحذف: لا نعرض الجدول تلقائياً

    // Expenses Page
    updateBranchSelect('expense-branch-select'); // تحديث قائمة الفروع المنسدلة
    updateExpensesPage(); // تحديث حقول النموذج (مثل قائمة المستخدمين للمرتبات)
    updateBranchSelect('expenses-branch-filter'); // تحديث قائمة الفروع *للفلتر* (تمت إضافتها للتأكيد)
    // showExpenses(); // <<-- تم التعليق/الحذف: لا نعرض الجدول تلقائياً

    // User Management Page
    updateUsersList(); // تحديث جدول المستخدمين (محتوى رئيسي للصفحة)

    // Branches Page
    updateBranchUsersList(); // تحديث قائمة المستخدمين عند إضافة فرع
    updateExistingBranches(); // تحديث عرض الفروع الحالية (محتوى رئيسي للصفحة)

    // Workshop Page
    updateBranchSelect('workshop-branch-select'); // تحديث قائمة الفروع المنسدلة
    updateBranchSelect('workshop-branch-filter'); // تحديث قائمة الفروع *للفلتر*
    // showWorkshopOperations(); // <<-- تم التعليق/الحذف: لا نعرض الجدول تلقائياً

    // Item Movement Page
    updateItemMovementPage(); // تحديث القوائم المنسدلة في صفحة حركة الصنف
    // Populate product select is likely handled within updateItemMovementPage

    // --- Re-show the active page if we remembered it ---
    if (activePageId && document.getElementById(activePageId)) { // Check if pageId exists
        showPage(activePageId);
    } else {
        // If no active page was tracked or page doesn't exist, default to sales page.
        showPage('sales'); // or your desired default page after refresh
    }
}