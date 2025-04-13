// itemMovement.js

function showItemMovement() {
    const branchName = document.getElementById('item-movement-branch-select').value;
    const productName = document.getElementById('item-movement-product-select').value;
    const dateFromStr = document.getElementById('item-movement-date-from').value;
    const dateToStr = document.getElementById('item-movement-date-to').value;

    if (!branchName || !productName) {
        Swal.fire('خطأ', 'يرجى اختيار الفرع والصنف', 'error');
        return;
    }

    const dateFrom = dateFromStr ? new Date(dateFromStr) : null;
    const dateTo = dateToStr ? new Date(dateToStr) : null;
    if (dateTo) {
        dateTo.setHours(23, 59, 59, 999);
    }


    const filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.date).getTime();
        const branchMatch = sale.branch === branchName;
        const productMatch = sale.product === productName;
        const dateMatch = (!dateFrom || saleDate >= dateFrom.getTime()) && (!dateTo || saleDate <= dateTo.getTime());

        return branchMatch && productMatch && dateMatch;
    });


    const tableBody = document.querySelector('#item-movement-table tbody');
    tableBody.innerHTML = '';

   if(filteredSales.length === 0 ) {
       tableBody.innerHTML = '<tr><td colspan="4">لا توجد مبيعات لهذا الصنف</td></tr>'
         return;  //Added, Handle empty Sales.

   }
    //Sort with newer Date:
     filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date)); // Add sort with newer

    let totalSaleQuantity = 0;
    let totalSalePrice = 0;
    let totalPurchasePrice = 0;

    filteredSales.forEach(sale => {
      //added before created
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = new Date(sale.date).toLocaleDateString('ar-EG', options);
        const row = document.createElement('tr');

        // Find the corresponding product to get purchase price
        let purchasePricePerGram = 0;
         const branch = branches.find(b => b.name === sale.branch);  //find Branch
         if (branch) {  //Ensure the Branch Found
             const product = branch.products.find(p => p.name === sale.product);
             if (product) { // if Prouduct Found
                 // Calculate per-gram price, totalPurchases/ Quantities , becuase it price all , amount purchases / quantity to reach 1 gram
                 purchasePricePerGram = product.purchasePrice / product.quantity;

              }

        }

        const purchasePrice = purchasePricePerGram * sale.quantity;

        totalSaleQuantity += sale.quantity;
        totalSalePrice += sale.price;
        totalPurchasePrice += purchasePrice;


        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${sale.quantity}</td>
            <td>${sale.price}</td>
            <td>${purchasePrice.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.innerHTML = `
        <td><strong>المجموع</strong></td>
        <td><strong>${totalSaleQuantity.toFixed(2)}</strong></td>
        <td><strong>${totalSalePrice.toFixed(2)}</strong></td>
        <td><strong>${totalPurchasePrice.toFixed(2)}</strong></td>
    `;
    tableBody.appendChild(totalRow);
}

//Call this in `showPage`, to see changes
function updateItemMovementPage() {
      updateBranchSelect('item-movement-branch-select'); //added this when call movement , page ,
    // Update Item Selection, from Products Branches , consistent.
       const branchSelect = document.getElementById('item-movement-branch-select');
       const productSelect = document.getElementById('item-movement-product-select');

      productSelect.innerHTML = '<option value="">اختر الصنف</option>';

      // Add a listener to update on select to product by branch select.
    branchSelect.addEventListener('change' , ()=>{

      const selectedBranch = branches.find(b => b.name === branchSelect.value);
          if(selectedBranch && selectedBranch.products) {

               selectedBranch.products.forEach(product => {
                 const option = document.createElement('option');
                 option.textContent = product.name;
                 option.value = product.name;
                 productSelect.appendChild(option)
              });
         }

       })

    }