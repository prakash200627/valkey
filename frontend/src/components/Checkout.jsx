import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const Checkout = () => {
    const [selectedPayment, setSelectedPayment] = useState("payment1");
    const [cart, setCart] = useState({ items: [], subtotal: 0, discount: 0, coupon: null, total: 0 });
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        businessName: '',
        country: 'India',
        streetAddress: '',
        apartment: '',
        city: '',
        state: '',
        postCode: '',
        phone: '',
        email: '',
        notes: ''
    });
    const [placingOrder, setPlacingOrder] = useState(false);
    const [paymentStep, setPaymentStep] = useState('form'); // 'form' | 'processing' | 'success'
    const [placedOrder, setPlacedOrder] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchCartAndProfile = async () => {
            try {
                setLoading(true);
                const cartData = await api.cart.get();
                setCart(cartData);

                const token = localStorage.getItem('valkey_session_token');
                if (token) {
                    try {
                        const user = await api.auth.me();
                        if (user) {
                            let updatedFields = {
                                firstName: user.firstName || '',
                                lastName: user.lastName || '',
                                email: user.email || '',
                                phone: user.phone || ''
                            };

                            const defaultAddr = user.addresses?.find(addr => addr.isDefault) || user.addresses?.[0];
                            if (defaultAddr) {
                                updatedFields = {
                                    ...updatedFields,
                                    streetAddress: defaultAddr.street || '',
                                    city: defaultAddr.city || '',
                                    state: defaultAddr.state || '',
                                    postCode: defaultAddr.postalCode || '',
                                    country: defaultAddr.country || 'India'
                                };
                            }

                            setFormData(prev => ({
                                ...prev,
                                ...updatedFields
                            }));
                        }
                    } catch (profileErr) {
                        console.error('Failed to load profile for checkout autofill:', profileErr);
                    }
                }
            } catch (err) {
                console.error('Failed to load checkout details:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchCartAndProfile();
    }, []);

    const handlePaymentChange = (event) => {
        setSelectedPayment(event.target.id);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const formatPrice = (amount) => {
        if (amount === undefined || amount === null) return 'INR 0.00';
        return `INR ${(amount / 100).toFixed(2)}`;
    };

    const handlePlaceOrder = async (e) => {
        e.preventDefault();
        
        // Simple billing address validations
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.streetAddress.trim() || !formData.city.trim() || !formData.postCode.trim() || !formData.phone.trim() || !formData.email.trim()) {
            setErrorMessage('Please fill in all required shipping details fields.');
            return;
        }

        const validateEmail = (email) => {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        };
        if (!validateEmail(formData.email)) {
            setErrorMessage('Please enter a valid email address.');
            return;
        }

        if (!/^\+?[0-9\s-]{4,15}$/.test(formData.phone)) {
            setErrorMessage('Please enter a valid phone number.');
            return;
        }

        if (cart.items.length === 0) {
            setErrorMessage('Your shopping cart is empty.');
            return;
        }

        try {
            setErrorMessage('');
            setPlacingOrder(true);
            setPaymentStep('processing');

            // 1. Start Checkout: reserve stock atomically in Valkey!
            const address = {
                street: formData.streetAddress,
                apartment: formData.apartment,
                city: formData.city,
                state: formData.state,
                postalCode: formData.postCode,
                country: formData.country,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                email: formData.email,
                notes: formData.notes
            };

            const startRes = await api.checkout.start(address);
            const orderId = startRes.orderId;

            // 2. Simulate Secure Payment Gateway processing (takes 2 seconds)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 3. Confirm Order: permanently commit stock and create order record
            const confirmRes = await api.checkout.confirm(orderId, {
                method: selectedPayment === 'payment1' ? 'bank_transfer' : selectedPayment === 'payment2' ? 'check' : 'cod',
                transactionId: 'TXN-' + Math.floor(Math.random() * 1000000000)
            });

            // Success! Set placed order and clear cart on frontend
            setPlacedOrder(confirmRes.order);
            setPaymentStep('success');
        } catch (err) {
            console.error('Checkout transaction failed:', err);
            setErrorMessage(err.message || 'Checkout transaction failed. Please check inventory stock levels.');
            setPaymentStep('form');
        } finally {
            setPlacingOrder(false);
        }
    };

    if (loading) {
        return (
            <div className="container py-80 text-center">
                <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}>
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-24 text-gray-500 fw-medium">Loading checkout profiles and cart calculations...</p>
            </div>
        );
    }

    if (paymentStep === 'processing') {
        return (
            <div className="container py-80 text-center">
                <div className="border border-gray-100 rounded-16 p-48 bg-white max-w-600 mx-auto box-shadow-xl animate__animated animate__pulse animate__infinite">
                    <div className="spinner-border text-success mb-24" role="status" style={{ width: '4rem', height: '4rem' }}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h4 className="mb-8 font-heading-two text-gray-900 fw-bold">Processing Secure Payment...</h4>
                    <p className="text-gray-500 mb-0">
                        Please do not close or refresh this page. Valkey is committing your atomic inventory reservations transactionally in our database.
                    </p>
                </div>
            </div>
        );
    }

    if (paymentStep === 'success') {
        return (
            <div className="container py-80 text-center">
                <div className="border border-success border-dashed rounded-16 p-48 bg-white max-w-600 mx-auto box-shadow-xl">
                    <span className="w-80 h-80 bg-success-50 text-success-600 rounded-circle flex-center text-5xl mx-auto mb-24">
                        <i className="ph-fill ph-check-circle animate__animated animate__bounceIn" />
                    </span>
                    <h3 className="mb-8 font-heading-two text-gray-900 fw-bold">Order Confirmed!</h3>
                    <p className="text-gray-500 mb-32">
                        Thank you for your purchase. Your inventory has been securely reserved and transactionally locked in Valkey.
                    </p>
                    
                    <div className="bg-gray-50 p-24 rounded-12 text-start mb-32 border border-gray-100">
                        <div className="mb-12 flex-between">
                            <span className="text-gray-400 text-sm">Order Reference ID:</span>
                            <span className="text-gray-900 fw-semibold font-monospace">{placedOrder?.id}</span>
                        </div>
                        <div className="mb-12 flex-between">
                            <span className="text-gray-400 text-sm">Amount Paid:</span>
                            <span className="text-gray-900 fw-bold">{formatPrice(placedOrder?.total)}</span>
                        </div>
                        <div className="mb-12 flex-between">
                            <span className="text-gray-400 text-sm">Estimated Delivery:</span>
                            <span className="text-main-two-600 fw-semibold text-sm">2-3 Business Days (Lightning Delivery)</span>
                        </div>
                        <div className="pt-12 border-top border-gray-200">
                            <span className="text-gray-400 text-sm d-block mb-4">Shipping Destination:</span>
                            <span className="text-gray-800 text-sm fw-medium">
                                {placedOrder?.shippingAddress?.firstName} {placedOrder?.shippingAddress?.lastName}<br />
                                {placedOrder?.shippingAddress?.street}, {placedOrder?.shippingAddress?.city}<br />
                                {placedOrder?.shippingAddress?.postalCode}, {placedOrder?.shippingAddress?.country}
                            </span>
                        </div>
                    </div>

                    <Link to="/shop" className="btn btn-main rounded-pill px-48 py-16">
                        Continue Shopping
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <section className="checkout py-80">
            <div className="container container-lg">
                <div className="border border-gray-100 rounded-8 px-30 py-20 mb-40">
                    <span className="">
                        Have a coupon?{" "}
                        <Link
                            to="/cart"
                            className="fw-semibold text-gray-900 hover-text-decoration-underline hover-text-main-600"
                        >
                            Click here to enter your code in the shopping cart
                        </Link>{" "}
                    </span>
                </div>

                {errorMessage && (
                    <div className="alert alert-danger rounded-8 mb-40 py-16 px-24 fw-medium flex-align gap-12" role="alert">
                        <i className="ph ph-warning-circle text-2xl d-flex" />
                        {errorMessage}
                    </div>
                )}

                <div className="row">
                    <div className="col-xl-9 col-lg-8">
                        <form onSubmit={handlePlaceOrder} className="pe-xl-5">
                            <h5 className="mb-24">Billing & Shipping Details</h5>
                            <div className="row gy-3">
                                <div className="col-sm-6">
                                    <input
                                        type="text"
                                        name="firstName"
                                        className="common-input border-gray-100"
                                        placeholder="First Name *"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-sm-6">
                                    <input
                                        type="text"
                                        name="lastName"
                                        className="common-input border-gray-100"
                                        placeholder="Last Name *"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="businessName"
                                        className="common-input border-gray-100"
                                        placeholder="Business Name (Optional)"
                                        value={formData.businessName}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="country"
                                        className="common-input border-gray-100"
                                        placeholder="Country *"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="streetAddress"
                                        className="common-input border-gray-100"
                                        placeholder="House number and street name *"
                                        value={formData.streetAddress}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="apartment"
                                        className="common-input border-gray-100"
                                        placeholder="Apartment, suite, unit, etc. (Optional)"
                                        value={formData.apartment}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="city"
                                        className="common-input border-gray-100"
                                        placeholder="City *"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="state"
                                        className="common-input border-gray-100"
                                        placeholder="State *"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="text"
                                        name="postCode"
                                        className="common-input border-gray-100"
                                        placeholder="Post Code / ZIP *"
                                        value={formData.postCode}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="tel"
                                        name="phone"
                                        className="common-input border-gray-100"
                                        placeholder="Phone *"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <input
                                        type="email"
                                        name="email"
                                        className="common-input border-gray-100"
                                        placeholder="Email Address *"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <div className="my-40">
                                        <h6 className="text-lg mb-24">Additional Information</h6>
                                        <input
                                            type="text"
                                            name="notes"
                                            className="common-input border-gray-100"
                                            placeholder="Notes about your order, e.g. special notes for delivery."
                                            value={formData.notes}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div className="col-xl-3 col-lg-4">
                        <div className="checkout-sidebar">
                            <div className="bg-color-three rounded-8 p-24 text-center mb-24">
                                <span className="text-gray-900 text-xl fw-semibold">
                                    Order Summary
                                </span>
                            </div>

                            <div className="border border-gray-100 rounded-8 px-24 py-40">
                                <div className="mb-32 pb-32 border-bottom border-gray-100 flex-between gap-8">
                                    <span className="text-gray-900 fw-medium text-xl font-heading-two">
                                        Product
                                    </span>
                                    <span className="text-gray-900 fw-medium text-xl font-heading-two">
                                        Subtotal
                                    </span>
                                </div>

                                {cart.items.length === 0 ? (
                                    <p className="text-gray-400 text-sm py-16 text-center">Your shopping cart is empty.</p>
                                ) : (
                                    cart.items.map((item) => (
                                        <div key={item.product.id} className="flex-between gap-24 mb-32">
                                            <div className="flex-align gap-12">
                                                <span className="text-gray-900 fw-normal text-md font-heading-two w-144 text-line-2">
                                                    {item.product.name}
                                                </span>
                                                <span className="text-gray-900 fw-normal text-md font-heading-two">
                                                    <i className="ph-bold ph-x text-xs" />
                                                </span>
                                                <span className="text-gray-900 fw-semibold text-md font-heading-two">
                                                    {item.quantity}
                                                </span>
                                            </div>
                                            <span className="text-gray-900 fw-bold text-md font-heading-two flex-shrink-0">
                                                {formatPrice(item.subtotal)}
                                            </span>
                                        </div>
                                    ))
                                )}

                                <div className="border-top border-gray-100 pt-30 mt-30">
                                    <div className="mb-16 flex-between gap-8">
                                        <span className="text-gray-900 font-heading-two text-lg fw-semibold">
                                            Subtotal
                                        </span>
                                        <span className="text-gray-900 font-heading-two text-md fw-bold">
                                            {formatPrice(cart.subtotal)}
                                        </span>
                                    </div>

                                    {cart.discount > 0 && (
                                        <div className="mb-16 flex-between gap-8 text-success-600">
                                            <span className="font-heading-two text-lg fw-semibold">
                                                Discount ({cart.coupon?.code})
                                            </span>
                                            <span className="font-heading-two text-md fw-bold">
                                                -{formatPrice(cart.discount)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="mb-0 flex-between gap-8 border-top border-gray-100 pt-16">
                                        <span className="text-gray-900 font-heading-two text-xl fw-bold">
                                            Total
                                        </span>
                                        <span className="text-gray-900 font-heading-two text-lg fw-extrabold text-main-600">
                                            {formatPrice(cart.total)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-32">
                                <div className="payment-item">
                                    <div className="form-check common-check common-radio py-16 mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="payment"
                                            id="payment1"
                                            checked={selectedPayment === 'payment1'}
                                            onChange={handlePaymentChange}
                                        />
                                        <label
                                            className="form-check-label fw-semibold text-neutral-600"
                                            htmlFor="payment1"
                                        >
                                            Direct Bank Transfer
                                        </label>
                                    </div>
                                    {selectedPayment === 'payment1' && (
                                        <div className="payment-item__content px-16 py-24 rounded-8 bg-main-50 position-relative d-block">
                                            <p className="text-gray-800 text-sm mb-0">
                                                Transfer funds straight to our local bank account. Please note reservations expire in 10 minutes if unpaid!
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="payment-item">
                                    <div className="form-check common-check common-radio py-16 mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="payment"
                                            id="payment2"
                                            checked={selectedPayment === 'payment2'}
                                            onChange={handlePaymentChange}
                                        />
                                        <label
                                            className="form-check-label fw-semibold text-neutral-600"
                                            htmlFor="payment2"
                                        >
                                            Check Payments
                                        </label>
                                    </div>
                                    {selectedPayment === 'payment2' && (
                                        <div className="payment-item__content px-16 py-24 rounded-8 bg-main-50 position-relative d-block">
                                            <p className="text-gray-800 text-sm mb-0">
                                                Send a check to our headquarters. We will lock reserved stock for processing.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="payment-item">
                                    <div className="form-check common-check common-radio py-16 mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="payment"
                                            id="payment3"
                                            checked={selectedPayment === 'payment3'}
                                            onChange={handlePaymentChange}
                                        />
                                        <label
                                            className="form-check-label fw-semibold text-neutral-600"
                                            htmlFor="payment3"
                                        >
                                            Cash on Delivery (COD)
                                        </label>
                                    </div>
                                    {selectedPayment === 'payment3' && (
                                        <div className="payment-item__content px-16 py-24 rounded-8 bg-main-50 position-relative d-block">
                                            <p className="text-gray-800 text-sm mb-0">
                                                Pay securely upon physical delivery of items at your billing destination.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-32 pt-32 border-top border-gray-100">
                                <p className="text-gray-500 text-xs">
                                    Your personal data is encrypted and handled using Valkey session security to protect your privacy and purchase logs.
                                </p>
                            </div>

                            <button
                                onClick={handlePlaceOrder}
                                disabled={placingOrder || cart.items.length === 0}
                                type="button"
                                className="btn btn-main mt-40 py-18 w-100 rounded-8 fw-bold"
                            >
                                {placingOrder ? 'Processing...' : 'Place Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Checkout;