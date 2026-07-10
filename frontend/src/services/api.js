import { API_BASE } from '../constants/api';

const getGuestSessionId = () => {
    let guestId = localStorage.getItem('valkey_guest_session_id');
    if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('valkey_guest_session_id', guestId);
    }
    return guestId;
};

export const api = {
    request: async (endpoint, options = {}) => {
        const token = localStorage.getItem('valkey_session_token');
        const guestId = getGuestSessionId();

        const headers = {
            'Content-Type': 'application/json',
            'x-guest-session-id': guestId,
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers
        };

        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || errData.message || `API Error: ${res.status}`);
        }

        return res.json();
    },

    auth: {
        register: (data) => api.request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
        login: async (data) => {
            const res = await api.request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
            if (res.token) localStorage.setItem('valkey_session_token', res.token);
            return res;
        },
        logout: async () => {
            try { await api.request('/auth/logout', { method: 'POST' }); } catch (e) {}
            localStorage.removeItem('valkey_session_token');
        },
        me: () => api.request('/auth/me'),
        refresh: () => api.request('/auth/refresh', { method: 'POST' })
    },

    products: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return api.request(`/products?${query}`);
        },
        get: (id) => api.request(`/products/${id}`),
        create: (data) => api.request('/products', { method: 'POST', body: JSON.stringify(data) }),
        patch: (id, data) => api.request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        getCategories: () => api.request('/categories'),
        getCategoryProducts: (id) => api.request(`/categories/${id}/products`),
        getCategoryBreadcrumbs: (id) => api.request(`/categories/${id}/breadcrumbs`),
        getVendorProducts: (id) => api.request(`/vendors/${id}/products`),
        getTrending: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return api.request(`/trending?${query}`);
        },
        trackEvent: (productId, eventType) => api.request('/trending/events', { method: 'POST', body: JSON.stringify({ productId, eventType }) })
    },

    cart: {
        get: () => api.request('/cart'),
        addItem: (productId, quantity = 1) => api.request('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
        updateItem: (productId, quantity) => api.request(`/cart/items/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
        removeItem: (productId) => api.request(`/cart/items/${productId}`, { method: 'DELETE' }),
        clear: () => api.request('/cart', { method: 'DELETE' }),
        applyCoupon: (code) => api.request('/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) }),
        removeCoupon: () => api.request('/cart/coupon', { method: 'DELETE' })
    },

    checkout: {
        start: (addressData) => api.request('/checkout/start', { method: 'POST', body: JSON.stringify({ address: addressData }) }),
        confirm: (orderId, paymentDetails = {}) => api.request('/checkout/confirm', { method: 'POST', body: JSON.stringify({ orderId, payment: paymentDetails }) }),
        cancel: (orderId) => api.request('/checkout/cancel', { method: 'POST', body: JSON.stringify({ orderId }) }),
        history: () => api.request('/orders')
    }
};
