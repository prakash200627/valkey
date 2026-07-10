// frontend/src/components/ShopSection.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const ShopSection = () => {
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [grid, setGrid] = useState(false); // list-view vs grid-view
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [sortBy, setSortBy] = useState('popular');
    const [page, setPage] = useState(1);
    const [addedProductId, setAddedProductId] = useState(null);
    const [categories, setCategories] = useState([{ id: '', name: 'All Categories' }]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);

    const loadCategories = async () => {
        try {
            const tree = await api.products.getCategories();
            const list = [{ id: '', name: 'All Categories' }];
            
            // Recursively flatten tree nodes for easy selector listing
            const extract = (nodes) => {
                nodes.forEach(node => {
                    list.push({ id: node.id, name: node.name });
                    if (node.childrenDetails && node.childrenDetails.length > 0) {
                        extract(node.childrenDetails);
                    }
                });
            };
            extract(tree);
            setCategories(list);
        } catch (err) {
            console.error('Failed to load categories tree:', err);
        }
    };

    const loadBreadcrumbs = async () => {
        if (!selectedCategory) {
            setBreadcrumbs([]);
            return;
        }
        try {
            const trail = await api.products.getCategoryBreadcrumbs(selectedCategory);
            setBreadcrumbs(trail || []);
        } catch (err) {
            console.error('Failed to load breadcrumbs:', err);
        }
    };

    const loadProducts = async () => {
        try {
            setLoading(true);
            const params = {
                page,
                limit: 8
            };
            if (searchQuery.trim()) params.q = searchQuery;
            if (selectedCategory) params.categoryId = selectedCategory;
            if (minPrice) params.minPrice = parseInt(minPrice) * 100; // to paise
            if (maxPrice) params.maxPrice = parseInt(maxPrice) * 100;

            // Sort map
            if (sortBy === 'price_asc') params.sort = 'price_asc';
            if (sortBy === 'price_desc') params.sort = 'price_desc';
            if (sortBy === 'rating_desc') params.sort = 'rating_desc';

            const res = await api.products.list(params);
            setProducts(res.results || []);
            setTotal(res.total || 0);
        } catch (err) {
            console.error('Failed to load products:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        loadProducts();
        loadBreadcrumbs();
    }, [selectedCategory, sortBy, page]);

    useEffect(() => {
        setPage(1);
    }, [selectedCategory, sortBy, searchQuery]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadProducts();
    };

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        loadProducts();
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setSelectedCategory('');
        setMinPrice('');
        setMaxPrice('');
        setSortBy('popular');
        api.products.list({}).then(res => {
            setProducts(res.results || []);
            setTotal(res.total || 0);
        });
    };

    const handleAddToCart = async (productId) => {
        try {
            setAddedProductId(productId);
            await api.cart.addItem(productId, 1);
            
            // Track event: add to cart in Valkey (Challenge 4)
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
        return `INR ${(amount / 100).toFixed(2)}`;
    };

    return (
        <section className="shop py-80">
            <div className="container container-lg">
                <div className="row">
                    {/* Sidebar Start */}
                    <div className="col-lg-3">
                        <div className="shop-sidebar p-24 border border-gray-100 rounded-8 bg-color-three mb-32">
                            {/* Search Box */}
                            <div className="mb-32">
                                <h6 className="text-xl border-bottom border-gray-100 pb-16 mb-16">
                                    Search Catalog
                                </h6>
                                <form onSubmit={handleSearchSubmit} className="flex-align gap-8">
                                    <input
                                        type="text"
                                        className="common-input py-12 px-16 rounded-8"
                                        placeholder="Typo-tolerant search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                    <button type="submit" className="btn btn-main p-12 rounded-8">
                                        <i className="ph ph-magnifying-glass text-xl d-flex" />
                                    </button>
                                </form>
                            </div>

                            {/* Category Box */}
                            <div className="mb-32">
                                <h6 className="text-xl border-bottom border-gray-100 pb-16 mb-16">
                                    Product Category
                                </h6>
                                <ul className="max-h-540 overflow-y-auto scroll-sm list-unstyled ps-0">
                                    {categories.map((cat) => (
                                        <li key={cat.id} className="mb-12">
                                            <button
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={`btn w-100 text-start py-8 px-12 rounded-6 border-0 ${
                                                    selectedCategory === cat.id
                                                        ? 'bg-main-600 text-white'
                                                        : 'text-gray-900 hover-bg-gray-100'
                                                }`}
                                            >
                                                {cat.name}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Price Filter Box */}
                            <div className="mb-32">
                                <h6 className="text-xl border-bottom border-gray-100 pb-16 mb-16">
                                    Filter by Price
                                </h6>
                                <form onSubmit={handleFilterSubmit}>
                                    <div className="d-flex gap-8 mb-16">
                                        <input
                                            type="number"
                                            className="common-input py-8 px-12 rounded-6 text-sm"
                                            placeholder="Min (INR)"
                                            value={minPrice}
                                            onChange={(e) => setMinPrice(e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="common-input py-8 px-12 rounded-6 text-sm"
                                            placeholder="Max (INR)"
                                            value={maxPrice}
                                            onChange={(e) => setMaxPrice(e.target.value)}
                                        />
                                    </div>
                                    <div className="d-flex gap-8">
                                        <button type="submit" className="btn btn-main py-8 px-16 w-100 rounded-6 text-sm">
                                            Apply
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResetFilters}
                                            className="btn btn-outline-secondary py-8 px-16 w-100 rounded-6 text-sm"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Search info note */}
                            <div className="bg-main-two-50 p-16 rounded-8 border border-main-two-100">
                                <span className="text-sm text-main-two-700 fw-semibold d-block mb-4">
                                    ⚡ Powered by Valkey Search
                                </span>
                                <span className="text-xs text-gray-600 d-block">
                                    Queries execute with automatic indexing, fuzzy keyword typo-matching, and numeric category aggregation!
                                </span>
                            </div>
                        </div>
                    </div>
                    {/* Sidebar End */}

                    {/* Content Start */}
                    <div className="col-lg-9">
                        {/* Dynamic Breadcrumbs Trail */}
                        {selectedCategory && breadcrumbs.length > 0 && (
                            <div className="mb-24 text-start bg-gray-50 py-12 px-16 rounded-8 border border-gray-100 flex-align gap-8">
                                <span className="text-gray-500 text-sm fw-medium flex-align flex-wrap gap-4">
                                    <button 
                                        onClick={handleResetFilters} 
                                        className="bg-transparent border-0 p-0 text-main-600 hover-text-main-700 text-sm fw-semibold"
                                    >
                                        Shop
                                    </button>
                                    {breadcrumbs.map((crumb, idx) => (
                                        <span key={crumb.id} className="flex-align gap-4">
                                            <i className="ph ph-caret-right text-gray-400 text-xs d-flex" />
                                            {idx === breadcrumbs.length - 1 ? (
                                                <span className="text-gray-900 fw-semibold">{crumb.name}</span>
                                            ) : (
                                                <button 
                                                    onClick={() => setSelectedCategory(crumb.id)} 
                                                    className="bg-transparent border-0 p-0 text-main-600 hover-text-main-700 text-sm"
                                                >
                                                    {crumb.name}
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        )}

                        {/* Top Filter Bar */}
                        <div className="flex-between gap-16 flex-wrap mb-40">
                            <span className="text-gray-900 fw-medium">
                                Showing {products.length} of {total} products in Valkey DB
                            </span>
                            <div className="position-relative flex-align gap-16 flex-wrap">
                                <div className="list-grid-btns flex-align gap-16">
                                    <button
                                        onClick={() => setGrid(true)}
                                        type="button"
                                        className={`w-44 h-44 flex-center border rounded-6 text-2xl ${
                                            grid ? 'border-main-600 text-white bg-main-600' : 'border-gray-100 text-gray-500'
                                        }`}
                                    >
                                        <i className="ph-bold ph-list-dashes" />
                                    </button>
                                    <button
                                        onClick={() => setGrid(false)}
                                        type="button"
                                        className={`w-44 h-44 flex-center border rounded-6 text-2xl ${
                                            !grid ? 'border-main-600 text-white bg-main-600' : 'border-gray-100 text-gray-500'
                                        }`}
                                    >
                                        <i className="ph ph-squares-four" />
                                    </button>
                                </div>
                                <div className="position-relative text-gray-500 flex-align gap-4 text-14">
                                    <label htmlFor="sorting" className="text-inherit flex-shrink-0 mb-0">
                                        Sort by:{' '}
                                    </label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="form-control common-input px-14 py-10 text-inherit rounded-6 w-auto"
                                        id="sorting"
                                    >
                                        <option value="popular">Popular</option>
                                        <option value="rating_desc">Highest Rated</option>
                                        <option value="price_asc">Price: Low to High</option>
                                        <option value="price_desc">Price: High to Low</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Products Listing Grid/List Wrapper */}
                        {loading ? (
                            <div className="text-center py-80">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="mt-16 text-gray-500">Querying Valkey Search index...</p>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="border border-gray-100 rounded-8 p-48 text-center bg-gray-50">
                                <i className="ph ph-smiley-sad text-6xl text-gray-300 mb-16 d-block" />
                                <h5 className="mb-8">No products found</h5>
                                <p className="text-gray-500 mb-0">Try adjusting your filters or search keywords.</p>
                            </div>
                        ) : (
                            <div className={`row g-12 ${grid ? 'flex-column' : ''}`}>
                                {products.map((product) => (
                                    <div key={product.id} className={grid ? 'col-12' : 'col-xxl-3 col-xl-4 col-sm-6'}>
                                        <div className="product-card h-100 p-16 border border-gray-100 hover-border-main-600 rounded-16 position-relative transition-2 bg-white d-flex flex-column justify-content-between">
                                            <div>
                                                <Link
                                                    to={`/product-details?id=${product.id}`}
                                                    className="product-card__thumb flex-center rounded-8 bg-gray-50 position-relative"
                                                    style={{ height: '200px', overflow: 'hidden' }}
                                                >
                                                    <img
                                                        src={product.images[0]?.url || 'assets/images/thumbs/product-two-img1.png'}
                                                        alt={product.name}
                                                        style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }}
                                                    />
                                                    <span className="product-card__badge bg-main-600 px-8 py-4 text-sm text-white position-absolute inset-inline-start-0 inset-block-start-0">
                                                        Valkey Product
                                                    </span>
                                                </Link>

                                                <div className="product-card__content mt-16 text-start">
                                                    <span className="py-2 px-8 text-xs rounded-pill text-main-two-600 bg-main-two-50 mb-8 d-inline-block">
                                                        {product.brand}
                                                    </span>
                                                    <h6 className="title text-lg fw-semibold my-8">
                                                        <Link
                                                            to={`/product-details?id=${product.id}`}
                                                            className="link text-line-2"
                                                        >
                                                            {product.name}
                                                        </Link>
                                                    </h6>
                                                    <div className="flex-align mb-16 gap-6">
                                                        <span className="text-xs fw-medium text-gray-500">{product.ratings?.average || 0}</span>
                                                        <span className="text-15 fw-medium text-warning-600 d-flex">
                                                            <i className="ph-fill ph-star" />
                                                        </span>
                                                        <span className="text-xs fw-medium text-gray-500">({product.ratings?.count || 0})</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="product-card__price mb-16 text-start">
                                                    <span className="text-heading text-lg fw-bold">
                                                        {formatPrice(product.price.amount)}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleAddToCart(product.id)}
                                                    type="button"
                                                    disabled={addedProductId === product.id}
                                                    className={`btn w-100 py-12 px-8 rounded-8 flex-center gap-8 fw-semibold text-md transition-2 ${
                                                        addedProductId === product.id
                                                            ? 'bg-success-600 text-white border-success-600'
                                                            : 'bg-main-600 text-white border-main-600 hover-bg-main-700'
                                                    }`}
                                                >
                                                    <i className={addedProductId === product.id ? "ph ph-check text-xl d-flex" : "ph ph-shopping-cart text-xl d-flex"} />
                                                    {addedProductId === product.id ? 'Added!' : 'Add To Cart'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination Section */}
                        {!loading && total > 8 && (
                            <div className="d-flex justify-content-center align-items-center mt-40 gap-8">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="btn btn-outline-secondary py-8 px-16 text-sm rounded-6 border-gray-200"
                                >
                                    Prev
                                </button>
                                {Array.from({ length: Math.ceil(total / 8) }, (_, idx) => idx + 1).map((pNum) => (
                                    <button
                                        key={pNum}
                                        onClick={() => setPage(pNum)}
                                        className={`btn py-8 px-16 text-sm rounded-6 ${
                                            page === pNum 
                                                ? 'bg-main-600 text-white border-main-600' 
                                                : 'btn-outline-secondary border-gray-200 text-gray-700'
                                        }`}
                                    >
                                        {pNum}
                                    </button>
                                ))}
                                <button
                                    disabled={page === Math.ceil(total / 8)}
                                    onClick={() => setPage(p => Math.min(Math.ceil(total / 8), p + 1))}
                                    className="btn btn-outline-secondary py-8 px-16 text-sm rounded-6 border-gray-200"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Content End */}
                </div>
            </div>
        </section>
    );
};

export default ShopSection;