import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const ProductListOne = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addedProductId, setAddedProductId] = useState(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await api.products.list({ limit: 8 });
                setProducts(res.results || []);
            } catch (err) {
                console.error('Failed to fetch homepage products:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const handleAddToCart = async (productId) => {
        try {
            setAddedProductId(productId);
            await api.cart.addItem(productId, 1);
            
            // Track event in Valkey
            await api.products.trackEvent(productId, 'add-to-cart').catch(() => {});
            
            // Notify header to update cart count
            window.dispatchEvent(new Event('cartUpdate'));
            
            setTimeout(() => {
                setAddedProductId(null);
            }, 1500);
        } catch (err) {
            console.error('Failed to add to cart:', err);
            setAddedProductId(null);
        }
    };

    const formatPrice = (amount) => {
        return `INR ${Number(amount).toLocaleString('en-IN')}`;
    };

    if (loading) {
        return (
            <div className="product mt-24 py-40 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-8 text-gray-500">Loading products...</p>
            </div>
        );
    }

    if (products.length === 0) {
        return null; // Don't render section if no products
    }

    return (
        <div className="product mt-24">
            <div className="container container-lg">
                <div className="section-heading mb-24 text-start">
                    <h5 className="mb-0">Featured Products</h5>
                </div>
                <div className="row gy-4 g-12">
                    {products.map((product) => (
                        <div key={product.id} className="col-xxl-3 col-lg-3 col-sm-6 col-12">
                            <div className="product-card h-100 px-16 py-24 border border-gray-100 hover-border-main-600 rounded-16 position-relative transition-2 bg-white d-flex flex-column justify-content-between text-start">
                                <div>
                                    <button
                                        onClick={() => handleAddToCart(product.id)}
                                        disabled={addedProductId === product.id}
                                        type="button"
                                        className={`product-card__cart btn py-11 px-24 rounded-pill flex-align gap-8 position-absolute inset-block-start-0 inset-inline-end-0 me-16 mt-16 z-2 ${
                                            addedProductId === product.id
                                                ? 'bg-success-600 text-white'
                                                : 'bg-main-50 text-main-600 hover-bg-main-600 hover-text-white'
                                        }`}
                                    >
                                        {addedProductId === product.id ? 'Added' : 'Add'} <i className="ph ph-shopping-cart" />
                                    </button>
                                    <Link
                                        to={`/product-details?id=${product.id}`}
                                        className="product-card__thumb flex-center bg-gray-50 rounded-8 p-8"
                                        style={{ height: '180px', overflow: 'hidden' }}
                                    >
                                        <img
                                            src={product.images[0]?.url || 'assets/images/thumbs/product-two-img1.png'}
                                            alt={product.name}
                                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                                        />
                                    </Link>
                                    <div className="product-card__content mt-12">
                                        <span className="py-2 px-8 text-xs rounded-pill text-main-two-600 bg-main-two-50 mb-8 d-inline-block">
                                            {product.brand}
                                        </span>
                                        <h6 className="title text-lg fw-semibold mt-8 mb-8">
                                            <Link to={`/product-details?id=${product.id}`} className="link text-line-2">
                                                {product.name}
                                            </Link>
                                        </h6>
                                        <div className="flex-align gap-6 mb-12">
                                            <span className="text-xs fw-bold text-gray-600">{product.ratings?.average || 0}</span>
                                            <span className="text-15 fw-bold text-warning-600 d-flex">
                                                <i className="ph-fill ph-star" />
                                            </span>
                                            <span className="text-xs fw-bold text-gray-600">({product.ratings?.count || 0})</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-auto">
                                    <div className="product-card__price mb-16">
                                        <span className="text-heading text-lg fw-bold">
                                            {formatPrice(product.price.amount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProductListOne;