import React, { useState, useEffect, useCallback } from 'react';
import {
  HiShieldExclamation,
  HiPhone,
  HiUser,
  HiBuildingOffice2,
  HiPencilSquare,
  HiCheckCircle,
  HiArrowPath,
  HiExclamationTriangle,
  HiHeart,
  HiTrash,
  HiPlus,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminSOSContacts() {
  const [contacts, setContacts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Configuration modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State with 3 Association Default contacts: Member 1, Member 2, and Police
  const [formState, setFormState] = useState({
    member1: { user_id: '', name: '', phone: '', designation: '' },
    member2: { user_id: '', name: '', phone: '', designation: '' },
    police: { name: '', phone: '', designation: 'Station House Officer / Police Control' },
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [contactsRes, membersRes] = await Promise.allSettled([
        api.get('/sos/contacts'),
        api.get('/users'),
      ]);

      let loadedContacts = [];
      if (contactsRes.status === 'fulfilled') {
        const raw = contactsRes.value.data?.data || contactsRes.value.data || [];
        loadedContacts = Array.isArray(raw) ? raw : [];
        setContacts(loadedContacts);
      }

      let loadedMembers = [];
      if (membersRes.status === 'fulfilled') {
        const rawUsers = membersRes.value.data?.data || membersRes.value.data || [];
        loadedMembers = Array.isArray(rawUsers) ? rawUsers.filter((u) => u.status === 'approved') : [];
        setMembers(loadedMembers);
      }

      // Populate form state from loaded contacts
      const memberContacts = loadedContacts.filter((c) => c.contact_type === 'member');
      const policeContact = loadedContacts.find((c) => c.contact_type === 'police');

      setFormState({
        member1: memberContacts[0]
          ? {
              user_id: memberContacts[0].user_id || '',
              name: memberContacts[0].name || '',
              phone: memberContacts[0].phone || '',
              designation: memberContacts[0].designation || 'Resident Responder 1',
            }
          : { user_id: '', name: '', phone: '', designation: '' },
        member2: memberContacts[1]
          ? {
              user_id: memberContacts[1].user_id || '',
              name: memberContacts[1].name || '',
              phone: memberContacts[1].phone || '',
              designation: memberContacts[1].designation || 'Resident Responder 2',
            }
          : { user_id: '', name: '', phone: '', designation: '' },
        police: policeContact
          ? {
              name: policeContact.name || '',
              phone: policeContact.phone || '',
              designation: policeContact.designation || 'Station House Officer / Police Control',
            }
          : { name: '', phone: '', designation: 'Station House Officer / Police Control' },
      });
    } catch (err) {
      console.error('Failed to load SOS contacts:', err);
      toast.error('Failed to load emergency contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectMember1 = (userId) => {
    const found = members.find((m) => String(m.id) === String(userId));
    if (found) {
      setFormState((prev) => ({
        ...prev,
        member1: {
          user_id: found.id,
          name: found.name,
          phone: found.phone || '',
          designation: prev.member1.designation || 'Resident Responder 1',
        },
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        member1: { user_id: '', name: '', phone: '', designation: '' },
      }));
    }
  };

  const handleSelectMember2 = (userId) => {
    const found = members.find((m) => String(m.id) === String(userId));
    if (found) {
      setFormState((prev) => ({
        ...prev,
        member2: {
          user_id: found.id,
          name: found.name,
          phone: found.phone || '',
          designation: prev.member2.designation || 'Resident Responder 2',
        },
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        member2: { user_id: '', name: '', phone: '', designation: '' },
      }));
    }
  };

  const handleSaveContacts = async (e) => {
    e.preventDefault();

    if (!formState.member1.name || !formState.member1.phone) {
      toast.error('First Member Emergency Contact details are required');
      return;
    }
    if (!formState.police.name || !formState.police.phone) {
      toast.error('Police / Law enforcement details are required');
      return;
    }

    const payload = [
      {
        contact_type: 'member',
        user_id: formState.member1.user_id ? Number(formState.member1.user_id) : null,
        name: formState.member1.name.trim(),
        phone: formState.member1.phone.trim(),
        designation: formState.member1.designation.trim() || 'Resident Responder 1',
      },
    ];

    if (formState.member2.name && formState.member2.phone) {
      payload.push({
        contact_type: 'member',
        user_id: formState.member2.user_id ? Number(formState.member2.user_id) : null,
        name: formState.member2.name.trim(),
        phone: formState.member2.phone.trim(),
        designation: formState.member2.designation.trim() || 'Resident Responder 2',
      });
    }

    payload.push({
      contact_type: 'police',
      user_id: null,
      name: formState.police.name.trim(),
      phone: formState.police.phone.trim(),
      designation: formState.police.designation.trim() || 'Police Station Contact',
    });

    try {
      setSubmitting(true);
      await api.post('/sos/contacts', { contacts: payload });
      toast.success('Association default emergency contacts configured successfully!');
      setIsConfigModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update SOS contacts');
    } finally {
      setSubmitting(false);
    }
  };

  const memberContacts = contacts.filter((c) => c.contact_type === 'member');
  const policeContact = contacts.find((c) => c.contact_type === 'police');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiShieldExclamation className="w-7 h-7 text-red-600" />
            Association SOS Emergency Contacts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Emergency contacts automatically notified via SMS & call upon SOS trigger: Resident Responders, Police Station, and Family Member Kin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh contacts"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <HiPencilSquare className="w-4 h-4" />
            <span>Configure Contacts</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
        <HiShieldExclamation className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-bold">Association Default SOS Contacts:</p>
          <p className="leading-relaxed text-indigo-900">
            These 3 contacts (2 Community Member Responders + 1 Police Station) are the <strong>default emergency contacts for all members</strong> of this association. Only Administrators can change these association-wide contacts.
          </p>
          <p className="text-[11px] text-indigo-700 font-medium">
            💡 Individual members can configure and edit their own personal Family Emergency Contact directly in their User Portal.
          </p>
        </div>
      </div>

      {/* 4 Contact Cards Grid (3 Editable by Admin, 1 Family Contact Disabled) */}
      {loading ? (
        <div className="py-16 bg-white rounded-2xl border border-gray-100">
          <LoadingSpinner message="Loading emergency contacts..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Member Contact 1 */}
          <div className="bg-white rounded-2xl p-5 border-2 border-blue-100 shadow-sm flex flex-col justify-between hover:border-blue-300 transition">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Community Member #1
                </span>
                <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  1
                </span>
              </div>

              {memberContacts[0] ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-base font-bold">
                      {memberContacts[0].name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{memberContacts[0].name}</h3>
                      <p className="text-xs text-gray-500">{memberContacts[0].designation || 'Emergency Responder'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Phone Number</span>
                    <a
                      href={`tel:${memberContacts[0].phone}`}
                      className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1.5"
                    >
                      <HiPhone className="w-3.5 h-3.5" />
                      {memberContacts[0].phone}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 italic">
                  Not configured yet
                </div>
              )}
            </div>

            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="mt-4 w-full py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition"
            >
              Edit Contact 1
            </button>
          </div>

          {/* 2. Member Contact 2 */}
          <div className="bg-white rounded-2xl p-5 border-2 border-indigo-100 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Community Member #2
                </span>
                <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  2
                </span>
              </div>

              {memberContacts[1] ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base font-bold">
                      {memberContacts[1].name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{memberContacts[1].name}</h3>
                      <p className="text-xs text-gray-500">{memberContacts[1].designation || 'Emergency Responder'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Phone Number</span>
                    <a
                      href={`tel:${memberContacts[1].phone}`}
                      className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1.5"
                    >
                      <HiPhone className="w-3.5 h-3.5" />
                      {memberContacts[1].phone}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 italic">
                  Not configured yet
                </div>
              )}
            </div>

            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="mt-4 w-full py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition"
            >
              Edit Contact 2
            </button>
          </div>

          {/* 3. Police Contact */}
          <div className="bg-white rounded-2xl p-5 border-2 border-red-100 shadow-sm flex flex-col justify-between hover:border-red-300 transition">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
                  Police Department
                </span>
                <span className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                  👮
                </span>
              </div>

              {policeContact ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-base font-bold">
                      P
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{policeContact.name}</h3>
                      <p className="text-xs text-gray-500">{policeContact.designation || 'Local Police Station'}</p>
                    </div>
                  </div>

                  <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Hotline / Mobile</span>
                    <a
                      href={`tel:${policeContact.phone}`}
                      className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1.5"
                    >
                      <HiPhone className="w-3.5 h-3.5 text-red-600" />
                      {policeContact.phone}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 italic">
                  No police contact configured
                </div>
              )}
            </div>

            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="mt-4 w-full py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              Edit Police Contact
            </button>
          </div>

          {/* 4. Family Member Contact - DISABLED & NOT EDITABLE IN ADMIN PANEL */}
          <div className="bg-gray-50/90 rounded-2xl p-5 border-2 border-dashed border-gray-300 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                  <HiHeart className="w-3 h-3 text-rose-500" /> Family Contact
                </span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  🔒 Disabled for Admin
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center text-base font-bold">
                    👨‍👩‍👧
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Family Emergency Contact</h3>
                    <p className="text-xs text-gray-500">Resident Personal Contact</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-gray-200 text-xs text-gray-600 space-y-1">
                  <p className="font-bold text-gray-800 flex items-center gap-1 text-[11px]">
                    <span>🔒 Not Editable by Admin</span>
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Family contact numbers are personal to each member and can only be edited by members in their member portal.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 w-full py-2 px-3 text-center text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed">
              🔒 Non-Editable in Admin Panel
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configure Contacts */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configure Association Emergency SOS Contacts"
        size="lg"
      >
        <form onSubmit={handleSaveContacts} className="space-y-5">
          <p className="text-xs text-gray-500">
            Configure the 3 association default emergency responders. The 4th family contact is personal to residents and is non-editable in the Admin panel.
          </p>
          {/* 1. Member 1 */}
          <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-blue-900 uppercase">1. Community Member #1</h3>
              <span className="text-[10px] text-gray-500">Pick from residents</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Select Resident</label>
                <select
                  value={formState.member1.user_id}
                  onChange={(e) => handleSelectMember1(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">-- Choose verified resident --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.door_no ? `Door #${m.door_no}` : m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={formState.member1.name}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      member1: { ...formState.member1, name: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Emergency Phone *</label>
                <input
                  type="tel"
                  required
                  value={formState.member1.phone}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      member1: { ...formState.member1, phone: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Role / Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Association President"
                  value={formState.member1.designation}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      member1: { ...formState.member1, designation: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Member 2 */}
          <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-900 uppercase">2. Community Member #2</h3>
              <span className="text-[10px] text-gray-500">Second resident responder</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Select Resident</label>
                <select
                  value={formState.member2.user_id}
                  onChange={(e) => handleSelectMember2(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">-- Choose verified resident --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.door_no ? `Door #${m.door_no}` : m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Contact Name</label>
                <input
                  type="text"
                  value={formState.member2.name}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      member2: { ...formState.member2, name: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Emergency Phone</label>
                <input
                  type="tel"
                  value={formState.member2.phone}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      member2: { ...formState.member2, phone: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Role / Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Security Committee Lead"
                  value={formState.member2.designation}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      member2: { ...formState.member2, designation: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Police Contact */}
          <div className="bg-red-50/40 p-3.5 rounded-xl border border-red-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-red-900 uppercase">3. Police Station / Law Enforcement</h3>
              <span className="text-[10px] text-gray-500">Jurisdiction Police</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Station / Officer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Local Police Station Control"
                  value={formState.police.name}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      police: { ...formState.police, name: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Station Phone / Hotline *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 100 or station phone"
                  value={formState.police.phone}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      police: { ...formState.police, phone: e.target.value },
                    })
                  }
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Family Member Contact - DISABLED FOR ADMIN */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-dashed border-gray-300 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                <HiHeart className="w-3.5 h-3.5 text-rose-400" />
                4. Personal Family Emergency Contact
              </h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                🔒 Disabled (Editable by Member Only)
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Family emergency contact numbers cannot be edited by administrators. Each resident configures their own personal family emergency number in their user portal.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <input
                type="text"
                disabled
                readOnly
                value="Configured individually by residents"
                className="w-full text-xs px-2.5 py-1.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed font-medium"
              />
              <input
                type="text"
                disabled
                readOnly
                value="🔒 Non-editable in Admin Panel"
                className="w-full text-xs px-2.5 py-1.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsConfigModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Saving Contacts...' : 'Save Emergency Contacts'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
