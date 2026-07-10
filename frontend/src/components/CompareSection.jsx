import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

const CompareSection = () => {
  const [compareItems, setCompareItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCompare = async () => {
    try {
      setLoading(true);
      const stored = localStorage.getItem("valkey_compare");
      const ids = stored ? JSON.parse(stored) : [];
      if (ids.length === 0) {
        setCompareItems([]);
        setLoading(false);
        return;
      }

      const fetchedProducts = [];
      for (const id of ids) {
        try {
          const product = await api.products.get(id);
          if (product) {
            fetchedProducts.push(product);
          }
        } catch (err) {
          console.error(`Failed to fetch product ${id} for compare:`, err);
        }
      }
      setCompareItems(fetchedProducts);
    } catch (err) {
      console.error("Failed to load compared products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompare();
    window.addEventListener("compareUpdate", fetchCompare);
    return () => {
      window.removeEventListener("compareUpdate", fetchCompare);
    };
  }, []);

  const handleRemove = (productId) => {
    const stored = localStorage.getItem("valkey_compare");
    let ids = stored ? JSON.parse(stored) : [];
    ids = ids.filter((id) => id !== productId);
    localStorage.setItem("valkey_compare", JSON.stringify(ids));
    setCompareItems((prev) => prev.filter((item) => item.id !== productId));
    
    // Notify headers
    window.dispatchEvent(new Event("compareUpdate"));
  };

  const handleAddToCart = async (productId) => {
    try {
      await api.cart.addItem(productId, 1);
      
      // Track add-to-cart in Valkey
      await api.products.trackEvent(productId, "add-to-cart").catch(() => {});
      
      // Notify headers
      window.dispatchEvent(new Event("cartUpdate"));
      alert("Product added to cart!");
    } catch (err) {
      console.error("Failed to add to cart from compare:", err);
      alert("Failed to add product to cart.");
    }
  };

  const formatPrice = (amount) => {
    return `INR ${Number(amount).toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <section className="cart py-80">
        <div className="container container-lg text-center">
          <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-24 text-gray-500 fw-medium">Loading comparison...</p>
        </div>
      </section>
    );
  }

  if (compareItems.length === 0) {
    return (
      <section className="cart py-80">
        <div className="container container-lg text-center">
          <div className="border border-gray-100 rounded-16 p-48 bg-white max-w-600 mx-auto box-shadow-xl">
            <span className="w-80 h-80 bg-main-two-50 text-main-two-600 rounded-circle flex-center text-4xl mx-auto mb-24">
              <i className="ph ph-shuffle" />
            </span>
            <h4 className="mb-8 text-gray-900 fw-bold">Compare List is Empty</h4>
            <p className="text-gray-500 mb-32">
              Add products side-by-side to compare features, prices, and stock statuses.
            </p>
            <Link to="/shop" className="btn btn-main-two py-18 px-40 rounded-8">
              Choose Products
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cart py-80">
      <div className="container container-lg">
        <div className="row gy-4">
          <div className="col-12">
            <div className="section-heading mb-32 text-start">
              <h5 className="mb-8">Product Comparison</h5>
              <p className="text-gray-500 mb-0">Comparing {compareItems.length} product(s) side-by-side</p>
            </div>
            
            <div className="table-responsive border border-gray-100 rounded-8 bg-white box-shadow-md">
              <table className="table table-bordered mb-0 align-middle text-start">
                <thead>
                  <tr className="bg-gray-50 text-gray-900 font-heading-two text-center">
                    <th className="fw-bold px-24 py-16" style={{ minWidth: '200px', backgroundColor: '#f8f9fa' }}>Features</th>
                    {compareItems.map(item => (
                      <th key={item.id} className="fw-bold px-24 py-16" style={{ minWidth: '250px' }}>
                        <div className="position-relative text-center">
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="btn btn-sm btn-outline-danger position-absolute top-0 end-0 rounded-circle border-0 flex-center"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            title="Remove"
                          >
                            <i className="ph ph-x text-lg" />
                          </button>
                          <Link to={`/product-details?id=${item.id}`} className="d-block mt-24 mb-12 flex-center" style={{ height: '140px', overflow: 'hidden' }}>
                            <img
                              src={item.images?.[0]?.url || 'assets/images/thumbs/product-two-img1.png'}
                              alt={item.name}
                              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            />
                          </Link>
                          <span className="py-2 px-8 text-xs rounded-pill text-main-two-600 bg-main-two-50 mb-8 d-inline-block">
                            {item.brand}
                          </span>
                          <h6 className="text-md fw-semibold mb-0 text-line-2 text-dark hover-text-main-600">
                            <Link to={`/product-details?id=${item.id}`}>{item.name}</Link>
                          </h6>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-bold px-24 py-16 bg-gray-50">Price</td>
                    {compareItems.map(item => (
                      <td key={item.id} className="px-24 py-16 fw-bold text-lg text-heading text-center">
                        {formatPrice(item.price.amount)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="fw-bold px-24 py-16 bg-gray-50">Ratings</td>
                    {compareItems.map(item => (
                      <td key={item.id} className="px-24 py-16 text-center">
                        <div className="d-flex align-items-center justify-content-center gap-6">
                          <span className="text-md fw-bold text-gray-900">{item.ratings?.average || 0}</span>
                          <span className="text-15 fw-bold text-warning-600 d-flex">
                            <i className="ph-fill ph-star" />
                          </span>
                          <span className="text-xs text-gray-500">({item.ratings?.count || 0} reviews)</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="fw-bold px-24 py-16 bg-gray-50">Description</td>
                    {compareItems.map(item => (
                      <td key={item.id} className="px-24 py-16 text-sm text-gray-600 text-center" style={{ verticalAlign: 'top' }}>
                        {item.description || "High quality e-commerce product from top-tier brand."}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="fw-bold px-24 py-16 bg-gray-50">Stock Status</td>
                    {compareItems.map(item => {
                      const isOutOfStock = item.inventory?.quantity - (item.inventory?.reserved || 0) <= 0;
                      return (
                        <td key={item.id} className="px-24 py-16 text-center">
                          <span className={`text-xs fw-semibold py-4 px-12 rounded-pill ${
                            isOutOfStock ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600'
                          }`}>
                            {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="fw-bold px-24 py-16 bg-gray-50">Action</td>
                    {compareItems.map(item => {
                      const isOutOfStock = item.inventory?.quantity - (item.inventory?.reserved || 0) <= 0;
                      return (
                        <td key={item.id} className="px-24 py-16 text-center">
                          <button
                            onClick={() => handleAddToCart(item.id)}
                            disabled={isOutOfStock}
                            type="button"
                            className="btn btn-main-two rounded-8 px-24 py-12 flex-align gap-8 mx-auto"
                          >
                            Add To Cart <i className="ph ph-shopping-cart" />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompareSection;
