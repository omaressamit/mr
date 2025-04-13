//--- main.js ---
// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://omaressamit-f3607-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global Variables
let products = []; // Will be deprecated, kept for migration
let sales = [];
let returns = [];
let receiving = [];
let users = [];
let expenses = {}; // Initialize as an empty object
let branches = [];
let currentUser = null;
let workshopOperations = []; // NEW: Array for workshop operations

// Check for remembered login on page load
window.onload = async function () {
    await loadData();  // Load data first

    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
        try {
            const { username, password } = JSON.parse(rememberedUser);
                document.getElementById('username').value = username;
                document.getElementById('password').value = password;
                document.getElementById('remember-me').checked = true;

                // Find the user in the database
                const user = users.find(u => u.username === username && u.password === password);
                if (user) {
                    currentUser = user;
                    document.getElementById('home').style.display = 'none';
                    document.getElementById('main-menu').style.display = 'block';
                    document.querySelector('.nav-toggle').style.display = 'block';
                    if (user.role === 'admin') {
                        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
                    }
                    showPage('sales');
                } else {
                    // Clear if user not found
                    localStorage.removeItem('rememberedUser');
                    resetLoginForm();
                }
            } catch (error) {
                console.error("Error with remembered user:", error);
                localStorage.removeItem('rememberedUser');
                resetLoginForm();
            }
        }

        showHomePage(); // Initially show the home/login page
        // Hide all pages initially except the login
        document.querySelectorAll('.container').forEach(page => {
            page.style.display = 'none';
        });
        showPage('home');

        // Check for daily reset.  MUST be done AFTER loading sales.
        const today = new Date().toDateString();
        const lastReset = localStorage.getItem('lastDailySalesReset');

        if (lastReset !== today) {
            localStorage.setItem('dailySales_' + lastReset, JSON.stringify([])); //Clear Daily Sales, and persist.
            localStorage.setItem('lastDailySalesReset', today);
        }

        // --- Connection Status Indicator ---
        const statusElement = document.getElementById('connection-status');

        function updateConnectionStatus() {
            if (statusElement) { // Check if element exists
                if (navigator.onLine) {
                    statusElement.textContent = 'متصل';
                    statusElement.classList.remove('status-offline');
                    statusElement.classList.add('status-online');
                } else {
                    statusElement.textContent = 'غير متصل';
                    statusElement.classList.remove('status-online');
                    statusElement.classList.add('status-offline');
                     // Optional: Show a more prominent warning when offline
                     Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'warning',
                        title: 'غير متصل بالإنترنت!',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                     });
                }
            } else {
                console.error("Connection status element not found!");
            }
        }

        // Set initial status on page load
        updateConnectionStatus();

        // Listen for online/offline events
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        // --- End Connection Status Indicator ---


        // Event Listeners
        document.addEventListener('dataSaved', loadData);
        document.addEventListener('productAdded', updateProductsTable);
        document.addEventListener('expenseRecorded', showExpenses); //CHANGE HERE
        document.addEventListener('userAdded', updateUsersList); //for refresh users page
        document.addEventListener('branchAdded', updateExistingBranches); // For refresh Branch
        document.addEventListener('userDeleted', updateUsersList); //for refresh
        document.addEventListener('targetResetted', updateUsersList);// for refresh page
        document.addEventListener('returnDeleted', () => {
            showSalesHistory(); // to refresh and clear from data.
        });
        document.addEventListener('saleDeleted', showSalesHistory);// to refresh sales History page after any delete
        document.addEventListener('receivingDeleted', showPurchases); //For refreshing data after delete and call showPurchases
        document.addEventListener('dataLoaded', () => { //call it in loading to handle functions, to ensure loaddata
            updateBranchSelect('receiving-branch-select'); //for load products by default, when change or enter any dropdown
            populateProductSelect('receiving'); //by default
             updateBranchSelect('receiving-branch-filter'); // add this line when loaded data to select branch filter.
              updateBranchSelect('expenses-branch-filter'); // ADDED: Load branches for filter

        });
        document.addEventListener('receivingRecorded', () => {
            showPurchases();  //to show in table after any record
            updateProductsTable();   // to refresh products data
        });
        document.addEventListener('dataLoaded', () => {
            updateBranchSelect('add-product-branch-select');  // for consistent
            updateProductsTable(); // to load it
        });

        document.addEventListener('returnRecorded', () => {
            updateProductsTable(); //update
        });
        document.addEventListener('saleRecorded', () => {  //make
            updateTargetDisplay();  // update
            updateProductsTable(); // update.
            updateDailySalesTable(); // add this table.
        });
        document.addEventListener('dataLoaded', () => {
            updateDailySalesTable(); // ensure appears when user inter the sales page
            updateBranchSelect('expense-branch-select');  // for load branches select

        });
          document.addEventListener('dataLoaded', () => {
            //for load user option for first one , its by defualt at start page, to consistence.

               updateBranchSelect('expense-branch-select');  //for consistent
               updateExpensesPage();
          });
    //Add this event listener to when selected branch change, call updated, to consistent
      document.addEventListener('dataLoaded' , ()=>{
             updateBranchSelect('expense-branch-select'); // call branch expense to update it
             updateExpenseForm();//call when appears data to update the form
        });
    // Add Event Listener to When Selected other branches
    document.getElementById('expense-branch-select').addEventListener('change', updateExpenseForm);
   //Add Event Listener When Product added
   document.addEventListener('productAdded', updateProductsTable);
   document.addEventListener('workshopRecorded', showWorkshopOperations); // NEW: Update workshop tables

    // Add event listener to branch-select to populate employee dropdown on branch change
    document.getElementById('branch-select').addEventListener('change', populateBranchEmployeeSelect);
}; // End of window.onload

    function resetLoginForm() {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('remember-me').checked = false;
        document.querySelector('.nav-toggle').style.display = 'none';
    }

    function showPage(pageId) {
        if (!currentUser && pageId !== 'home') { // Allow showing home page even if not logged in
            showHomePage(); // Redirect to home/login if no user is logged in and trying to access other pages
            return;
        }

        const adminOnlyPages = ['sales-history', 'add-product', 'item-movement', 'receiving', 'users', 'branches'];

        // Apply admin check only if the user is logged in and the page is admin-only
        if (currentUser && adminOnlyPages.includes(pageId) && currentUser.role !== 'admin') {
             Swal.fire({
                 title: 'خطأ في الصلاحية',
                 text: 'هذه الصفحة مخصصة للمسؤولين فقط.',
                 icon: 'error',
                 confirmButtonText: 'حسناً'
             });
             // Optionally, redirect to a default user page (like 'sales')
             showPage('sales');
             return; // Stop further execution of showPage
         }


        // If it's not an admin-only page, or if it is and the user is admin, or if it's the home page, proceed:
        document.querySelectorAll('.container').forEach(page => {
            page.style.display = 'none';
        });

        const targetPage = document.getElementById(pageId);
        if (targetPage) { // Check if page exists
             targetPage.style.display = 'block';
        } else {
            console.error(`Page with ID '${pageId}' not found.`);
             showHomePage(); // Show home page as fallback if target page doesn't exist
             return;
        }


        // Show/hide nav toggle button based on page.
        document.querySelector('.nav-toggle').style.display = pageId === 'home' ? 'none' : 'block';
         // Hide/show main menu based on page
        document.getElementById('main-menu').style.display = pageId === 'home' ? 'none' : 'block';

        document.querySelectorAll('.nav-bar a').forEach(link => {
            link.classList.remove('active');
             // Check if href exists before trying to access its value
            const href = link.getAttribute('href');
            if (href && href === '#' + pageId) {
                link.classList.add('active');
            }
        });

        // Hide navigation bar after selection (for mobile responsiveness)
        const mainMenu = document.getElementById('main-menu');
        if(mainMenu) mainMenu.classList.remove('show');

        // --- Call page-specific update functions ---
        // Use optional chaining (?.) in case elements don't exist on a page
        if (pageId === 'sales-history') {
            updateBranchFilter();
        } else if (pageId === 'users') {
            updateUsersList();
        } else if (pageId === 'branches') {
            updateBranchUsersList();
            updateExistingBranches();
        } else if (pageId === 'sales') {
            updateBranchSelect();
            updateTargetDisplay();
            populateProductSelect('sales'); // Populate after branch select
            updateDailySalesTable();
            populateBranchEmployeeSelect(); // Populate employee dropdown on sales page
        } else if (pageId === 'expenses') {
            updateExpensesPage();
        } else if (pageId === 'receiving') {
            updateReceivingPage();
        } else if (pageId === 'add-product') {
            updateBranchSelect('add-product-branch-select');
            updateProductsTable();
        }
         else if (pageId === 'returns') {
            updateBranchSelect('returns-branch-select');
            populateProductSelect('returns');
        }
        else if (pageId === 'workshop') {
            updateBranchSelect('workshop-branch-select');
            updateWorkshopPage();
        }
        else if (pageId === 'item-movement'){
            updateItemMovementPage();
       }
    }

    function showHomePage() { // Helper function to consistently show the home/login page
        document.querySelectorAll('.container').forEach(page => {
            page.style.display = 'none';
        });
        const homePage = document.getElementById('home');
        if(homePage) homePage.style.display = 'block';

        const mainMenu = document.getElementById('main-menu');
        if(mainMenu) mainMenu.style.display = 'none';

        const navToggle = document.querySelector('.nav-toggle');
        if(navToggle) navToggle.style.display = 'none';
    }


    function toggleNav() {
        const mainMenu = document.getElementById('main-menu');
        if(mainMenu) mainMenu.classList.toggle('show');
    }

    async function loadData() {
        // Check for internet connection before attempting to load
        if (!navigator.onLine) {
            // Don't show Swal error here, let the status indicator handle it.
            // Just prevent further loading if offline initially.
             console.warn("Offline: Cannot load data from Firebase.");
            // Optionally, try loading from local cache if implemented
            return; // Stop loading from Firebase
        }
        try {
            const snapshot = await database.ref('/').once('value');
            const data = snapshot.val() || {};

            // Load data, handling the migration to branch-specific products
            products = data.products || []; // Keep for migration
            sales = data.sales || [];
            returns = data.returns || [];
            receiving = data.receiving || [];
            users = data.users || [];
            expenses = data.expenses || {}; // Initialize as an empty object
            branches = data.branches || [];
            workshopOperations = data.workshopOperations || []; // NEW: Load workshop operations

            // Migrate old products to branch-specific structure (if needed)
            if (products.length > 0 && branches.length > 0) {
                // Assuming the first branch is the default for old products
                const defaultBranchName = branches[0].name;
                const defaultBranch = branches.find(b => b.name === defaultBranchName);

                if (defaultBranch) {
                    // Initialize the products array if it doesn't exist
                    defaultBranch.products = defaultBranch.products || [];

                    // Add all existing products to the default branch
                    products.forEach(product => {
                        // Avoid adding duplicates if migration runs multiple times
                        if (!defaultBranch.products.some(p => p.name === product.name)) {
                             defaultBranch.products.push(product);
                        }
                    });

                    // Clear the global products array AFTER successful migration attempt
                    products = [];
                    await saveData(); // Save immediately after migration attempt
                }
            }
               if (Array.isArray(data.expenses) && data.expenses.length > 0) {
                  const migratedExpenses = {};  // temp.
                  data.expenses.forEach(expense => {
                    // Determine branch: Use expense.branch, fallback to first branch, or 'defaultBranch'
                    const branchName = expense.branch || (branches.length > 0 ? branches[0].name : 'defaultBranch');
                    if (!migratedExpenses[branchName]) {
                       migratedExpenses[branchName] = []; // Initialize if new branch
                    }
                    // Avoid adding duplicates during potential multiple loads/migrations
                    // Simple check based on date and amount (adjust if more uniqueness needed)
                     if (!migratedExpenses[branchName].some(ex => ex.date === expense.date && ex.amount === expense.amount)) {
                         migratedExpenses[branchName].push(expense);
                     }
                  });
                  expenses = migratedExpenses; // Assign the structured expenses
                  // Optionally save data here if you want to persist the expense migration immediately
                   await saveData();
               }

            // Create admin user if no users exist
            if (!users || users.length === 0) {
                const adminUser = {
                    username: 'admin',
                    password: 'admin123', // Consider a more secure initial setup
                    role: 'admin'
                };
                users = [adminUser];
                 // Only attempt to save if online
                 if (navigator.onLine) {
                     await database.ref('/users').set(users);
                 }
            }
            // Update UI elements that depend on loaded data
            populateProductSelect('sales');
            populateProductSelect('returns');
            populateProductSelect('receiving');

            document.dispatchEvent(new CustomEvent('dataLoaded')); //for any functions need loaded Data.

        } catch (error) {
             // Check if the error is due to network issues before showing generic error
            if (!navigator.onLine) {
                 console.error("Firebase load error while offline:", error);
                 // Optionally show a specific offline error, but status indicator might be enough
            } else {
                handleError(error, "خطأ في تحميل البيانات"); // Use centralized error handling for other errors
            }
        }
    }

    async function saveData() {
        // Check for internet connection before attempting to save
        if (!navigator.onLine) {
            // Use the centralized error handler for offline message
            handleError(new Error("لا يوجد اتصال بالإنترنت. لم يتم حفظ التغييرات."));
            return Promise.reject(new Error("Offline")); // Return a rejected promise to signal failure
        }

        try {
            await database.ref('/').set({
                // products: products, // products should be empty/deprecated, saving it might overwrite branch data if not careful
                sales,
                returns,
                receiving,
                users,
                expenses, //save expenses After Added, and structred.
                branches, // Branches now contain their products
                workshopOperations, // NEW: Save workshop operations

            });
            document.dispatchEvent(new CustomEvent('dataSaved')); // for any function need to persist
            console.log('Data saved successfully to Firebase');
            return Promise.resolve(); // Signal success
        } catch (error) {
            handleError(error, "خطأ في حفظ البيانات"); //Centralized.
            return Promise.reject(error); // Signal failure
        }
    }

    async function login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const rememberMe = document.getElementById('remember-me').checked;

        if (!username || !password) {
            Swal.fire({
                title: 'خطأ',
                text: 'يرجى إدخال اسم المستخدم وكلمة المرور',
                icon: 'error',
                confirmButtonText: 'حسناً'
            });
            return;
        }
        // Load data *before* checking login, in case it wasn't loaded yet
         await loadData();

        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            currentUser = user;
            if (rememberMe) {
                localStorage.setItem('rememberedUser', JSON.stringify({ username, password })); //store the user
            } else {
                localStorage.removeItem('rememberedUser'); //remove if exists
            }
            document.getElementById('home').style.display = 'none';
            document.getElementById('main-menu').style.display = 'block';
            document.querySelector('.nav-toggle').style.display = 'block'; // Show nav toggle after login

            // Display admin-only links if the user is an admin
            document.querySelectorAll('.admin-only').forEach(el => {
                 el.style.display = user.role === 'admin' ? 'block' : 'none';
             });

            await Swal.fire({ //Added await
                title: 'مرحباً',
                text: 'تم تسجيل الدخول بنجاح',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            showPage('sales'); // Show after login successfully.

        } else {
            Swal.fire({
                title: 'خطأ',
                text: 'اسم المستخدم أو كلمة المرور غير صحيحة',
                icon: 'error',
                confirmButtonText: 'حسناً'
            });
        }
    }

    function logout() {
        //clear all data
        currentUser = null;
        localStorage.removeItem('rememberedUser');
        resetLoginForm(); // Clear form fields
        showHomePage(); // Show login page after logout

        // Hide elements meant only for logged-in users or specific roles
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        // Optionally hide other elements that shouldn't be visible when logged out
        // e.g., hide the nav toggle and menu explicitly if showHomePage doesn't handle it fully
         const navToggle = document.querySelector('.nav-toggle');
         if (navToggle) navToggle.style.display = 'none';
         const mainMenu = document.getElementById('main-menu');
         if (mainMenu) mainMenu.style.display = 'none';


        Swal.fire({
            title: 'تم',
            text: 'تم تسجيل الخروج بنجاح',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }
    //Centralized Error Function, To handle All Error with descriptive message, I can take error and title also
    function handleError(error, title = 'خطأ') {
        console.error(title, error); // Log the error for debugging

        let message = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'; // A generic message

        // Check for specific Firebase error codes or common messages
        if (error.code === 'PERMISSION_DENIED') {
             message = "ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء.";
        } else if (error.message && error.message.toLowerCase().includes("network request failed")) {
             message = "فشل طلب الشبكة. يرجى التحقق من اتصالك بالإنترنت.";
        } else if (error.message && error.message.includes("لا يوجد اتصال بالإنترنت")) {
             message = "لا يوجد اتصال بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.";
        }
         // You can add more specific error checks here based on Firebase codes or messages

        Swal.fire({
            title: title,
            text: message,
            icon: 'error',
            confirmButtonText: 'حسناً'
        });
    }

    //getData to return current data , without parameter to return all
    function getData(type) {
        switch (type) {
            case 'users':
                return users;
            case 'branches':
                return branches;
            case 'sales':
                return sales;
            case 'returns':
                return returns;
            case 'receiving':
                return receiving;
            case 'expenses':
                return expenses;
            case 'currentUser':
                return currentUser;
            case 'workshopOperations': // NEW: Get workshop operations
                return workshopOperations;
            default:
                // If no specific data type is requested, return all data
                return {
                    users,
                    branches,
                    sales,
                    returns,
                    receiving,
                    expenses,
                    currentUser,
                    workshopOperations // NEW: Include workshop operations
                };
        }
    }