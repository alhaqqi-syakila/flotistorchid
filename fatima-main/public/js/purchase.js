document.addEventListener("DOMContentLoaded", () => {
    const productId = 1; // Replace with dynamic ID if needed
    const apiUrl = `http://localhost:3000/product/${productId}`;
  
    // Fetch product data from the server
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch product data");
        }
        return response.json();
      })
      .then((product) => {
        // Populate product details
        document.getElementById("product-name").textContent = product.name;
        document.getElementById("product-description").textContent = product.description;
        document.getElementById("product-price").textContent = product.price;
        document.getElementById("product-image").src = product.image_url;
  
        // Calculate total price
        const quantityInput = document.getElementById("quantity");
        const totalPriceEl = document.getElementById("total-price");
  
        const updateTotalPrice = () => {
          const quantity = parseInt(quantityInput.value) || 0;
          totalPriceEl.textContent = (product.price * quantity).toFixed(2);
        };
  
        quantityInput.addEventListener("input", updateTotalPrice);
        updateTotalPrice();
      })
      .catch((error) => {
        console.error(error);
        document.getElementById("product-info").textContent = "Failed to load product data.";
      });
  
    // Handle form submission
    const form = document.getElementById("purchase-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Purchase completed!");
      // Add server-side form submission logic here
    });
  });
  