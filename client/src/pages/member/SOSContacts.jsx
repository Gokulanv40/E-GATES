import React, { useState, useEffect, useCallback } from 'react';
import {
  HiShieldExclamation,
  HiPhone,
  HiUser,
  HiHeart,
  HiPencilSquare,
  HiCheckCircle,
  HiArrowPath,
  HiExclamationTriangle,
  HiTrash,
  HiPlus,
  HiBuildingOffice2,
  HiMapPin,
  HiShieldCheck,
  HiFire,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useSOS } from '../../hooks/useSOS';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function MemberSOSContacts() {
  const { user } = useAuth();
  const { triggerSOS, isSending, cancelSOS, showCancel, cancelCountdown, resetSOS, isTriggered, lastAlert } = useSOS();

  const [loading, setLoading] = useState(true);
  const [defaultContacts, setDefaultContacts] = useState([]);
  const [familyContact, setFamilyContact] = useState(null);

  // Edit Family Contact Modal State
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [submittingFamily, setSubmittingFamily] = useState(false);
  const [familyForm, setFamilyForm] = useState({
    name: '',
    phone: '',
    designation: 'Spouse',
  });

  const relationPresets = [
    'Spouse',
    'Father',
    'Mother',
    'Son',
    'Daughter',
    'Brother',
    'Sister',
    'Guardian',
    'Relative / Neighbor',
  ];

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/sos/contacts');
      const rawDefaults = res.data?.defaultContacts || [];
      const fam = res.data?.familyContact || null;

      setDefaultContacts(rawDefaults);
      setFamilyContact(fam);

      if (fam) {
        setFamilyForm({
          name: fam.name || '',
          phone: fam.phone || '',
          designation: fam.designation || 'Family / Relative',
        });
      }
    } catch (err) {
      console.error('Failed to load SOS contacts:', err);
      toast.error('Failed to load emergency contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleOpenAddEditFamily = () => {
    if (familyContact) {
      setFamilyForm({
        name: familyContact.name || '',
        phone: familyContact.phone || '',
        designation: familyContact.designation || 'Spouse',
      });
    } else {
      setFamilyForm({
        name: '',
        phone: '',
        designation: 'Spouse',
      });
    }
    setIsFamilyModalOpen(true);
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    if (!familyForm.name.trim()) {
      toast.error('Please enter the family member name');
      return;
    }
    if (!familyForm.phone.trim()) {
      toast.error('Please enter the family member phone number');
      return;
    }

    try {
      setSubmittingFamily(true);
      const res = await api.post('/sos/family-contact', {
        name: familyForm.name.trim(),
        phone: familyForm.phone.trim(),
        designation: familyForm.designation.trim() || 'Family / Relative',
      });
      toast.success(res.data?.message || 'Family emergency contact saved successfully!');
      setIsFamilyModalOpen(false);
      fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save family emergency contact');
    } finally {
      setSubmittingFamily(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!window.confirm('Are you sure you want to remove your family emergency contact?')) return;
    try {
      await api.delete('/sos/family-contact');
      toast.success('Family emergency contact removed');
      setFamilyContact(null);
      setFamilyForm({ name: '', phone: '', designation: 'Spouse' });
      fetchContacts();
    } catch (err) {
      toast.error('Failed to remove family contact');
    }
  };

  const memberResponders = defaultContacts.filter((c) => c.contact_type === 'member');
  const policeResponder = defaultContacts.find((c) => c.contact_type === 'police');

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-red-950 via-rose-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-rose-200 text-xs font-semibold">
              <HiShieldExclamation className="w-4 h-4 text-rose-400" />
              <span>Emergency Preparedness & Resident Safety</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Emergency SOS Contacts
            </h1>
            <p className="text-rose-100 text-xs sm:text-sm leading-relaxed">
              When an SOS alarm is triggered, instant automated alerts and SMS messages with your live location coordinates are dispatched to verified responders: <strong>3 Association Default Contacts</strong> and <strong>Your Personal Family Contact</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAddEditFamily}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-rose-950/40 transition"
            >
              <HiPencilSquare className="w-4 h-4" />
              <span>{familyContact ? 'Edit Family Contact' : '+ Add Family Contact'}</span>
            </button>
            <button
              type="button"
              onClick={fetchContacts}
              title="Refresh Contacts"
              className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl transition text-white"
            >
              <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Notice Explaining Rules */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <HiShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Emergency Contact Hierarchy</p>
            <p className="text-gray-500 mt-0.5 leading-relaxed">
              • <strong>3 Association Default Contacts:</strong> Set by Association Admin for all residents (2 Layout Responders + 1 Police Station). Read-only for members.<br />
              • <strong>Personal Family Contact:</strong> Managed exclusively by you. Only you can add or edit your family emergency contact.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3 bg-white rounded-3xl border border-gray-100">
          <LoadingSpinner message="Loading emergency responders..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION A: Association Default Contacts (3 Contacts) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <HiBuildingOffice2 className="w-5 h-5 text-indigo-600" />
                  <span>Association Default Contacts (3 Responders)</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Configured by Association Admin • Default for all layout members
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                🔒 Admin Managed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Responder 1 */}
              <div className="bg-white rounded-2xl p-5 border-2 border-indigo-100 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                      Community Responder #1
                    </span>
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                  </div>

                  {memberResponders[0] ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                          {memberResponders[0].name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">
                            {memberResponders[0].name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">
                            {memberResponders[0].designation || 'Resident Responder'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/60">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                          Emergency Phone
                        </span>
                        <a
                          href={`tel:${memberResponders[0].phone}`}
                          className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-1.5"
                        >
                          <HiPhone className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{memberResponders[0].phone}</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400 italic">
                      Responder 1 not configured yet by Admin.
                    </div>
                  )}
                </div>

                {memberResponders[0]?.phone && (
                  <a
                    href={`tel:${memberResponders[0].phone}`}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition"
                  >
                    <HiPhone className="w-3.5 h-3.5" />
                    <span>Call Responder 1</span>
                  </a>
                )}

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-bold flex items-center gap-1">
                    🔒 Edit Disabled
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Association Default
                  </span>
                </div>
              </div>

              {/* Responder 2 */}
              <div className="bg-white rounded-2xl p-5 border-2 border-indigo-100 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                      Community Responder #2
                    </span>
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                  </div>

                  {memberResponders[1] ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                          {memberResponders[1].name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">
                            {memberResponders[1].name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">
                            {memberResponders[1].designation || 'Resident Responder'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/60">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                          Emergency Phone
                        </span>
                        <a
                          href={`tel:${memberResponders[1].phone}`}
                          className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-1.5"
                        >
                          <HiPhone className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{memberResponders[1].phone}</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400 italic">
                      Responder 2 not configured yet by Admin.
                    </div>
                  )}
                </div>

                {memberResponders[1]?.phone && (
                  <a
                    href={`tel:${memberResponders[1].phone}`}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition"
                  >
                    <HiPhone className="w-3.5 h-3.5" />
                    <span>Call Responder 2</span>
                  </a>
                )}

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-bold flex items-center gap-1">
                    🔒 Edit Disabled
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Association Default
                  </span>
                </div>
              </div>

              {/* Police Contact */}
              <div className="bg-white rounded-2xl p-5 border-2 border-red-100 shadow-xs flex flex-col justify-between hover:border-red-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-red-100 text-red-800">
                      Police / Law Enforcement
                    </span>
                    <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                      👮
                    </span>
                  </div>

                  {policeResponder ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-sm font-bold">
                          P
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">
                            {policeResponder.name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">
                            {policeResponder.designation || 'Station House Officer / Police Control'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-red-50/50 rounded-xl p-3 border border-red-100/60">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                          Police Helpline / Hotline
                        </span>
                        <a
                          href={`tel:${policeResponder.phone}`}
                          className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1.5"
                        >
                          <HiPhone className="w-3.5 h-3.5 text-red-600" />
                          <span>{policeResponder.phone}</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400 italic">
                      Police contact not configured yet by Admin.
                    </div>
                  )}
                </div>

                {policeResponder?.phone && (
                  <a
                    href={`tel:${policeResponder.phone}`}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition"
                  >
                    <HiPhone className="w-3.5 h-3.5" />
                    <span>Call Police</span>
                  </a>
                )}

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-bold flex items-center gap-1">
                    🔒 Edit Disabled
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Association Default
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B: Personal Family Emergency Contact (Only Member Can Edit) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <HiHeart className="w-5 h-5 text-rose-600" />
                  <span>Your Personal Family Emergency Contact</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Personal to you • Only you can view & edit this contact
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                👤 Member Editable Only
              </span>
            </div>

            <div className="bg-white rounded-2xl border-2 border-rose-200 p-6 shadow-sm relative overflow-hidden bg-gradient-to-br from-rose-50/30 via-white to-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                    {familyContact ? '👨‍👩‍👧' : '❤️'}
                  </div>

                  <div className="space-y-1">
                    {familyContact ? (
                      <>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-extrabold uppercase">
                          <span>{familyContact.designation || 'Family Contact'}</span>
                        </div>
                        <h3 className="text-lg font-extrabold text-gray-900">
                          {familyContact.name}
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <HiPhone className="w-4 h-4 text-rose-600" />
                          <a href={`tel:${familyContact.phone}`} className="font-bold text-rose-700 hover:underline">
                            {familyContact.phone}
                          </a>
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-base font-bold text-gray-900">
                          No Family Emergency Contact Set Yet
                        </h3>
                        <p className="text-xs text-gray-500 max-w-lg leading-relaxed">
                          Add your primary next of kin (spouse, parent, brother, sister, or guardian). When you trigger an SOS alert, your family contact will receive an automated SMS with your live Google Maps location.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {familyContact ? (
                    <>
                      <a
                        href={`tel:${familyContact.phone}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                      >
                        <HiPhone className="w-4 h-4" />
                        <span>Call Family</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleOpenAddEditFamily}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                      >
                        <HiPencilSquare className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteFamily}
                        title="Remove family contact"
                        className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-gray-200"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenAddEditFamily}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition"
                    >
                      <HiPlus className="w-4 h-4" />
                      <span>Add Family Emergency Contact</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION C: Instant SOS Emergency Action Banner */}
          <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <HiShieldExclamation className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-red-950">
                  Instant Emergency Distress Trigger
                </h3>
                <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                  In case of immediate threat, intruder, medical, or fire emergency at your house, trigger the distress beacon to notify all 3 association responders + your family contact.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => triggerSOS('Immediate Distress')}
                disabled={isSending}
                className="inline-flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-red-600/30 transition disabled:opacity-50"
              >
                <HiShieldExclamation className="w-5 h-5 animate-pulse" />
                <span>{isSending ? 'Dispatching SOS...' : '🚨 Trigger Instant SOS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Personal Family Contact */}
      <Modal
        isOpen={isFamilyModalOpen}
        onClose={() => setIsFamilyModalOpen(false)}
        title={familyContact ? 'Edit Personal Family Emergency Contact' : 'Add Personal Family Emergency Contact'}
        size="md"
      >
        <form onSubmit={handleSaveFamily} className="space-y-4">
          <p className="text-xs text-gray-500">
            This contact belongs exclusively to your profile. Only you can view or change this information.
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Family Member Name *
            </label>
            <input
              type="text"
              required
              value={familyForm.name}
              onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
              placeholder="e.g. Priya Murali / K. Senthil"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Relationship / Role *
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {relationPresets.map((rel) => (
                <button
                  type="button"
                  key={rel}
                  onClick={() => setFamilyForm({ ...familyForm, designation: rel })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    familyForm.designation === rel
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {rel}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              value={familyForm.designation}
              onChange={(e) => setFamilyForm({ ...familyForm, designation: e.target.value })}
              placeholder="e.g. Spouse / Father / Sister"
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Mobile Phone Number (for SMS & Calls) *
            </label>
            <input
              type="tel"
              required
              value={familyForm.phone}
              onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={submittingFamily}
              onClick={() => setIsFamilyModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingFamily}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
            >
              {submittingFamily ? 'Saving...' : 'Save Family Contact'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
