// frontend/src/components/CartSection.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const CartSection = () => {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [couponCode, setCouponCode] = useState('');
    const [couponError, setCouponError] = useState('');
    const [couponSuccess, setCouponSuccess] = useState('');

    const loadCart = async () => {
        try {
            setLoading(true);
            const data = await api.cart.get();
            setCart(data);
        } catch (err) {
            console.error('Failed to load cart:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCart();
    }, []);

    const handleQuantityChange = async (productId, currentQty, amount) => {
        try {
            const newQty = currentQty + amount;
            if (newQty <= 0) {
                await handleRemoveItem(productId);
            } else {
                await api.cart.updateItem(productId, newQty);
                await loadCart();
            }
        } catch (err) {
            console.error('Failed to update quantity:', err);
        }
    };

    const handleRemoveItem = async (productId) => {
        try {
            await api.cart.removeItem(productId);
            // Track event: remove from cart
            await api.products.trackEvent(productId, 'remove-from-cart').catch(() => {});
            await loadCart();
        } catch (err) {
            console.error('Failed to remove item:', err);
        }
    };

    const handleClearCart = async () => {
        try {
            await api.cart.clear();
            await loadCart();
        } catch (err) {
            console.error('Failed to clear cart:', err);
        }
    };

    const handleApplyCoupon = async (e) => {
        e.preventDefault();
        setCouponError('');
        setCouponSuccess('');
        if (!couponCode.trim()) return;

        try {
            const res = await api.cart.applyCoupon(couponCode);
            setCouponSuccess(res.message || 'Coupon applied!');
            setCouponCode('');
            await loadCart();
        } catch (err) {
            setCouponError(err.message || 'Invalid coupon.');
        }
    };

    const handleRemoveCoupon = async () => {
        try {
            await api.cart.removeCoupon();
            setCouponSuccess('');
            setCouponError('');
            await loadCart();
        } catch (err) {
            console.error('Failed to remove coupon:', err);
        }
    };

    // Formatter for currency
    const formatPrice = (amount) => {
        return `INR ${(amount / 100).toFixed(2)}`;
    };

    if (loading && !cart) {
        return (
            <div className="container py-80 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-16">Retrieving your Valkey cart...</p>
            </div>
        );
    }

    const items = cart?.items || [];

    return (
        <section className="cart py-80">
            <div className="container container-lg">
                {items.length === 0 ? (
                    <div className="border border-gray-100 rounded-8 p-48 text-center bg-gray-50">
                        <i className="ph ph-shopping-cart text-6xl text-gray-300 mb-16 d-block" />
                        <h4 className="mb-8">Your shopping cart is empty!</h4>
                        <p className="mb-24 text-gray-500">Go add some Valkey seeded products to get started.</p>
                        <Link to="/shop" className="btn btn-main rounded-8 py-12 px-24">
                            Go to Shop
                        </Link>
                    </div>
                ) : (
                    <div className="row gy-4">
                        <div className="col-xl-9 col-lg-8">
                            <div className="cart-table border border-gray-100 rounded-8 px-40 py-48">
                                <div className="overflow-x-auto scroll-sm scroll-sm-horizontal">
                                    <table className="table style-three">
                                        <thead>
                                            <tr>
                                                <th className="h6 mb-0 text-lg fw-bold">Delete</th>
                                                <th className="h6 mb-0 text-lg fw-bold">Product Name</th>
                                                <th className="h6 mb-0 text-lg fw-bold">Price</th>
                                                <th className="h6 mb-0 text-lg fw-bold">Quantity</th>
                                                <th className="h6 mb-0 text-lg fw-bold">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => (
                                                <tr key={item.product.id}>
                                                    <td>
                                                        <button
                                                            onClick={() => handleRemoveItem(item.product.id)}
                                                            type="button"
                                                            className="remove-tr-btn flex-align gap-12 hover-text-danger-600"
                                                        >
                                                            <i className="ph ph-x-circle text-2xl d-flex" />
                                                            Remove
                                                        </button>
                                                    </td>
                                                    <td>
                                                        <div className="table-product d-flex align-items-center gap-24">
                                                            <Link
                                                                to={`/product-details?id=${item.product.id}`}
                                                                className="table-product__thumb border border-gray-100 rounded-8 flex-center "
                                                                style={{ width: '80px', height: '80px', overflow: 'hidden' }}
                                                            >
                                                                <img
                                                                    src={item.product.images[0]?.url || 'assets/images/thumbs/product-two-img1.png'}
                                                                    alt={item.product.name}
                                                                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                                                                />
                                                            </Link>
                                                            <div className="table-product__content text-start">
                                                                <h6 className="title text-lg fw-semibold mb-8">
                                                                    <Link
                                                                        to={`/product-details?id=${item.product.id}`}
                                                                        className="link text-line-2"
                                                                    >
                                                                        {item.product.name}
                                                                    </Link>
                                                                </h6>
                                                                <span className="py-2 px-8 text-xs rounded-pill text-main-two-600 bg-main-two-50 mt-8 d-inline-block">
                                                                    Fulfilled by Valkey JSON
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="text-lg h6 mb-0 fw-semibold">
                                                            {formatPrice(item.product.price.amount)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-8 justify-content-center" style={{ maxWidth: '120px', margin: '0 auto' }}>
                                                            <button
                                                                onClick={() => handleQuantityChange(item.product.id, item.quantity, -1)}
                                                                className="btn btn-outline-secondary btn-sm rounded-circle px-8 py-4"
                                                                type="button"
                                                            >-</button>
                                                            <span className="text-md fw-bold px-12">{item.quantity}</span>
                                                            <button
                                                                onClick={() => handleQuantityChange(item.product.id, item.quantity, 1)}
                                                                className="btn btn-outline-secondary btn-sm rounded-circle px-8 py-4"
                                                                type="button"
                                                            >+</button>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="text-lg h6 mb-0 fw-semibold">
                                                            {formatPrice(item.subtotal)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex-between flex-wrap gap-16 mt-32">
                                    <form onSubmit={handleApplyCoupon} className="flex-align gap-16">
                                        <input
                                            type="text"
                                            className="common-input"
                                            placeholder="Coupon Code"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value)}
                                            style={{ minWidth: '200px' }}
                                        />
                                        <button
                                            type="submit"
                                            className="btn btn-main py-18 rounded-8"
                                            style={{ whiteSpace: 'nowrap' }}
                                        >
                                            Apply Coupon
                                        </button>
                                    </form>
                                    <button
                                        onClick={handleClearCart}
                                        type="button"
                                        className="text-lg text-danger hover-text-danger-700"
                                    >
                                        Clear Cart
                                    </button>
                                </div>
                                {couponError && <p className="text-danger mt-8 mb-0">{couponError}</p>}
                                {couponSuccess && <p className="text-success mt-8 mb-0">{couponSuccess}</p>}
                            </div>
                        </div>
                        <div className="col-xl-3 col-lg-4">
                            <div className="cart-sidebar border border-gray-100 rounded-8 px-24 py-40">
                                <h6 className="text-xl mb-32">Cart Totals</h6>
                                <div className="bg-color-three rounded-8 p-24">
                                    <div className="mb-24 flex-between gap-8">
                                        <span className="text-gray-900 font-heading-two">Subtotal</span>
                                        <span className="text-gray-900 fw-semibold">{formatPrice(cart.subtotal)}</span>
                                    </div>
                                    {cart.coupon && (
                                        <div className="mb-24 flex-between gap-8 text-success-600 bg-success-50 p-8 rounded-4">
                                            <div>
                                                <span className="fw-semibold d-block">Coupon: {cart.coupon.code}</span>
                                                <button onClick={handleRemoveCoupon} className="text-xs text-danger text-decoration-underline border-0 bg-transparent p-0">Remove</button>
                                            </div>
                                            <span className="fw-bold">-{formatPrice(cart.coupon.discount)}</span>
                                        </div>
                                    )}
                                    <div className="mb-24 flex-between gap-8">
                                        <span className="text-gray-900 font-heading-two">Estimated Delivery</span>
                                        <span className="text-success-600 fw-semibold">Free</span>
                                    </div>
                                    <div className="mb-0 flex-between gap-8">
                                        <span className="text-gray-900 font-heading-two">Estimated Taxes</span>
                                        <span className="text-gray-900 fw-semibold">{formatPrice(0)}</span>
                                    </div>
                                </div>
                                <div className="bg-color-three rounded-8 p-24 mt-24">
                                    <div className="flex-between gap-8">
                                        <span className="text-gray-900 text-xl fw-semibold">Total</span>
                                        <span className="text-gray-900 text-xl fw-semibold">{formatPrice(cart.total)}</span>
                                    </div>
                                </div>
                                <Link
                                    to="/checkout"
                                    className="btn btn-main mt-40 py-18 w-100 rounded-8"
                                >
                                    Proceed to checkout
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default CartSection;