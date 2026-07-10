// frontend/src/components/Account.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';

const Account = () => {
    const [user, setUser] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    
    // Login fields
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginSuccess, setLoginSuccess] = useState('');

    // Register fields
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regFirstName, setRegFirstName] = useState('');
    const [regLastName, setRegLastName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState('');

    // Dashboard tabs: 'profile' | 'addresses' | 'orders' | 'session'
    const [activeTab, setActiveTab] = useState('profile');

    // Profile update states
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');

    // Password update states
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Address states
    const [addrLabel, setAddrLabel] = useState('Home');
    const [addrStreet, setAddrStreet] = useState('');
    const [addrCity, setAddrCity] = useState('');
    const [addrState, setAddrState] = useState('');
    const [addrPostalCode, setAddrPostalCode] = useState('');
    const [addrCountry, setAddrCountry] = useState('India');
    const [addrIsDefault, setAddrIsDefault] = useState(false);
    const [addrSuccess, setAddrSuccess] = useState('');
    const [addrError, setAddrError] = useState('');

    // Orders state
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('valkey_session_token');
            if (!token) {
                setLoadingProfile(false);
                return;
            }
            try {
                const profile = await api.auth.me();
                setUser(profile);
            } catch (err) {
                console.error('Failed to fetch profile:', err);
                localStorage.removeItem('valkey_session_token');
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        if (user) {
            setEditFirstName(user.firstName || '');
            setEditLastName(user.lastName || '');
            setEditPhone(user.phone || '');
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'orders' && user) {
            handleLoadOrders();
        }
    }, [activeTab]);

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Handle Login Submit
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoginError('');
        setLoginSuccess('');

        if (!loginEmail.trim()) {
            setLoginError('Email address is required.');
            return;
        }
        if (!validateEmail(loginEmail)) {
            setLoginError('Please enter a valid email address.');
            return;
        }
        if (!loginPassword) {
            setLoginError('Password is required.');
            return;
        }

        try {
            const res = await api.auth.login({ email: loginEmail, password: loginPassword });
            setLoginSuccess('Logged in successfully!');
            setUser(res.user);
            window.location.reload();
        } catch (err) {
            setLoginError(err.message || 'Invalid email or password.');
        }
    };

    // Handle Register Submit
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setRegError('');
        setRegSuccess('');

        if (!regFirstName.trim()) {
            setRegError('First name is required.');
            return;
        }
        if (!regLastName.trim()) {
            setRegError('Last name is required.');
            return;
        }
        if (!regEmail.trim()) {
            setRegError('Email address is required.');
            return;
        }
        if (!validateEmail(regEmail)) {
            setRegError('Please enter a valid email address.');
            return;
        }
        if (!regPassword) {
            setRegError('Password is required.');
            return;
        }
        if (regPassword.length < 6) {
            setRegError('Password must be at least 6 characters long.');
            return;
        }
        if (regPhone && !/^\+?[0-9\s-]{4,15}$/.test(regPhone)) {
            setRegError('Please enter a valid phone number.');
            return;
        }

        try {
            await api.auth.register({
                email: regEmail,
                password: regPassword,
                firstName: regFirstName,
                lastName: regLastName,
                phone: regPhone
            });
            setRegSuccess('Registration successful! Please log in.');
            setRegEmail('');
            setRegPassword('');
            setRegFirstName('');
            setRegLastName('');
            setRegPhone('');
        } catch (err) {
            setRegError(err.message || 'Registration failed.');
        }
    };

    // Handle Refresh Session
    const handleRefreshSession = async () => {
        try {
            const res = await api.auth.refresh();
            setUser(prev => ({
                ...prev,
                concurrentSessions: res.concurrentSessions
            }));
            alert('Valkey Session TTL successfully refreshed (86400s)!');
        } catch (err) {
            console.error('Failed to refresh session:', err);
            alert('Failed to refresh session.');
        }
    };

    // Handle Log Out
    const handleLogout = async () => {
        try {
            await api.auth.logout();
            setUser(null);
            window.location.reload();
        } catch (err) {
            console.error('Failed to log out:', err);
        }
    };

    // Handle Profile Update
    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setProfileSuccess('');
        setProfileError('');

        if (!editFirstName.trim()) {
            setProfileError('First name is required.');
            return;
        }
        if (!editLastName.trim()) {
            setProfileError('Last name is required.');
            return;
        }
        if (editPhone && !/^\+?[0-9\s-]{4,15}$/.test(editPhone)) {
            setProfileError('Please enter a valid phone number.');
            return;
        }

        try {
            const res = await api.request('/auth/profile', {
                method: 'PATCH',
                body: JSON.stringify({
                    firstName: editFirstName,
                    lastName: editLastName,
                    phone: editPhone
                })
            });
            setUser(res.user);
            setProfileSuccess('Profile updated successfully!');
        } catch (err) {
            setProfileError(err.message || 'Failed to update profile.');
        }
    };

    // Handle Password Update
    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setPasswordSuccess('');
        setPasswordError('');

        if (!oldPassword) {
            setPasswordError('Current password is required.');
            return;
        }
        if (!newPassword) {
            setPasswordError('New password is required.');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters long.');
            return;
        }

        try {
            await api.request('/auth/password', {
                method: 'PATCH',
                body: JSON.stringify({ oldPassword, newPassword })
            });
            setPasswordSuccess('Password updated successfully!');
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setPasswordError(err.message || 'Failed to update password.');
        }
    };

    // Handle Add Address
    const handleAddAddress = async (e) => {
        e.preventDefault();
        setAddrSuccess('');
        setAddrError('');

        if (!addrStreet.trim()) {
            setAddrError('Street address is required.');
            return;
        }
        if (!addrCity.trim()) {
            setAddrError('City is required.');
            return;
        }
        if (!addrState.trim()) {
            setAddrError('State is required.');
            return;
        }
        if (!addrPostalCode.trim()) {
            setAddrError('Postal / ZIP code is required.');
            return;
        }
        if (!addrCountry.trim()) {
            setAddrError('Country is required.');
            return;
        }

        try {
            const res = await api.request('/auth/address', {
                method: 'POST',
                body: JSON.stringify({
                    label: addrLabel,
                    street: addrStreet,
                    city: addrCity,
                    state: addrState,
                    postalCode: addrPostalCode,
                    country: addrCountry,
                    isDefault: addrIsDefault
                })
            });
            setUser(prev => ({ ...prev, addresses: res.addresses }));
            setAddrSuccess('Address added successfully!');
            setAddrStreet('');
            setAddrCity('');
            setAddrState('');
            setAddrPostalCode('');
            setAddrIsDefault(false);
        } catch (err) {
            setAddrError(err.message || 'Failed to add address.');
        }
    };

    // Handle Delete Address
    const handleDeleteAddress = async (addressId) => {
        if (!window.confirm('Are you sure you want to delete this address?')) return;
        try {
            const res = await api.request(`/auth/address/${addressId}`, {
                method: 'DELETE'
            });
            setUser(prev => ({ ...prev, addresses: res.addresses }));
        } catch (err) {
            alert(err.message || 'Failed to delete address.');
        }
    };

    // Handle Load Orders
    const handleLoadOrders = async () => {
        try {
            setLoadingOrders(true);
            const data = await api.checkout.history();
            setOrders(data || []);
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setLoadingOrders(false);
        }
    };

    const formatPrice = (amount) => {
        return `INR ${(amount / 100).toFixed(2)}`;
    };

    if (loadingProfile) {
        return (
            <div className="container py-80 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-16 text-gray-500">Validating Valkey session...</p>
            </div>
        );
    }

    // If user is already logged in, show the User Profile Dashboard
    if (user) {
        return (
            <section className="account py-80">
                <div className="container container-lg">
                    <div className="border border-gray-100 rounded-16 p-40 bg-gray-50">
                        <div className="d-flex align-items-center justify-content-between border-bottom border-gray-100 pb-24 mb-32 flex-wrap gap-16">
                            <div>
                                <h4 className="mb-4">Welcome back, {user.firstName}!</h4>
                                <p className="text-gray-500 mb-0">Manage your Valkey account, saved addresses, orders, and active sessions.</p>
                            </div>
                            <button onClick={handleLogout} className="btn btn-danger rounded-8 py-12 px-24">
                                Log Out
                            </button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="d-flex gap-8 border-bottom border-gray-100 pb-16 mb-32 overflow-x-auto">
                            {['profile', 'addresses', 'orders', 'session'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`btn px-24 py-12 rounded-8 font-semibold text-sm transition-2 border-0 ${
                                        activeTab === tab
                                            ? 'bg-main-600 text-white'
                                            : 'bg-white text-gray-700 hover-bg-gray-100'
                                    }`}
                                >
                                    {tab === 'profile' && '📝 Profile Info'}
                                    {tab === 'addresses' && '📍 Saved Addresses'}
                                    {tab === 'orders' && '🛍️ Order History'}
                                    {tab === 'session' && '⚡ Valkey Session'}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content Panel */}
                        <div className="tab-content">
                            {/* Profile Info Tab */}
                            {activeTab === 'profile' && (
                                <div className="row gy-4">
                                    <div className="col-lg-6">
                                        <form onSubmit={handleProfileUpdate} className="border border-gray-100 rounded-8 bg-white p-24">
                                            <h6 className="text-lg mb-16 border-bottom border-gray-100 pb-8">Edit Profile details</h6>
                                            
                                            <div className="mb-16">
                                                <label className="form-label text-sm fw-medium text-gray-700">First Name</label>
                                                <input
                                                    type="text"
                                                    className="common-input py-10 px-16 text-sm rounded-6"
                                                    value={editFirstName}
                                                    onChange={(e) => setEditFirstName(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            
                                            <div className="mb-16">
                                                <label className="form-label text-sm fw-medium text-gray-700">Last Name</label>
                                                <input
                                                    type="text"
                                                    className="common-input py-10 px-16 text-sm rounded-6"
                                                    value={editLastName}
                                                    onChange={(e) => setEditLastName(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="mb-16">
                                                <label className="form-label text-sm fw-medium text-gray-700">Email Address (Read-only)</label>
                                                <input
                                                    type="email"
                                                    className="common-input py-10 px-16 text-sm rounded-6 bg-gray-50 text-gray-500 border-gray-100"
                                                    value={user.email}
                                                    disabled
                                                />
                                            </div>

                                            <div className="mb-24">
                                                <label className="form-label text-sm fw-medium text-gray-700">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    className="common-input py-10 px-16 text-sm rounded-6"
                                                    value={editPhone}
                                                    onChange={(e) => setEditPhone(e.target.value)}
                                                />
                                            </div>

                                            {profileError && <p className="text-danger text-sm mb-16">{profileError}</p>}
                                            {profileSuccess && <p className="text-success text-sm mb-16">{profileSuccess}</p>}

                                            <button type="submit" className="btn btn-main py-10 px-24 rounded-8 text-sm">
                                                Save Changes
                                            </button>
                                        </form>
                                    </div>
                                    <div className="col-lg-6">
                                        <form onSubmit={handlePasswordUpdate} className="border border-gray-100 rounded-8 bg-white p-24">
                                            <h6 className="text-lg mb-16 border-bottom border-gray-100 pb-8">Update Password</h6>

                                            <div className="mb-16">
                                                <label className="form-label text-sm fw-medium text-gray-700">Current Password</label>
                                                <input
                                                    type="password"
                                                    className="common-input py-10 px-16 text-sm rounded-6"
                                                    value={oldPassword}
                                                    onChange={(e) => setOldPassword(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="mb-24">
                                                <label className="form-label text-sm fw-medium text-gray-700">New Password</label>
                                                <input
                                                    type="password"
                                                    className="common-input py-10 px-16 text-sm rounded-6"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            {passwordError && <p className="text-danger text-sm mb-16">{passwordError}</p>}
                                            {passwordSuccess && <p className="text-success text-sm mb-16">{passwordSuccess}</p>}

                                            <button type="submit" className="btn btn-outline-main py-10 px-24 rounded-8 text-sm">
                                                Change Password
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Saved Addresses Tab */}
                            {activeTab === 'addresses' && (
                                <div className="row gy-4">
                                    <div className="col-lg-7 text-start">
                                        <div className="border border-gray-100 rounded-8 bg-white p-24">
                                            <h6 className="text-lg mb-24 border-bottom border-gray-100 pb-8">Addresses List</h6>
                                            {(!user.addresses || user.addresses.length === 0) ? (
                                                <div className="text-center py-40 text-gray-500">
                                                    <i className="ph ph-map-pin text-4xl mb-8 d-block" />
                                                    No saved addresses found. Add one on the right!
                                                </div>
                                            ) : (
                                                <div className="row g-12">
                                                    {user.addresses.map((addr) => (
                                                        <div key={addr.id} className="col-md-6">
                                                            <div className="border border-gray-150 rounded-8 p-16 position-relative hover-border-main-500 transition-1">
                                                                <div className="d-flex align-items-center justify-content-between mb-8">
                                                                    <span className="badge bg-main-100 text-main-700 rounded-pill px-8 py-4 text-xs font-semibold">
                                                                        {addr.label}
                                                                    </span>
                                                                    {addr.isDefault && (
                                                                        <span className="badge bg-success-100 text-success-700 rounded-pill px-8 py-4 text-xs font-semibold">
                                                                            Default
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-gray-800 mb-16">
                                                                    {addr.street},<br />
                                                                    {addr.city}, {addr.state} - {addr.postalCode},<br />
                                                                    {addr.country}
                                                                </p>
                                                                <button
                                                                    onClick={() => handleDeleteAddress(addr.id)}
                                                                    className="btn btn-outline-danger p-8 text-xs rounded-6 d-flex align-items-center gap-4"
                                                                >
                                                                    <i className="ph ph-trash" /> Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-lg-5">
                                        <form onSubmit={handleAddAddress} className="border border-gray-100 rounded-8 bg-white p-24">
                                            <h6 className="text-lg mb-16 border-bottom border-gray-100 pb-8">Add New Address</h6>

                                            <div className="mb-12">
                                                <label className="form-label text-sm fw-medium text-gray-700">Label (e.g. Home, Office)</label>
                                                <input
                                                    type="text"
                                                    className="common-input py-8 px-12 text-sm rounded-6"
                                                    value={addrLabel}
                                                    onChange={(e) => setAddrLabel(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="mb-12">
                                                <label className="form-label text-sm fw-medium text-gray-700">Street Address</label>
                                                <input
                                                    type="text"
                                                    className="common-input py-8 px-12 text-sm rounded-6"
                                                    placeholder="Building No, Street name"
                                                    value={addrStreet}
                                                    onChange={(e) => setAddrStreet(e.target.value)}
                                                    required
                                                />
                                            </div>

                                            <div className="row g-12 mb-12">
                                                <div className="col-6">
                                                    <label className="form-label text-sm fw-medium text-gray-700">City</label>
                                                    <input
                                                        type="text"
                                                        className="common-input py-8 px-12 text-sm rounded-6"
                                                        value={addrCity}
                                                        onChange={(e) => setAddrCity(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label text-sm fw-medium text-gray-700">State</label>
                                                    <input
                                                        type="text"
                                                        className="common-input py-8 px-12 text-sm rounded-6"
                                                        value={addrState}
                                                        onChange={(e) => setAddrState(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="row g-12 mb-16">
                                                <div className="col-6">
                                                    <label className="form-label text-sm fw-medium text-gray-700">Postal Code</label>
                                                    <input
                                                        type="text"
                                                        className="common-input py-8 px-12 text-sm rounded-6"
                                                        value={addrPostalCode}
                                                        onChange={(e) => setAddrPostalCode(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="col-6">
                                                    <label className="form-label text-sm fw-medium text-gray-700">Country</label>
                                                    <input
                                                        type="text"
                                                        className="common-input py-8 px-12 text-sm rounded-6"
                                                        value={addrCountry}
                                                        onChange={(e) => setAddrCountry(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="mb-24 form-check d-flex gap-8 align-items-center">
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    id="addr-default"
                                                    checked={addrIsDefault}
                                                    onChange={(e) => setAddrIsDefault(e.target.checked)}
                                                />
                                                <label className="form-check-label text-sm text-gray-700 mb-0" htmlFor="addr-default">
                                                    Mark as default shipping address
                                                </label>
                                            </div>

                                            {addrError && <p className="text-danger text-sm mb-16">{addrError}</p>}
                                            {addrSuccess && <p className="text-success text-sm mb-16">{addrSuccess}</p>}

                                            <button type="submit" className="btn btn-main py-10 px-24 rounded-8 text-sm w-100">
                                                Add Address
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Order History Tab */}
                            {activeTab === 'orders' && (
                                <div className="border border-gray-100 rounded-8 bg-white p-24 text-start">
                                    <h6 className="text-lg mb-24 border-bottom border-gray-100 pb-8">Past Orders</h6>
                                    
                                    {loadingOrders ? (
                                        <div className="text-center py-40">
                                            <div className="spinner-border text-primary" role="status"></div>
                                            <p className="mt-8 text-gray-500 text-sm">Querying Valkey orders sorted set...</p>
                                        </div>
                                    ) : orders.length === 0 ? (
                                        <div className="text-center py-40 text-gray-500">
                                            <i className="ph ph-shopping-bag text-4xl mb-8 d-block" />
                                            No orders placed yet. <Link to="/shop" className="text-main-600 font-semibold">Start shopping!</Link>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table align-middle">
                                                <thead>
                                                    <tr>
                                                        <th>Order ID</th>
                                                        <th>Date</th>
                                                        <th>Items</th>
                                                        <th>Total</th>
                                                        <th>Status</th>
                                                        <th>Payment</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orders.map((order) => (
                                                        <tr key={order.id}>
                                                            <td className="text-break font-monospace text-xs">{order.id}</td>
                                                            <td className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                                                            <td className="text-sm">
                                                                <ul className="list-unstyled mb-0 ps-0 text-xs">
                                                                    {order.items?.map((item, idx) => (
                                                                        <li key={idx}>
                                                                            • {item.name} x {item.quantity}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </td>
                                                            <td className="text-sm fw-semibold">{formatPrice(order.total)}</td>
                                                            <td>
                                                                <span className={`badge px-8 py-4 rounded-pill text-xs fw-semibold ${
                                                                    order.status === 'confirmed' ? 'bg-success-100 text-success-700' :
                                                                    order.status === 'pending' ? 'bg-warning-100 text-warning-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                    {order.status}
                                                                </span>
                                                            </td>
                                                            <td className="text-xs">
                                                                {order.payment?.method?.toUpperCase() || 'CARD'} ({order.payment?.status})
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Valkey Session Tab */}
                            {activeTab === 'session' && (
                                <div className="row gy-4 text-start">
                                    <div className="col-lg-6">
                                        <div className="border border-gray-100 rounded-8 bg-white p-24 h-100">
                                            <h6 className="text-lg mb-16 border-bottom border-gray-100 pb-8">Valkey Session Info</h6>
                                            
                                            <div className="mb-16 bg-main-two-50 p-16 rounded-8 border border-main-two-100">
                                                <span className="fw-semibold d-block text-main-two-700 text-sm mb-4">⚡ Monotonic UUIDv7 Enabled</span>
                                                <span className="text-xs text-gray-600">Your User ID is a UUIDv7, which embeds chronological timestamps. This allows Valkey to sort accounts automatically by signup date without extra indexing.</span>
                                            </div>
                                            
                                            <div className="mb-16 bg-success-50 p-16 rounded-8 border border-success-100">
                                                <span className="fw-semibold d-block text-success-700 text-sm mb-4">🟢 Active Session Token</span>
                                                <span className="text-xs text-gray-600">Your token is stored in Valkey with a sliding-window 24h expiration, automatically refreshing on every request.</span>
                                            </div>

                                            <div className="mb-24 bg-purple-50 p-16 rounded-8 border border-purple-100" style={{ backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }}>
                                                <span className="fw-semibold d-block text-sm mb-4" style={{ color: '#6B21A8' }}>👥 Active Concurrent Sessions: {user.concurrentSessions || 1}</span>
                                                <span className="text-xs text-gray-600">Valkey is currently tracking all active session tokens associated with this user ID in a Sorted Set.</span>
                                            </div>

                                            <button onClick={handleRefreshSession} className="btn btn-main w-100 py-12 rounded-8 font-semibold">
                                                ⚡ Refresh Session TTL
                                            </button>
                                        </div>
                                    </div>
                                    <div className="col-lg-6">
                                        <div className="border border-gray-100 rounded-8 bg-white p-24 h-100 text-start">
                                            <h6 className="text-lg mb-16 border-bottom border-gray-100 pb-8">Profile Details</h6>
                                            <table className="table table-borderless m-0">
                                                <tbody>
                                                    <tr>
                                                        <td className="fw-semibold px-0 text-gray-500" style={{ width: '120px' }}>User ID:</td>
                                                        <td className="px-0 text-break font-monospace text-xs">{user.id}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="fw-semibold px-0 text-gray-500">First Name:</td>
                                                        <td className="px-0">{user.firstName}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="fw-semibold px-0 text-gray-500">Last Name:</td>
                                                        <td className="px-0">{user.lastName}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="fw-semibold px-0 text-gray-500">Email:</td>
                                                        <td className="px-0">{user.email}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="fw-semibold px-0 text-gray-500">Phone:</td>
                                                        <td className="px-0">{user.phone || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="fw-semibold px-0 text-gray-500">Role:</td>
                                                        <td className="px-0">
                                                            <span className={`badge px-8 py-4 text-xs font-semibold ${
                                                                user.role === 'admin' ? 'bg-danger-100 text-danger-700' : 'bg-info-100 text-info-700'
                                                            }`}>
                                                                {user.role}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // Otherwise, show Login & Registration Forms
    return (
        <section className="account py-80">
            <div className="container container-lg">
                <div className="row gy-4">
                    {/* Login Card Start */}
                    <div className="col-xl-6 pe-xl-5">
                        <form onSubmit={handleLoginSubmit} className="border border-gray-100 hover-border-main-600 transition-1 rounded-16 px-24 py-40 h-100 bg-white">
                            <h6 className="text-xl mb-32">Login</h6>
                            
                            <div className="mb-24">
                                <label htmlFor="login-email" className="text-neutral-900 text-lg mb-8 fw-medium">
                                    Email address <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="common-input"
                                    id="login-email"
                                    placeholder="Enter your email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="mb-24">
                                <label htmlFor="login-password" className="text-neutral-900 text-lg mb-8 fw-medium">
                                    Password <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="password"
                                    className="common-input"
                                    id="login-password"
                                    placeholder="Enter Password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {loginError && <p className="text-danger mb-24">{loginError}</p>}
                            {loginSuccess && <p className="text-success mb-24">{loginSuccess}</p>}

                            <div className="mb-24 mt-48">
                                <button type="submit" className="btn btn-main py-18 px-40 rounded-8 w-100">
                                    Log in
                                </button>
                            </div>
                        </form>
                    </div>
                    {/* Login Card End */}

                    {/* Register Card Start */}
                    <div className="col-xl-6">
                        <form onSubmit={handleRegisterSubmit} className="border border-gray-100 hover-border-main-600 transition-1 rounded-16 px-24 py-40 bg-white">
                            <h6 className="text-xl mb-32">Register</h6>
                            
                            <div className="row g-12 mb-24">
                                <div className="col-6">
                                    <label htmlFor="reg-first" className="text-neutral-900 text-md mb-8 fw-medium">
                                        First Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="common-input"
                                        id="reg-first"
                                        placeholder="First Name"
                                        value={regFirstName}
                                        onChange={(e) => setRegFirstName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="col-6">
                                    <label htmlFor="reg-last" className="text-neutral-900 text-md mb-8 fw-medium">
                                        Last Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="common-input"
                                        id="reg-last"
                                        placeholder="Last Name"
                                        value={regLastName}
                                        onChange={(e) => setRegLastName(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="mb-24">
                                <label htmlFor="reg-email" className="text-neutral-900 text-lg mb-8 fw-medium">
                                    Email address <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="common-input"
                                    id="reg-email"
                                    placeholder="Enter Email Address"
                                    value={regEmail}
                                    onChange={(e) => setRegEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="mb-24">
                                <label htmlFor="reg-password" className="text-neutral-900 text-lg mb-8 fw-medium">
                                    Password <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="password"
                                    className="common-input"
                                    id="reg-password"
                                    placeholder="Enter Password"
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="mb-24">
                                <label htmlFor="reg-phone" className="text-neutral-900 text-lg mb-8 fw-medium">
                                    Phone Number (Optional)
                                </label>
                                <input
                                    type="tel"
                                    className="common-input"
                                    id="reg-phone"
                                    placeholder="+91-XXXXX-XXXXX"
                                    value={regPhone}
                                    onChange={(e) => setRegPhone(e.target.value)}
                                />
                            </div>

                            {regError && <p className="text-danger mb-24">{regError}</p>}
                            {regSuccess && <p className="text-success mb-24">{regSuccess}</p>}

                            <div className="mt-48">
                                <button type="submit" className="btn btn-main py-18 px-40 rounded-8 w-100">
                                    Register
                                </button>
                            </div>
                        </form>
                    </div>
                    {/* Register Card End */}
                </div>
            </div>
        </section>
    );
};

export default Account;