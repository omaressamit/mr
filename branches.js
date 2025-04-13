//For Branch Dropdown
function updateBranchSelect(selectId = 'branch-select') {
    const branchSelect = document.getElementById(selectId);
    if (!branchSelect) {
        console.error(`Select element with ID '${selectId}' not found.`);
        return;
    }
    branchSelect.innerHTML = '<option value="">اختر الفرع</option>';
    if (currentUser.role === 'admin') {
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.name;
            option.textContent = branch.name;
            branchSelect.appendChild(option);
        });
    } else {
        // Regular users only see assigned branches
        branches.forEach(branch => {
            if (branch.users.includes(currentUser.username)) {
                const option = document.createElement('option');
                option.value = branch.name;
                option.textContent = branch.name;
                branchSelect.appendChild(option);
            }
        });
    }
}

function updateBranchUsersList() {
    if (!currentUser || currentUser.role !== 'admin') {
        return;
    }
    const usersList = document.getElementById('branch-users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        if (user.role != 'admin') { //Don't add admin user in checkbox.
            const div = document.createElement('div');
            div.innerHTML = `
          <input type="checkbox" id="user-${user.username}" value="${user.username}">
         <label for="user-${user.username}">${user.username}</label>
       `;
            usersList.appendChild(div);
        }
    });
}

async function addBranch() {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            title: 'خطأ',
            text: 'يجب تسجيل الدخول كمسؤول لإضافة فرع',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return;
    }

    const branchName = document.getElementById('new-branch-name').value.trim();
    if (!branchName) {
        Swal.fire({
            title: 'خطأ',
            text: 'يرجى إدخال اسم الفرع',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return;
    }

    // Check for duplicate branch name
    if (branches.some(b => b.name === branchName)) {
        Swal.fire('خطأ', 'هذا الفرع موجود بالفعل', 'error');
        return;
    }
    const selectedUsers = [];
    document.querySelectorAll('#branch-users-list input[type="checkbox"]:checked').forEach(checkbox => {
        selectedUsers.push(checkbox.value);
    });
    // Requirement #5: Ensure at least one user is selected.
    if (selectedUsers.length === 0) {
        Swal.fire('خطأ', 'يجب اختيار مستخدم واحد على الأقل لهذا الفرع.', 'error');
        return;
    }

    // Check if selected users are already assigned to other branches
    for (const selectedUser of selectedUsers) {
        const userInOtherBranch = branches.some(branch =>
            branch.users.includes(selectedUser) && branch.name !== branchName
        );

        if (userInOtherBranch) {
            Swal.fire('خطأ', `المستخدم ${selectedUser} موجود بالفعل في فرع آخر.`, 'error');
            return;
        }
    }


    branches.push({ name: branchName, users: selectedUsers, products: [] }); //add Branches with users and initialize products
    await saveData();

    document.getElementById('new-branch-name').value = ''; // Clear name after added.
    document.querySelectorAll('#branch-users-list input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false; // Clear checkboxes
    });
    // Dispatch a custom event
    document.dispatchEvent(new CustomEvent('branchAdded'));


    Swal.fire({
        title: 'تم',
        text: 'تم إضافة الفرع بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });

}

function updateExistingBranches() {
    if (!currentUser || currentUser.role !== 'admin') {
        return; // Or show an appropriate message/redirection
    }
    const existingBranchesDiv = document.getElementById('existing-branches');
    existingBranchesDiv.innerHTML = '';

    if (branches.length === 0) {
        existingBranchesDiv.innerHTML = '<p>لا توجد فروع حالياً</p>';
        return;
    }

    //Add Branch
    branches.forEach(branch => {
        const branchDiv = document.createElement('div');
        branchDiv.className = 'branch-item';

        let usersListHTML = '<ul>';
        users.forEach(user => { //checkbox for each users.
            if (user.role !== 'admin') {// don't add checkbox to admin users
                const isChecked = branch.users.includes(user.username) ? 'checked' : '';
                usersListHTML += `
              <li>
                 <input type="checkbox" id="user-${branch.name}-${user.username}" value="${user.username}" ${isChecked}>
                 <label for="user-${branch.name}-${user.username}">${user.username}</label>
               </li>`;
            }
        });
        usersListHTML += '</ul>';
        // Put List and data for branches in branchDiv.
        branchDiv.innerHTML = `
     <h4>${branch.name}</h4>
       ${usersListHTML}
       <button onclick="updateBranchUsers('${branch.name}')">تحديث المستخدمين</button>
    `;
        existingBranchesDiv.appendChild(branchDiv); // Add branch div to the parent.
    });
}

//Corrected function
async function updateBranchUsers(branchName) {
    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            title: 'خطأ',
            text: 'يجب تسجيل الدخول كمسؤول لتحديث المستخدمين',
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
        return; // Return to stop further execution if NOT an admin.
    }
    //Retrieve branches first to resolve asynchronous errors
    await loadData();
    const branch = branches.find(b => b.name === branchName);

    if (!branch) {
        console.error("Branch not found:", branchName);
        return;
    }

    const newUsers = [];

    document.querySelectorAll(`#existing-branches input[type="checkbox"][id^="user-${branchName}-"]`).forEach(checkbox => {
        if (checkbox.checked) {
            newUsers.push(checkbox.value);
        }
    });


    // Requirement #5 (again): Check if user exists in a branch.
    //    Also prevent removing ALL users (must have at least one user)
    if (newUsers.length === 0) {
        Swal.fire('خطأ', 'لا يمكن إزالة جميع المستخدمين من الفرع. يجب أن يكون هناك مستخدم واحد على الأقل.', 'error');
        return;
    }

    for (const user of newUsers) { // Iterate each users of New User, to prevent remove the users
        const isUserExistInAnotherBranches = branches.some(currentbranch => {//check other branches of any one have current branch, that selected
            if (currentbranch.name == branchName) { //exclude target branches.
                return false;
            }
            //if user added into another branch or no.
            return currentbranch.users.includes(user); // Check only *other* branches, Not our current

        })

        //   If true, means this `user` is *also* in another branch
        if (isUserExistInAnotherBranches) {
            Swal.fire('خطأ', `المستخدم ${user} موجود بفرع اخر بالفعل `, 'error');
            return; // Stop: do *not* modify the branch users!
        }
    }
    branch.users = newUsers;
    try {  // Use try-catch.
        await saveData();
    } catch (error) {
        console.log(error); //catch the error
        return;    //stop the function
    }

    // Dispatch event after branch update
    document.dispatchEvent(new CustomEvent('branchAdded'));


    Swal.fire({
        title: 'تم',
        text: 'تم تحديث مستخدمي الفرع بنجاح',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });

}