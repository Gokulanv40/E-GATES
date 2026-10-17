import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiUser,
  HiEnvelope,
  HiPhone,
  HiLockClosed,
  HiBuildingOffice2,
  HiHome,
  HiMapPin,
  HiCheckCircle,
  HiExclamationCircle,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import FileUpload from '../../components/common/FileUpload';
import PoweredByLogo from '../../components/common/PoweredByLogo';
import api from '../../services/api';

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [associations, setAssociations] = useState([]);
  const [loadingAssocs, setLoadingAssocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'member', // 'member' | 'admin'
    association_id: '',
    door_no: '',
    street: '',
    layout_name: '',
    taluk: '',
    district: '',
    state: 'Tamil Nadu',
    password: '',
    confirm_password: '',
  });

  const [ebBillProof, setEbBillProof] = useState(null);
  const [taxReceiptProof, setTaxReceiptProof] = useState(null);

  // Fetch associations for dropdown
  useEffect(() => {
    let isMounted = true;
    const fetchAssociations = async () => {
      try {
        setLoadingAssocs(true);
        const res = await api.get('/associations');
        const list = res.data?.data || res.data || [];
        if (isMounted) {
          setAssociations(list);
          if (list.length > 0 && !formData.association_id) {
            setFormData((prev) => ({ ...prev, association_id: list[0].id }));
          }
        }
      } catch (err) {
        console.warn('Could not load associations list:', err.message);
      } finally {
        if (isMounted) setLoadingAssocs(false);
      }
    };

    fetchAssociations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-gray-200' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 50, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 3) return { score: 75, label: 'Good', color: 'bg-blue-500' };
    return { score: 100, label: 'Strong', color: 'bg-green-500' };
  };

  const pwdStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Client-side validations
    if (formData.password !== formData.confirm_password) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!formData.phone || formData.phone.length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile phone number.');
      return;
    }

    if (!formData.association_id) {
      setErrorMessage('Please select your association.');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = new FormData();

      // Append textual fields
      Object.entries(formData).forEach(([key, val]) => {
        if (key !== 'confirm_password' && val !== null && val !== undefined) {
          data.append(key, val);
        }
      });

      // Append file proofs
      if (ebBillProof instanceof File) {
        data.append('eb_bill_proof', ebBillProof);
      }
      if (taxReceiptProof instanceof File) {
        data.append('property_tax_receipt', taxReceiptProof);
      }

      await register(data);
      setSuccessMessage(
        'Registration submitted successfully! Your application is awaiting administrator verification. You will be able to log in once approved.'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Registration failed. Please check the provided information.';
      setErrorMessage(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Header with Top Centre Powered by Logo */}
      <div className="relative w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <Link to="/" className="flex items-center gap-2 text-white">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center font-black text-lg shadow-lg">
            LA
          </div>
          <span className="font-bold text-base tracking-tight hidden sm:inline">
            Association Portal
          </span>
        </Link>

        {/* Top Centre with Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <PoweredByLogo size="lg" />
        </div>

        <div className="md:hidden">
          <PoweredByLogo size="md" />
        </div>
      </div>

      {/* Main Registration Container */}
      <div className="w-full max-w-3xl mx-auto my-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {t('auth_register_title')}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {t('auth_register_subtitle')}
            </p>
          </div>

          {successMessage ? (
            <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <h3 className="text-xl font-bold text-gray-900">Application Submitted!</h3>
              <p className="text-sm text-gray-700 max-w-md mx-auto leading-relaxed">
                {successMessage}
              </p>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-md transition"
                >
                  {t('auth_back_to_login')}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
                  <HiExclamationCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Account & Association Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-700 flex items-center gap-2 border-b pb-2">
                  <HiBuildingOffice2 className="w-5 h-5" />
                  1. Association & Role
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_association')} *
                    </label>
                    <select
                      name="association_id"
                      required
                      value={formData.association_id}
                      onChange={handleChange}
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    >
                      <option value="">{t('auth_choose_association')}</option>
                      {associations.map((assoc) => (
                        <option key={assoc.id} value={assoc.id}>
                          {assoc.name} {assoc.city ? `(${assoc.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_role')} *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'member' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                          formData.role === 'member'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {t('auth_role_member')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                          formData.role === 'admin'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {t('auth_role_admin')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Personal & Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-700 flex items-center gap-2 border-b pb-2">
                  <HiUser className="w-5 h-5" />
                  2. Personal Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_name')} *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. S. Muralidharan"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_phone')} *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      pattern="[0-9]{10}"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_email')}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@example.com"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Address in Layout */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-700 flex items-center gap-2 border-b pb-2">
                  <HiHome className="w-5 h-5" />
                  3. Layout Residence Address
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_door_no')} *
                    </label>
                    <input
                      type="text"
                      name="door_no"
                      required
                      value={formData.door_no}
                      onChange={handleChange}
                      placeholder="e.g. 14A or Plot 21"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_street')} *
                    </label>
                    <input
                      type="text"
                      name="street"
                      required
                      value={formData.street}
                      onChange={handleChange}
                      placeholder="e.g. 2nd Cross Street"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_layout_name')}
                    </label>
                    <input
                      type="text"
                      name="layout_name"
                      value={formData.layout_name}
                      onChange={handleChange}
                      placeholder="e.g. Green Valley Gardens"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_taluk')}
                    </label>
                    <input
                      type="text"
                      name="taluk"
                      value={formData.taluk}
                      onChange={handleChange}
                      placeholder="e.g. Tambaram"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_district')}
                    </label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      placeholder="e.g. Chengalpattu"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_state')}
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Verification Document Proofs */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-700 flex items-center gap-2 border-b pb-2">
                  <HiMapPin className="w-5 h-5" />
                  4. Address Proof Documents (Mandatory for verification)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileUpload
                    label={t('auth_eb_bill')}
                    helperText="Electricity Bill PDF/JPG (Max 5MB)"
                    value={ebBillProof}
                    onChange={(file) => setEbBillProof(file)}
                  />

                  <FileUpload
                    label={t('auth_tax_receipt')}
                    helperText="Property Tax Receipt PDF/JPG (Max 5MB)"
                    value={taxReceiptProof}
                    onChange={(file) => setTaxReceiptProof(file)}
                  />
                </div>
              </div>

              {/* 5. Password & Security */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary-700 flex items-center gap-2 border-b pb-2">
                  <HiLockClosed className="w-5 h-5" />
                  5. Security Password
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_password')} *
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min 6 characters"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />

                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-gray-500">Strength:</span>
                          <span className="font-semibold text-gray-700">{pwdStrength.label}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pwdStrength.color} transition-all duration-300`}
                            style={{ width: `${pwdStrength.score}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t('auth_confirm_password')} *
                    </label>
                    <input
                      type="password"
                      name="confirm_password"
                      required
                      value={formData.confirm_password}
                      onChange={handleChange}
                      placeholder="Re-type password"
                      className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('common_loading') : t('auth_submit_registration')}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-gray-500 hover:text-primary-600 hover:underline"
                >
                  {t('auth_already_have_account')}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Layout Association Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}
