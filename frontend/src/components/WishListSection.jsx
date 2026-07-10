import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

const WishListSection = () => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const stored = localStorage.getItem("valkey_wishlist");
      const ids = stored ? JSON.parse(stored) : [];
      if (ids.length === 0) {
        setWishlistItems([]);
        setLoading(false);
        return;
      }

      // Fetch each product detail
      const fetchedProducts = [];
      for (const id of ids) {
        try {
          const product = await api.products.get(id);
          if (product) {
            fetchedProducts.push(product);
          }
        } catch (err) {
          console.error(`Failed to fetch product ${id} for wishlist:`, err);
        }
      }
      setWishlistItems(fetchedProducts);
    } catch (err) {
      console.error("Failed to load wishlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
    window.addEventListener("wishlistUpdate", fetchWishlist);
    return () => {
      window.removeEventListener("wishlistUpdate", fetchWishlist);
    };
  }, []);

  const handleRemove = (productId) => {
    const stored = localStorage.getItem("valkey_wishlist");
    let ids = stored ? JSON.parse(stored) : [];
    ids = ids.filter((id) => id !== productId);
    localStorage.setItem("valkey_wishlist", JSON.stringify(ids));
    setWishlistItems((prev) => prev.filter((item) => item.id !== productId));
    
    // Notify headers
    window.dispatchEvent(new Event("wishlistUpdate"));
  };

  const handleAddToCart = async (productId) => {
    try {
      await api.cart.addItem(productId, 1);
      
      // Track add-to-cart event in Valkey
      await api.products.trackEvent(productId, "add-to-cart").catch(() => {});
      
      // Notify headers
      window.dispatchEvent(new Event("cartUpdate"));
      alert("Product added to cart!");
    } catch (err) {
      console.error("Failed to add to cart from wishlist:", err);
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
          <p className="mt-24 text-gray-500 fw-medium">Loading your wishlist...</p>
        </div>
      </section>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <section className="cart py-80">
        <div className="container container-lg text-center">
          <div className="border border-gray-100 rounded-16 p-48 bg-white max-w-600 mx-auto box-shadow-xl">
            <span className="w-80 h-80 bg-main-50 text-main-600 rounded-circle flex-center text-4xl mx-auto mb-24">
              <i className="ph ph-heart" />
            </span>
            <h4 className="mb-8 text-gray-900 fw-bold">Your Wishlist is Empty</h4>
            <p className="text-gray-500 mb-32">
              Save your favorite items here to purchase them later.
            </p>
            <Link to="/shop" className="btn btn-main py-18 px-40 rounded-8">
              Explore Products
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
            <div className="cart-table border border-gray-100 rounded-8 bg-white">
              <div className="overflow-x-auto scroll-sm scroll-sm-horizontal">
                <table className="table rounded-8 overflow-hidden mb-0">
                  <thead>
                    <tr className="border-bottom border-neutral-100 bg-gray-50">
                      <th className="h6 mb-0 text-lg fw-bold px-40 py-24 border-end border-neutral-100 text-start" style={{ width: '150px' }}>
                        Action
                      </th>
                      <th className="h6 mb-0 text-lg fw-bold px-40 py-24 border-end border-neutral-100 text-start">
                        Product Details
                      </th>
                      <th className="h6 mb-0 text-lg fw-bold px-40 py-24 border-end border-neutral-100 text-start" style={{ width: '180px' }}>
                        Price
                      </th>
                      <th className="h6 mb-0 text-lg fw-bold px-40 py-24 border-end border-neutral-100 text-start" style={{ width: '180px' }}>
                        Stock Status
                      </th>
                      <th className="h6 mb-0 text-lg fw-bold px-40 py-24 text-start" style={{ width: '220px' }}>
                        Add To Cart
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishlistItems.map((product) => {
                      const isOutOfStock = product.inventory?.quantity - (product.inventory?.reserved || 0) <= 0;
                      return (
                        <tr key={product.id} className="border-bottom border-neutral-100 align-middle">
                          <td className="px-40 py-32 border-end border-neutral-100 text-start">
                            <button
                              onClick={() => handleRemove(product.id)}
                              type="button"
                              className="remove-tr-btn flex-align gap-12 text-gray-500 hover-text-danger-600 bg-transparent border-0"
                            >
                              <i className="ph ph-x-circle text-2xl d-flex" />
                              Remove
                            </button>
                          </td>
                          <td className="px-40 py-32 border-end border-neutral-100 text-start">
                            <div className="table-product d-flex align-items-center gap-24">
                              <Link
                                to={`/product-details?id=${product.id}`}
                                className="table-product__thumb border border-gray-100 rounded-8 flex-center bg-gray-50"
                                style={{ width: '80px', height: '80px', overflow: 'hidden' }}
                              >
                                <img
                                  src={product.images?.[0]?.url || 'assets/images/thumbs/product-two-img1.png'}
                                  alt={product.name}
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                              </Link>
                              <div className="table-product__content text-start">
                                <span className="py-2 px-8 text-xs rounded-pill text-main-two-600 bg-main-two-50 mb-8 d-inline-block">
                                  {product.brand}
                                </span>
                                <h6 className="title text-lg fw-semibold mb-8">
                                  <Link
                                    to={`/product-details?id=${product.id}`}
                                    className="link text-line-2"
                                  >
                                    {product.name}
                                  </Link>
                                </h6>
                                <div className="flex-align gap-12">
                                  <div className="flex-align gap-6">
                                    <span className="text-md fw-medium text-warning-600 d-flex">
                                      <i className="ph-fill ph-star" />
                                    </span>
                                    <span className="text-md fw-semibold text-gray-900">
                                      {product.ratings?.average || 0}
                                    </span>
                                  </div>
                                  <span className="text-sm fw-medium text-gray-200">|</span>
                                  <span className="text-neutral-600 text-sm">
                                    {product.ratings?.count || 0} Reviews
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-40 py-32 border-end border-neutral-100 text-start">
                            <span className="text-lg fw-bold text-gray-950">
                              {formatPrice(product.price.amount)}
                            </span>
                          </td>
                          <td className="px-40 py-32 border-end border-neutral-100 text-start">
                            <span className={`text-sm fw-semibold py-4 px-12 rounded-pill ${
                              isOutOfStock 
                                ? 'bg-danger-50 text-danger-600' 
                                : 'bg-success-50 text-success-600'
                            }`}>
                              {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td className="px-40 py-32 text-start">
                            <button
                              onClick={() => handleAddToCart(product.id)}
                              disabled={isOutOfStock}
                              type="button"
                              className={`btn btn-main-two rounded-8 px-24 py-12 flex-align gap-8 ${
                                isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              Add To Cart <i className="ph ph-shopping-cart" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WishListSection;
