// --- backupRestore.js ---

// --- Backup Functionality ---
async function backupData() {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire('خطأ', 'فقط المسؤول يمكنه إنشاء نسخ احتياطية.', 'error');
        return;
    }

    const { isConfirmed } = await Swal.fire({
        title: 'تأكيد إنشاء نسخة احتياطية',
        text: "هل أنت متأكد من رغبتك في تنزيل نسخة احتياطية كاملة من قاعدة البيانات؟",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، إنشاء نسخة احتياطية',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#aaa'
    });

    if (!isConfirmed) {
        return;
    }

    Swal.fire({
        title: 'جاري إنشاء النسخة الاحتياطية...',
        text: 'يرجى الانتظار، قد يستغرق الأمر بعض الوقت حسب حجم البيانات.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const snapshot = await database.ref('/').once('value');
        const data = snapshot.val();

        if (!data) {
            Swal.fire('فارغة', 'قاعدة البيانات فارغة، لا يوجد شيء لنسخه احتياطياً.', 'info');
            return;
        }

        const jsonData = JSON.stringify(data, null, 2); // Pretty print JSON
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `firebase-backup-${timestamp}.json`;

        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        Swal.fire({
            title: 'تم',
            text: 'تم تنزيل النسخة الاحتياطية بنجاح!',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error("Error creating backup:", error);
        handleError(error, 'خطأ أثناء إنشاء النسخة الاحتياطية');
        // Ensure loading Swal is closed on error
        Swal.close();
    }
}

// --- Restore Functionality ---

// This function triggers the hidden file input
function triggerRestore() {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire('خطأ', 'فقط المسؤول يمكنه استعادة نسخة احتياطية.', 'error');
        return;
    }
    // Trigger the click event of the hidden file input
    document.getElementById('restore-file-input').click();
}

// This function handles the file selection and initiates the restore process
async function handleRestoreFile(event) {
     if (!currentUser || currentUser.role !== 'admin') {
        // Extra safety check, though triggerRestore should prevent this
        console.warn("Non-admin attempted restore via file input.");
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return; // No file selected
    }

    // Reset the input value so the 'change' event fires even if the same file is selected again
    event.target.value = null;

    if (file.type !== 'application/json') {
        Swal.fire('خطأ', 'يرجى اختيار ملف بصيغة JSON.', 'error');
        return;
    }

    // --- CRITICAL CONFIRMATION ---
    const { value: confirmationText } = await Swal.fire({
        title: 'تأكيد الاستعادة الخطيرة!',
        html: `
            <p style="color: red; font-weight: bold;">تحذير شديد! هذا الإجراء سيقوم بحذف <span style="text-decoration: underline;">جميع</span> البيانات الحالية في قاعدة البيانات واستبدالها بمحتويات الملف المختار.</p>
            <p>هذا الإجراء <span style="text-decoration: underline; font-weight: bold;">لا يمكن التراجع عنه</span>.</p>
            <p>للتأكيد، يرجى كتابة كلمة "استعادة" في الحقل أدناه:</p>
        `,
        input: 'text',
        inputPlaceholder: 'اكتب "استعادة" هنا',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'تأكيد الاستعادة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d33', // Red color for danger
        cancelButtonColor: '#aaa',
        inputValidator: (value) => {
            if (value !== 'استعادة') {
                return 'يجب كتابة "استعادة" لتأكيد العملية!';
            }
        }
    });

    if (confirmationText !== 'استعادة') {
         Swal.fire('تم الإلغاء', 'لم يتم استعادة البيانات.', 'info');
         return; // User did not confirm correctly
    }

    // Proceed with restore after strong confirmation
    Swal.fire({
        title: 'جاري استعادة البيانات...',
        text: 'يرجى الانتظار، سيتم استبدال جميع البيانات الحالية.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const fileContent = e.target.result;
            const dataToRestore = JSON.parse(fileContent);

            // Optional: Basic validation - check if essential keys exist
            if (!dataToRestore || typeof dataToRestore !== 'object' || !dataToRestore.users || !dataToRestore.branches) {
                 throw new Error("ملف النسخة الاحتياطية غير صالح أو لا يحتوي على الهيكل المتوقع.");
            }


            // The core restore operation: OVERWRITE EVERYTHING
            await database.ref('/').set(dataToRestore);

            // IMPORTANT: Reload data into the application's memory
            await loadData();

            // Refresh UI elements based on the newly loaded data
            refreshAllPagesData(); // Call the function from refresh.js

            Swal.fire({
                 title: 'تم بنجاح!',
                 text: 'تم استعادة البيانات بنجاح من النسخة الاحتياطية.',
                 icon: 'success',
                 timer: 3000, // Give user time to read
                 showConfirmButton: true // Allow dismissal
            });

        } catch (error) {
            console.error("Error during restore:", error);
            let errorMsg = 'حدث خطأ أثناء استعادة البيانات.';
            if (error instanceof SyntaxError) {
                errorMsg = 'خطأ في تحليل ملف JSON. تأكد من أن الملف صالح.';
            } else if (error.message.includes("الهيكل المتوقع")) {
                errorMsg = error.message; // Use the specific validation error message
            }
            // Use the central error handler
            handleError(new Error(errorMsg), 'فشل الاستعادة'); // Pass a new Error object
            // Ensure loading Swal is closed on error
            Swal.close();
        }
    };

    reader.onerror = (e) => {
        console.error("File reading error:", e);
        handleError(new Error('حدث خطأ أثناء قراءة الملف.'), 'خطأ في قراءة الملف');
        // Ensure loading Swal is closed on error
        Swal.close();
    };

    reader.readAsText(file); // Start reading the file
}

// Add event listener to the hidden file input when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('restore-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleRestoreFile);
    } else {
        console.error("Restore file input element not found!");
    }
});