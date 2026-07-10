import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom';
import Slider from 'react-slick';
import { getCountdown } from '../helper/Countdown';
import { api } from '../services/api';

const ProductDetailsOne = () => {
    const [timeLeft, setTimeLeft] = useState(getCountdown());
    const location = useLocation();

    // Parse product ID from query parameter e.g., ?id=product:0192...
    const searchParams = new URLSearchParams(location.search);
    const productId = searchParams.get('id');

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [mainImage, setMainImage] = useState('');
    const [addedToCart, setAddedToCart] = useState(false);
    const [inWishlist, setInWishlist] = useState(false);
    const [inCompare, setInCompare] = useState(false);


    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(getCountdown());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!productId) {
            setError('No product ID specified in the URL.');
            setLoading(false);
            return;
        }

        const fetchProduct = async () => {
            try {
                setLoading(true);
                const data = await api.products.get(productId);
                setProduct(data);
                if (data.images && data.images.length > 0) {
                    setMainImage(data.images[0].url);
                }
                setError(null);

                const wishStored = localStorage.getItem('valkey_wishlist');
                const wishIds = wishStored ? JSON.parse(wishStored) : [];
                setInWishlist(wishIds.includes(data.id));

                const compStored = localStorage.getItem('valkey_compare');
                const compIds = compStored ? JSON.parse(compStored) : [];
                setInCompare(compIds.includes(data.id));

                // Track view event in Valkey for Challenge 4 (Trending)
                await api.products.trackEvent(productId, 'view').catch((err) => {
                    console.error('Failed to track view event:', err);
                });
            } catch (err) {
                console.error('Error loading product:', err);
                setError(err.message || 'Failed to retrieve product details.');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId]);

    // Increment & decrement quantity controls
    const incrementQuantity = () => setQuantity(quantity + 1);
    const decrementQuantity = () => setQuantity(quantity > 1 ? quantity - 1 : quantity);

    const handleAddToCart = async () => {
        if (!product) return;
        try {
            setAddedToCart(true);
            await api.cart.addItem(product.id, quantity);
            
            // Track add-to-cart event in Valkey Sorted Sets (Challenge 4)
            await api.products.trackEvent(product.id, 'add-to-cart').catch((err) => {
                console.error('Failed to track add-to-cart event:', err);
            });

            // Notify header to update cart count
            window.dispatchEvent(new Event('cartUpdate'));

            setTimeout(() => {
                setAddedToCart(false);
            }, 2000);
        } catch (err) {
            console.error('Failed to add to cart:', err);
            setAddedToCart(false);
        }
    };

    const handleWishlistToggle = () => {
        if (!product) return;
        const stored = localStorage.getItem('valkey_wishlist');
        let ids = stored ? JSON.parse(stored) : [];
        if (ids.includes(product.id)) {
            ids = ids.filter(id => id !== product.id);
            setInWishlist(false);
        } else {
            ids.push(product.id);
            setInWishlist(true);
        }
        localStorage.setItem('valkey_wishlist', JSON.stringify(ids));
        window.dispatchEvent(new Event('wishlistUpdate'));
    };

    const handleCompareToggle = () => {
        if (!product) return;
        const stored = localStorage.getItem('valkey_compare');
        let ids = stored ? JSON.parse(stored) : [];
        if (ids.includes(product.id)) {
            ids = ids.filter(id => id !== product.id);
            setInCompare(false);
        } else {
            if (ids.length >= 3) {
                alert("You can compare up to 3 products only. Please remove an existing item first.");
                return;
            }
            ids.push(product.id);
            setInCompare(true);
        }
        localStorage.setItem('valkey_compare', JSON.stringify(ids));
        window.dispatchEvent(new Event('compareUpdate'));
    };

    const settingsThumbs = {
        dots: false,
        infinite: product?.images && product.images.length > 4,
        speed: 500,
        slidesToShow: Math.min(product?.images?.length || 4, 4),
        slidesToScroll: 1,
        focusOnSelect: true,
    };
    const formatPrice = (amount) => {
        if (amount === undefined || amount === null) return 'INR 0.00';
        return `INR ${(amount / 100).toFixed(2)}`;
    };

    if (loading) {
        return (
            <div className="container py-80 text-center">
                <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}>
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-24 text-gray-500 fw-medium">Retrieving secure product profile from Valkey JSON...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="container py-80 text-center">
                <div className="border border-gray-100 rounded-16 p-48 bg-gray-50 max-w-600 mx-auto box-shadow-sm">
                    <i className="ph ph-warning-circle text-6xl text-danger d-block mb-16" />
                    <h5 className="mb-8">Product Profile Unavailable</h5>
                    <p className="text-gray-500 mb-24">{error || "The requested product does not exist in our catalog."}</p>
                    <Link to="/shop" className="btn btn-main rounded-pill">
                        Back to Catalog
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <section className="product-details py-80">
            <div className="container container-lg">
                <div className="row gy-4">
                    <div className="col-lg-9">
                        <div className="row gy-4">
                            <div className="col-xl-6">
                                <div className="product-details__left">
                                    <div className="product-details__thumb-slider border border-gray-100 rounded-16 bg-gray-50 flex-center" style={{ height: '350px', overflow: 'hidden' }}>
                                        <div className="flex-center h-100 w-100 p-24">
                                            <img 
                                                src={mainImage || 'assets/images/thumbs/product-two-img1.png'} 
                                                alt={product.name} 
                                                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-24">
                                        <div className="product-details__images-slider">
                                            <Slider {...settingsThumbs}>
                                                {(product.images || []).map((image, index) => (
                                                    <div 
                                                        className={`center max-w-120 max-h-120 h-100 flex-center border rounded-16 p-8 cursor-pointer transition-1 ${mainImage === image.url ? 'border-main-600 bg-main-50' : 'border-gray-100 bg-white'}`} 
                                                        key={index} 
                                                        onClick={() => setMainImage(image.url)}
                                                    >
                                                        <img 
                                                            className='thum' 
                                                            src={image.url} 
                                                            alt={image.alt || `Thumbnail ${index}`} 
                                                            style={{ height: '80px', width: '80px', objectFit: 'contain' }}
                                                        />
                                                    </div>
                                                ))}
                                            </Slider>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-xl-6">
                                <div className="product-details__content">
                                    <h5 className="mb-12">{product.name}</h5>
                                    <div className="flex-align flex-wrap gap-12">
                                        <div className="flex-align gap-12 flex-wrap">
                                            <div className="flex-align gap-8">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className={`text-15 fw-medium d-flex ${i < Math.round(product.ratings?.average || 5) ? 'text-warning-600' : 'text-gray-300'}`}>
                                                        <i className="ph-fill ph-star" />
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-sm fw-medium text-neutral-600">
                                                {product.ratings?.average || 0} Star Rating
                                            </span>
                                            <span className="text-sm fw-medium text-gray-500">
                                                ({product.ratings?.count || 0} reviews)
                                            </span>
                                        </div>
                                        <span className="text-sm fw-medium text-gray-500">|</span>
                                        <span className="text-gray-900">
                                            {" "}
                                            <span className="text-gray-400">SKU:</span> {product.sku || "N/A"}{" "}
                                        </span>
                                    </div>
                                    <span className="mt-32 pt-32 text-gray-700 border-top border-gray-100 d-block" />
                                    <p className="text-gray-700">
                                        {product.shortDescription || product.description}
                                    </p>
                                    <div className="mt-32 flex-align flex-wrap gap-32">
                                        <div className="flex-align gap-8">
                                            <h4 className="mb-0">{formatPrice(product.price.amount)}</h4>
                                            {product.price.compareAt && (
                                                <span className="text-md text-gray-500 text-decoration-line-through">{formatPrice(product.price.compareAt)}</span>
                                            )}
                                        </div>
                                        <span className="badge bg-main-two-50 text-main-two-700 px-12 py-8 rounded-pill text-sm fw-semibold">
                                            Brand: {product.brand}
                                        </span>
                                    </div>
                                    <span className="mt-32 pt-32 text-gray-700 border-top border-gray-100 d-block" />
                                    <div className="flex-align flex-wrap gap-16 bg-color-one rounded-8 py-16 px-24">
                                        <div className="flex-align gap-16">
                                            <span className="text-main-600 text-sm">Special Offer:</span>
                                        </div>
                                        <div className="countdown" id="countdown11">
                                            <ul className="countdown-list flex-align flex-wrap">
                                                <li className="countdown-list__item text-heading flex-align gap-4 text-xs fw-medium w-28 h-28 rounded-4 border border-main-600 p-0 flex-center">
                                                    {timeLeft.days} <span className="days" />
                                                </li>
                                                <li className="countdown-list__item text-heading flex-align gap-4 text-xs fw-medium w-28 h-28 rounded-4 border border-main-600 p-0 flex-center">
                                                    {timeLeft.hours}<span className="hours" />
                                                </li>
                                                <li className="countdown-list__item text-heading flex-align gap-4 text-xs fw-medium w-28 h-28 rounded-4 border border-main-600 p-0 flex-center">
                                                    {timeLeft.minutes}<span className="minutes" />
                                                </li>
                                                <li className="countdown-list__item text-heading flex-align gap-4 text-xs fw-medium w-28 h-28 rounded-4 border border-main-600 p-0 flex-center">
                                                    {timeLeft.seconds}<span className="seconds" />
                                                </li>
                                            </ul>
                                        </div>
                                        <span className="text-gray-900 text-xs">
                                            Remains untill the end of the offer
                                        </span>
                                    </div>
                                    <div className="mb-24">
                                        <div className="mt-32 flex-align gap-12 mb-16">
                                            <span className="w-32 h-32 bg-white flex-center rounded-circle text-main-600 box-shadow-xl">
                                                <i className="ph-fill ph-lightning" />
                                            </span>
                                            <h6 className="text-md mb-0 fw-bold text-gray-900">
                                                Valkey Live Inventory Levels
                                            </h6>
                                        </div>
                                        <div
                                            className="progress w-100 bg-gray-100 rounded-pill h-8"
                                            role="progressbar"
                                            aria-label="Valkey Stock"
                                            aria-valuenow={Math.min(100, ((product.inventory?.quantity - (product.inventory?.reserved || 0)) / (product.inventory?.quantity || 1)) * 100)}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        >
                                            <div
                                                className="progress-bar bg-main-two-600 rounded-pill"
                                                style={{ width: `${Math.min(100, Math.max(10, ((product.inventory?.quantity - (product.inventory?.reserved || 0)) / (product.inventory?.quantity || 1)) * 100))}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-gray-700 mt-8 d-block">
                                            Available Stock: {product.inventory?.quantity - (product.inventory?.reserved || 0)} units (Reserved: {product.inventory?.reserved || 0})
                                        </span>
                                    </div>
                                    <span className="text-gray-900 d-block mb-8">Quantity:</span>
                                    <div className="flex-between gap-16 flex-wrap">
                                        <div className="flex-align flex-wrap gap-16">
                                            <div className="border border-gray-100 rounded-pill py-9 px-16 flex-align">
                                                <button onClick={decrementQuantity}
                                                    type="button"
                                                    className="quantity__minus p-4 text-gray-700 hover-text-main-600 flex-center"
                                                >
                                                    <i className="ph ph-minus" />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="quantity__input border-0 text-center w-32"
                                                    value={quantity} readOnly
                                                />
                                                <button onClick={incrementQuantity}
                                                    type="button"
                                                    className="quantity__plus p-4 text-gray-700 hover-text-main-600 flex-center"
                                                >
                                                    <i className="ph ph-plus" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleAddToCart}
                                                disabled={addedToCart || (product.inventory?.quantity - (product.inventory?.reserved || 0) <= 0)}
                                                type="button"
                                                className={`btn rounded-pill flex-align d-inline-flex gap-8 px-48 fw-semibold ${
                                                    addedToCart 
                                                        ? 'bg-success-600 text-white border-success-600' 
                                                        : (product.inventory?.quantity - (product.inventory?.reserved || 0) <= 0)
                                                            ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
                                                            : 'btn-main hover-bg-main-700'
                                                }`}
                                            >
                                                <i className={addedToCart ? "ph ph-check text-xl d-flex" : "ph ph-shopping-cart text-xl d-flex"} />
                                                {addedToCart ? 'Added!' : (product.inventory?.quantity - (product.inventory?.reserved || 0) <= 0) ? 'Out of Stock' : 'Add To Cart'}
                                            </button>
                                        </div>
                                        <div className="flex-align gap-12">
                                            <button
                                                onClick={handleWishlistToggle}
                                                type="button"
                                                className={`w-52 h-52 text-xl flex-center rounded-circle border-0 ${
                                                    inWishlist 
                                                        ? 'bg-danger-600 text-white hover-bg-danger-700' 
                                                        : 'bg-main-50 text-main-600 hover-bg-main-600 hover-text-white'
                                                }`}
                                                title={inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
                                            >
                                                <i className={inWishlist ? "ph-fill ph-heart" : "ph ph-heart"} />
                                            </button>
                                            <button
                                                onClick={handleCompareToggle}
                                                type="button"
                                                className={`w-52 h-52 text-xl flex-center rounded-circle border-0 ${
                                                    inCompare 
                                                        ? 'bg-main-two-600 text-white hover-bg-main-two-700' 
                                                        : 'bg-main-50 text-main-600 hover-bg-main-600 hover-text-white'
                                                }`}
                                                title={inCompare ? "Remove from Comparison" : "Add to Comparison"}
                                            >
                                                <i className={inCompare ? "ph-fill ph-shuffle" : "ph ph-shuffle"} />
                                            </button>
                                            <Link
                                                to="#"
                                                className="w-52 h-52 bg-main-50 text-main-600 text-xl hover-bg-main-600 hover-text-white flex-center rounded-circle"
                                            >
                                                <i className="ph ph-share-network" />
                                            </Link>
                                        </div>
                                    </div>
                                    <span className="mt-32 pt-32 text-gray-700 border-top border-gray-100 d-block" />
                                    <div className="flex-between gap-16 p-12 border border-main-two-600 border-dashed rounded-8 mb-16">
                                        <div className="flex-align gap-12">
                                            <button
                                                type="button"
                                                className="w-18 h-18 flex-center border border-gray-900 text-xs rounded-circle hover-bg-gray-100"
                                            >
                                                <i className="ph ph-plus" />
                                            </button>
                                            <span className="text-gray-900 fw-medium text-xs">
                                                Special Valkey Coupon: Use **VALKEY10** for 10% off!
                                            </span>
                                        </div>
                                        <Link
                                            to="/cart"
                                            className="text-xs fw-semibold text-main-two-600 text-decoration-underline hover-text-main-two-700"
                                        >
                                            View Details
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-3">
                        <div className="product-details__sidebar border border-gray-100 rounded-16 overflow-hidden">
                            <div className="p-24">
                                <div className="flex-between bg-main-600 rounded-pill p-8">
                                    <div className="flex-align gap-8">
                                        <span className="w-44 h-44 bg-white rounded-circle flex-center text-2xl">
                                            <i className="ph ph-storefront" />
                                        </span>
                                        <span className="text-white text-xs">by {product.brand || "Valkey"}</span>
                                    </div>
                                    <Link
                                        to="/shop"
                                        className="btn btn-white rounded-pill text-uppercase text-xs"
                                    >
                                        View Store
                                    </Link>
                                </div>
                            </div>
                            <div className="p-24 bg-color-one d-flex align-items-start gap-24 border-bottom border-gray-100">
                                <span className="w-44 h-44 bg-white text-main-600 rounded-circle flex-center text-2xl flex-shrink-0">
                                    <i className="ph-fill ph-truck" />
                                </span>
                                <div className="">
                                    <h6 className="text-sm mb-8">Fast Delivery</h6>
                                    <p className="text-gray-700">
                                        Lightning-fast shipping, guaranteed.
                                    </p>
                                </div>
                            </div>
                            <div className="p-24 bg-color-one d-flex align-items-start gap-24 border-bottom border-gray-100">
                                <span className="w-44 h-44 bg-white text-main-600 rounded-circle flex-center text-2xl flex-shrink-0">
                                    <i className="ph-fill ph-arrow-u-up-left" />
                                </span>
                                <div className="">
                                    <h6 className="text-sm mb-8">Free 90-day returns</h6>
                                    <p className="text-gray-700">Shop risk-free with easy returns.</p>
                                </div>
                            </div>
                            <div className="p-24 bg-color-one d-flex align-items-start gap-24 border-bottom border-gray-100">
                                <span className="w-44 h-44 bg-white text-main-600 rounded-circle flex-center text-2xl flex-shrink-0">
                                    <i className="ph-fill ph-check-circle" />
                                </span>
                                <div className="">
                                    <h6 className="text-sm mb-8">
                                        Pickup available at Shop location
                                    </h6>
                                    <p className="text-gray-700">Usually ready in 24 hours</p>
                                </div>
                            </div>
                            <div className="p-24 bg-color-one d-flex align-items-start gap-24 border-bottom border-gray-100">
                                <span className="w-44 h-44 bg-white text-main-600 rounded-circle flex-center text-2xl flex-shrink-0">
                                    <i className="ph-fill ph-credit-card" />
                                </span>
                                <div className="">
                                    <h6 className="text-sm mb-8">Payment</h6>
                                    <p className="text-gray-700">
                                        Payment upon receipt of goods, Payment by card in the
                                        department, Google Pay, Online card.
                                    </p>
                                </div>
                            </div>
                            <div className="p-24 bg-color-one d-flex align-items-start gap-24 border-bottom border-gray-100">
                                <span className="w-44 h-44 bg-white text-main-600 rounded-circle flex-center text-2xl flex-shrink-0">
                                    <i className="ph-fill ph-check-circle" />
                                </span>
                                <div className="">
                                    <h6 className="text-sm mb-8">Warranty</h6>
                                    <p className="text-gray-700">
                                        The Consumer Protection Act does not provide for the return of
                                        this product of proper quality.
                                    </p>
                                </div>
                            </div>
                            <div className="p-24 bg-color-one d-flex align-items-start gap-24 border-bottom border-gray-100">
                                <span className="w-44 h-44 bg-white text-main-600 rounded-circle flex-center text-2xl flex-shrink-0">
                                    <i className="ph-fill ph-package" />
                                </span>
                                <div className="">
                                    <h6 className="text-sm mb-8">Packaging</h6>
                                    <p className="text-gray-700">
                                        Research &amp; development value proposition graphical user
                                        interface investor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-80">
                    <div className="product-dContent border rounded-24">
                        <div className="product-dContent__header border-bottom border-gray-100 flex-between flex-wrap gap-16">
                            <ul
                                className="nav common-tab nav-pills mb-3"
                                id="pills-tab"
                                role="tablist"
                            >
                                <li className="nav-item" role="presentation">
                                    <button
                                        className="nav-link active"
                                        id="pills-description-tab"
                                        data-bs-toggle="pill"
                                        data-bs-target="#pills-description"
                                        type="button"
                                        role="tab"
                                        aria-controls="pills-description"
                                        aria-selected="true"
                                    >
                                        Description
                                    </button>
                                </li>
                                <li className="nav-item" role="presentation">
                                    <button
                                        className="nav-link"
                                        id="pills-reviews-tab"
                                        data-bs-toggle="pill"
                                        data-bs-target="#pills-reviews"
                                        type="button"
                                        role="tab"
                                        aria-controls="pills-reviews"
                                        aria-selected="false"
                                    >
                                        Reviews
                                    </button>
                                </li>
                            </ul>
                            <Link
                                to="#"
                                className="btn bg-color-one rounded-16 flex-align gap-8 text-main-600 hover-bg-main-600 hover-text-white"
                            >
                                <img src="assets/images/icon/satisfaction-icon.png" alt="" />
                                100% Satisfaction Guaranteed
                            </Link>
                        </div>
                        <div className="product-dContent__box">
                            <div className="tab-content" id="pills-tabContent">
                                <div
                                    className="tab-pane fade show active"
                                    id="pills-description"
                                    role="tabpanel"
                                    aria-labelledby="pills-description-tab"
                                    tabIndex={0}
                                >
                                    <div className="mb-40">
                                        <h6 className="mb-24">Product Description</h6>
                                        <p style={{ whiteSpace: 'pre-line' }}>
                                            {product.description}
                                        </p>
                                    </div>
                                    <div className="mb-40">
                                        <h6 className="mb-24">Product Specifications</h6>
                                        <ul className="mt-32">
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    SKU:
                                                    <span className="text-gray-500"> {product.sku || "N/A"}</span>
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    Brand:
                                                    <span className="text-gray-500"> {product.brand || "Valkey"}</span>
                                                </span>
                                            </li>
                                            {product.attributes && Object.entries(product.attributes).map(([key, val]) => (
                                                <li key={key} className="text-gray-400 mb-14 flex-align gap-14">
                                                    <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                        <i className="ph ph-check" />
                                                    </span>
                                                    <span className="text-heading fw-medium text-capitalize">
                                                        {key}:
                                                        <span className="text-gray-500"> {String(val)}</span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="mb-40">
                                        <h6 className="mb-24">Nutrition Facts</h6>
                                        <ul className="mt-32">
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    {" "}
                                                    Total Fat 10g 13%
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    {" "}
                                                    Saturated Fat 1.5g 7%
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    {" "}
                                                    Cholesterol 0mg 0%
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    {" "}
                                                    Sodium 170mg 7%
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-heading fw-medium">
                                                    {" "}
                                                    Potassium 350mg 6%
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="mb-0">
                                        <h6 className="mb-24">More Details</h6>
                                        <ul className="mt-32">
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-gray-500">
                                                    {" "}
                                                    Lunarlon midsole delivers ultra-plush responsiveness
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-gray-500">
                                                    {" "}
                                                    Encapsulated Air-Sole heel unit for lightweight cushioning
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-gray-500">
                                                    {" "}
                                                    Colour Shown: Ale Brown/Black/Goldtone/Ale Brown
                                                </span>
                                            </li>
                                            <li className="text-gray-400 mb-14 flex-align gap-14">
                                                <span className="w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle">
                                                    <i className="ph ph-check" />
                                                </span>
                                                <span className="text-gray-500"> Style: 805899-202</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                                <div
                                    className="tab-pane fade"
                                    id="pills-reviews"
                                    role="tabpanel"
                                    aria-labelledby="pills-reviews-tab"
                                    tabIndex={0}
                                >
                                    <div className="row g-4">
                                        <div className="col-lg-6">
                                            <h6 className="mb-24">Product Description</h6>
                                            <div className="d-flex align-items-start gap-24 pb-44 border-bottom border-gray-100 mb-44">
                                                <img
                                                    src="assets/images/thumbs/comment-img1.png"
                                                    alt=""
                                                    className="w-52 h-52 object-fit-cover rounded-circle flex-shrink-0"
                                                />
                                                <div className="flex-grow-1">
                                                    <div className="flex-between align-items-start gap-8 ">
                                                        <div className="">
                                                            <h6 className="mb-12 text-md">Nicolas cage</h6>
                                                            <div className="flex-align gap-8">
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-gray-800 text-xs">
                                                            3 Days ago
                                                        </span>
                                                    </div>
                                                    <h6 className="mb-14 text-md mt-24">Greate Product</h6>
                                                    <p className="text-gray-700">
                                                        There are many variations of passages of Lorem Ipsum
                                                        available, but the majority have suffered alteration in
                                                        some form, by injected humour
                                                    </p>
                                                    <div className="flex-align gap-20 mt-44">
                                                        <button className="flex-align gap-12 text-gray-700 hover-text-main-600">
                                                            <i className="ph-bold ph-thumbs-up" />
                                                            Like
                                                        </button>
                                                        <Link
                                                            to="#comment-form"
                                                            className="flex-align gap-12 text-gray-700 hover-text-main-600"
                                                        >
                                                            <i className="ph-bold ph-arrow-bend-up-left" />
                                                            Replay
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-start gap-24">
                                                <img
                                                    src="assets/images/thumbs/comment-img1.png"
                                                    alt=""
                                                    className="w-52 h-52 object-fit-cover rounded-circle flex-shrink-0"
                                                />
                                                <div className="flex-grow-1">
                                                    <div className="flex-between align-items-start gap-8 ">
                                                        <div className="">
                                                            <h6 className="mb-12 text-md">Nicolas cage</h6>
                                                            <div className="flex-align gap-8">
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-gray-800 text-xs">
                                                            3 Days ago
                                                        </span>
                                                    </div>
                                                    <h6 className="mb-14 text-md mt-24">Greate Product</h6>
                                                    <p className="text-gray-700">
                                                        There are many variations of passages of Lorem Ipsum
                                                        available, but the majority have suffered alteration in
                                                        some form, by injected humour
                                                    </p>
                                                    <div className="flex-align gap-20 mt-44">
                                                        <button className="flex-align gap-12 text-gray-700 hover-text-main-600">
                                                            <i className="ph-bold ph-thumbs-up" />
                                                            Like
                                                        </button>
                                                        <Link
                                                            to="#comment-form"
                                                            className="flex-align gap-12 text-gray-700 hover-text-main-600"
                                                        >
                                                            <i className="ph-bold ph-arrow-bend-up-left" />
                                                            Replay
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-56">
                                                <div className="">
                                                    <h6 className="mb-24">Write a Review</h6>
                                                    <span className="text-heading mb-8">
                                                        What is it like to Product?
                                                    </span>
                                                    <div className="flex-align gap-8">
                                                        <span className="text-15 fw-medium text-warning-600 d-flex">
                                                            <i className="ph-fill ph-star" />
                                                        </span>
                                                        <span className="text-15 fw-medium text-warning-600 d-flex">
                                                            <i className="ph-fill ph-star" />
                                                        </span>
                                                        <span className="text-15 fw-medium text-warning-600 d-flex">
                                                            <i className="ph-fill ph-star" />
                                                        </span>
                                                        <span className="text-15 fw-medium text-warning-600 d-flex">
                                                            <i className="ph-fill ph-star" />
                                                        </span>
                                                        <span className="text-15 fw-medium text-warning-600 d-flex">
                                                            <i className="ph-fill ph-star" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mt-32">
                                                    <form action="#">
                                                        <div className="mb-32">
                                                            <label
                                                                htmlFor="title"
                                                                className="text-neutral-600 mb-8"
                                                            >
                                                                Review Title
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="common-input rounded-8"
                                                                id="title"
                                                                placeholder="Great Products"
                                                            />
                                                        </div>
                                                        <div className="mb-32">
                                                            <label
                                                                htmlFor="desc"
                                                                className="text-neutral-600 mb-8"
                                                            >
                                                                Review Content
                                                            </label>
                                                            <textarea
                                                                className="common-input rounded-8"
                                                                id="desc"
                                                                defaultValue={
                                                                    "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English."
                                                                }
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            className="btn btn-main rounded-pill mt-48"
                                                        >
                                                            Submit Review
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-lg-6">
                                            <div className="ms-xxl-5">
                                                <h6 className="mb-24">Customers Feedback</h6>
                                                <div className="d-flex flex-wrap gap-44">
                                                    <div className="border border-gray-100 rounded-8 px-40 py-52 flex-center flex-column flex-shrink-0 text-center">
                                                        <h2 className="mb-6 text-main-600">4.8</h2>
                                                        <div className="flex-center gap-8">
                                                            <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                <i className="ph-fill ph-star" />
                                                            </span>
                                                            <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                <i className="ph-fill ph-star" />
                                                            </span>
                                                            <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                <i className="ph-fill ph-star" />
                                                            </span>
                                                            <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                <i className="ph-fill ph-star" />
                                                            </span>
                                                            <span className="text-15 fw-medium text-warning-600 d-flex">
                                                                <i className="ph-fill ph-star" />
                                                            </span>
                                                        </div>
                                                        <span className="mt-16 text-gray-500">
                                                            Average Product Rating
                                                        </span>
                                                    </div>
                                                    <div className="border border-gray-100 rounded-8 px-24 py-40 flex-grow-1">
                                                        <div className="flex-align gap-8 mb-20">
                                                            <span className="text-gray-900 flex-shrink-0">5</span>
                                                            <div
                                                                className="progress w-100 bg-gray-100 rounded-pill h-8"
                                                                role="progressbar"
                                                                aria-label="Basic example"
                                                                aria-valuenow={70}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            >
                                                                <div
                                                                    className="progress-bar bg-main-600 rounded-pill"
                                                                    style={{ width: "70%" }}
                                                                />
                                                            </div>
                                                            <div className="flex-align gap-4">
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-900 flex-shrink-0">
                                                                124
                                                            </span>
                                                        </div>
                                                        <div className="flex-align gap-8 mb-20">
                                                            <span className="text-gray-900 flex-shrink-0">4</span>
                                                            <div
                                                                className="progress w-100 bg-gray-100 rounded-pill h-8"
                                                                role="progressbar"
                                                                aria-label="Basic example"
                                                                aria-valuenow={50}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            >
                                                                <div
                                                                    className="progress-bar bg-main-600 rounded-pill"
                                                                    style={{ width: "50%" }}
                                                                />
                                                            </div>
                                                            <div className="flex-align gap-4">
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-900 flex-shrink-0">
                                                                52
                                                            </span>
                                                        </div>
                                                        <div className="flex-align gap-8 mb-20">
                                                            <span className="text-gray-900 flex-shrink-0">3</span>
                                                            <div
                                                                className="progress w-100 bg-gray-100 rounded-pill h-8"
                                                                role="progressbar"
                                                                aria-label="Basic example"
                                                                aria-valuenow={35}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            >
                                                                <div
                                                                    className="progress-bar bg-main-600 rounded-pill"
                                                                    style={{ width: "35%" }}
                                                                />
                                                            </div>
                                                            <div className="flex-align gap-4">
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-900 flex-shrink-0">
                                                                12
                                                            </span>
                                                        </div>
                                                        <div className="flex-align gap-8 mb-20">
                                                            <span className="text-gray-900 flex-shrink-0">2</span>
                                                            <div
                                                                className="progress w-100 bg-gray-100 rounded-pill h-8"
                                                                role="progressbar"
                                                                aria-label="Basic example"
                                                                aria-valuenow={20}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            >
                                                                <div
                                                                    className="progress-bar bg-main-600 rounded-pill"
                                                                    style={{ width: "20%" }}
                                                                />
                                                            </div>
                                                            <div className="flex-align gap-4">
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-900 flex-shrink-0">5</span>
                                                        </div>
                                                        <div className="flex-align gap-8 mb-0">
                                                            <span className="text-gray-900 flex-shrink-0">1</span>
                                                            <div
                                                                className="progress w-100 bg-gray-100 rounded-pill h-8"
                                                                role="progressbar"
                                                                aria-label="Basic example"
                                                                aria-valuenow={5}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            >
                                                                <div
                                                                    className="progress-bar bg-main-600 rounded-pill"
                                                                    style={{ width: "5%" }}
                                                                />
                                                            </div>
                                                            <div className="flex-align gap-4">
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                                <span className="text-xs fw-medium text-warning-600 d-flex">
                                                                    <i className="ph-fill ph-star" />
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-900 flex-shrink-0">2</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

    )
}

export default ProductDetailsOne