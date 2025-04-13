async function addUser() {

    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            title: 'خطأ',
            text: 'يجب تسجيل الدخول كمسؤول لإضافة مستخدم',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return;
    }
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const role = document.getElementById('new-user-role').value;

    if (!username || !password) {
        Swal.fire('خطأ', 'يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
        return;
    }

    // Check if the username already exists
    if (users.some(u => u.username === username)) {
        Swal.fire('خطأ', 'اسم المستخدم موجود بالفعل', 'error');
        return;
    }

    // Add new users.
    users.push({ username, password, role });
    await saveData();

    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-user-role').value = 'user';

    // Dispatch custom event for add user
    document.dispatchEvent(new CustomEvent('userAdded'));


    Swal.fire({
        title: 'تم',
        text: 'تم إضافة المستخدم بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });

}

async function updateUsersList() {
    // Requirement #1 : Update this list (add target button here)
    // Check if the user is logged in and has admin role
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            title: 'خطأ',
            text: 'يجب تسجيل الدخول كمسؤول لعرض المستخدمين',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return; // Stop execution if not an admin
    }
    const usersList = document.querySelector('#users-list tbody'); //select the tbody.
    usersList.innerHTML = '';
    if (users.length === 0) {
        usersList.innerHTML = '<tr><td colspan="4">لا يوجد مستخدمين</td></tr>';
        return;
    }
    // Requirement #2: Limit visible rows, *BUT* since no filters on users, this is static
    const usersToShow = users.slice(0, 30); //always take first 30.

    usersToShow.forEach(user => {
        const row = usersList.insertRow();
        row.insertCell(0).textContent = user.username;
        row.insertCell(1).textContent = user.role === 'admin' ? 'مسؤول' : 'مستخدم';

        // Calculate total sales (target) for each user
        let totalSales = 0;
        sales.forEach(sale => {
            if (sale.user === user.username) {
                totalSales += parseFloat(sale.price);
            }
        });
        row.insertCell(2).textContent = totalSales.toFixed(2); // Display total sales in new cell


        const actionsCell = row.insertCell(3); // Create cell to (Delete and reset buttons)
        if (user.username !== currentUser.username) {
            // Delete button
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'حذف';
            deleteButton.onclick = () => deleteUser(user.username);
            deleteButton.className = 'delete-btn';
            actionsCell.appendChild(deleteButton);  //add delete button in action cell
            // Reset Target button (only for admins, placed in this block so it's NOT self-applicable
            if (currentUser.role === 'admin') {  //Must be in *THIS BLOCK* to prevent on current admin
                const resetTargetButton = document.createElement('button');
                resetTargetButton.textContent = 'تصفير التارجت';
                resetTargetButton.onclick = () => resetUserTarget(user.username);
                resetTargetButton.className = 'reset-target-btn';  // Class is defined in style.css.
                actionsCell.appendChild(resetTargetButton);
            }

        } else {
            row.insertCell(3).textContent = '(المستخدم الحالي)';
        }
    });

     // Update table header to include "Target/Total Sales"
     const tableHeaderRow = usersList.parentElement.querySelector('thead tr');
     tableHeaderRow.innerHTML = `
         <th>اسم المستخدم</th>
         <th>نوع المستخدم</th>
         <th>التارجت/إجمالي المبيعات</th>
         <th>الإجراءات</th>
     `;
}

async function deleteUser(username) {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            title: 'خطأ',
            text: 'يجب تسجيل الدخول كمسؤول لحذف المستخدمين',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return;
    }
    // Prevent self-deletion
    if (username === currentUser.username) {
        Swal.fire({
            title: 'خطأ',
            text: 'لا يمكنك حذف حسابك الحالي',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return;
    }

    const result = await Swal.fire({
        title: 'تأكيد',
        text: 'هل أنت متأكد من حذف هذا المستخدم؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });

    if (result.isConfirmed) {
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            users.splice(userIndex, 1);
            await saveData();

            // Dispatch a custom event
            document.dispatchEvent(new CustomEvent('userDeleted'));


            Swal.fire({
                title: 'تم',
                text: 'تم حذف المستخدم بنجاح',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    }
}

async function resetUserTarget(username) {  //Get Username of user
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            title: 'خطأ',
            text: 'يجب تسجيل الدخول كمسؤول لتصفير التارجت',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return;
    }
    //Confirmation Delete Target
    const confirmResult = await Swal.fire({
        title: 'تأكيد',
        text: `هل أنت متأكد من تصفير التارجت للمستخدم ${username}؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'إلغاء'

    });

    if (confirmResult.isConfirmed) { //Ensure select a user.
        // Remove *ALL* sales records for selected user (correct for resetting a "target")
        sales = sales.filter(sale => sale.user !== username); //update current value with non equal
        await saveData(); //persist data in database.
        // Dispatch event to signal
        document.dispatchEvent(new CustomEvent('targetResetted'));


        Swal.fire({ // success confirmation.
            title: 'تم',
            text: `تم تصفير التارجت للمستخدم ${username} بنجاح`,
            icon: 'success',
            timer: 1500, //disappear after time, better experience.
            showConfirmButton: false, //No 'OK' to show to users.
        });
    }
}