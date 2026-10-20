import React, { useState, useEffect } from 'react';
import {
  HiExclamationTriangle,
  HiPhone,
  HiShieldCheck,
  HiFire,
  HiHeart,
  HiShieldExclamation,
  HiMapPin,
  HiHome,
  HiUser,
  HiCheckCircle,
  HiClock,
  HiArrowTopRightOnSquare,
  HiChatBubbleOvalLeftEllipsis,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import { useSOS } from '../../hooks/useSOS';
import Modal from '../common/Modal';
import api from '../../services/api';

export default function FloatingSOS() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    showTypeSelector,
    setShowTypeSelector,
    showCancel,
    cancelCountdown,
    isSending,
    isTriggered,
    lastAlert,
    triggerSOS,
    cancelSOS,
    resetSOS,
  } = useSOS();

  const [emergencyContacts, setEmergencyContacts] = useState([]);

  // Fetch configured SOS contacts on mount or when alert triggers
  useEffect(() => {
    if (user?.role === 'member') {
      api.get('/sos/contacts')
        .then((res) => {
          const list = res.data?.data || res.data || [];
          if (Array.isArray(list)) setEmergencyContacts(list);
        })
        .catch((err) => console.warn('Could not load SOS contacts for floating widget:', err));
    }
  }, [user?.role, isTriggered]);

  // Floating SOS button is only displayed for resident members
  if (user?.role !== 'member') {
    return null;
  }

  const emergencyTypes = [
    {
      key: 'Medical Emergency',
      label: 'Medical Emergency',
      icon: HiHeart,
      color: 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200',
    },
    {
      key: 'Fire Outbreak',
      label: 'Fire Outbreak',
      icon: HiFire,
      color: 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200',
    },
    {
      key: 'Theft / Intruder',
      label: 'Theft / Intruder',
      icon: HiShieldExclamation,
      color: 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      key: 'Women Safety',
      label: 'Women Safety',
      icon: HiShieldCheck,
      color: 'text-pink-600 bg-pink-50 hover:bg-pink-100 border-pink-200',
    },
    {
      key: 'Other Emergency',
      label: 'Other Emergency',
      icon: HiExclamationTriangle,
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
  ];

  // Helper to compile resident address string
  const compileAddress = () => {
    if (lastAlert?.resident_address) return lastAlert.resident_address;
    const parts = [];
    if (user?.door_no) parts.push(`Door/Flat: ${user.door_no}`);
    if (user?.street) parts.push(`Street: ${user.street}`);
    if (user?.layout_name) parts.push(`Layout: ${user.layout_name}`);
    if (user?.taluk) parts.push(`Taluk: ${user.taluk}`);
    if (user?.district) parts.push(`District: ${user.district}`);
    if (user?.state) parts.push(`State: ${user.state}`);
    return parts.length > 0 ? parts.join(', ') : 'Registered Association Residence';
  };

  const residentAddress = compileAddress();
  const problemName = lastAlert?.problem || lastAlert?.emergency_type || 'Emergency Distress';
  const displayedContacts = (lastAlert?.contacts && lastAlert.contacts.length > 0)
    ? lastAlert.contacts
    : emergencyContacts;

  const constructDistressText = () => {
    return `🚨 EMERGENCY SOS DISTRESS ALERT!\n` +
      `⚠️ Problem: ${problemName}\n` +
      `👤 Resident: ${user?.name || 'Resident'} (Phone: ${user?.phone || 'N/A'})\n` +
      `📍 Address: ${residentAddress}\n` +
      (lastAlert?.location_link ? `🗺️ Map: ${lastAlert.location_link}\n` : '') +
      `Please respond and send emergency help immediately!`;
  };

  return (
    <>
      {/* Floating SOS Action Button (Immediate Reaction on Click) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-center">
        <div className="relative group">
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
              setShowTypeSelector(true);
            }}
            disabled={isSending}
            className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full flex flex-col items-center justify-center font-black text-white shadow-2xl select-none focus:outline-none cursor-pointer transform hover:scale-105 active:scale-95 transition ${
              isTriggered
                ? 'animate-siren bg-red-600 ring-4 sm:ring-8 ring-red-400'
                : 'bg-red-600 hover:bg-red-700 animate-sos-pulse ring-2 sm:ring-4 ring-white/40'
            }`}
            aria-label="Emergency SOS (Click to trigger)"
            title="Click for Emergency SOS"
          >
            <span className="text-sm sm:text-base md:text-xl tracking-wider leading-none">SOS</span>
            <span className="text-[7px] sm:text-[8px] md:text-[9px] font-bold tracking-normal mt-0.5 bg-white/20 px-1.5 py-0.2 rounded-full">
              {isSending ? '...' : 'CLICK'}
            </span>
          </button>
        </div>

        {/* Small hint label */}
        <span className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] font-bold text-gray-700 bg-white/95 backdrop-blur px-2 py-0.5 rounded-full shadow-sm border border-gray-200 hidden md:block pointer-events-none">
          {t('sos_button_title') || 'Emergency SOS (Click)'}
        </span>
      </div>

      {/* Emergency Type Selector Modal (Instant Dispatch on Click) */}
      <Modal
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        title="Select Emergency Type"
        size="md"
      >
        <div className="space-y-3.5 py-1">
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Click any situation below to immediately dispatch emergency distress to association administrators and neighbors:
          </p>

          {/* Primary Top Immediate SOS Button */}
          <button
            type="button"
            onClick={() => triggerSOS('Immediate Emergency Distress')}
            disabled={isSending}
            className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <HiShieldExclamation className="w-5 h-5 text-white animate-pulse" />
            <span>🚨 SEND IMMEDIATE SOS (DISPATCH NOW)</span>
          </button>

          {/* 5 Specific Emergency Category Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {emergencyTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => triggerSOS(type.key)}
                  disabled={isSending}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left font-semibold text-xs sm:text-sm transition hover:scale-[1.02] shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 ${type.color}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          {/* Immediate Phone Calls Section */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">Immediate phone call:</span>
            <div className="flex gap-2">
              <a
                href="tel:100"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition"
              >
                <HiPhone className="w-3.5 h-3.5" />
                <span>100 (Police)</span>
              </a>
              <a
                href="tel:112"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 font-bold rounded-lg hover:bg-red-100 transition"
              >
                <HiPhone className="w-3.5 h-3.5" />
                <span>112 (Helpline)</span>
              </a>
            </div>
          </div>
        </div>
      </Modal>

      {/* 5-Second Cancel Countdown Overlay */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-900/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 text-center shadow-2xl border-4 border-red-500">
            <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <HiExclamationTriangle className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-wide">
              Emergency Distress Alert
            </h3>

            <p className="text-base text-gray-700 font-medium mb-6">
              {t('sos_countdown_text', { seconds: cancelCountdown })}
            </p>

            <div className="w-24 h-24 rounded-full border-4 border-red-600 flex items-center justify-center mx-auto mb-6 text-4xl font-extrabold text-red-600 font-mono">
              {cancelCountdown}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={cancelSOS}
                className="w-full py-3.5 px-6 bg-gray-900 hover:bg-black text-white font-bold text-base rounded-xl transition shadow-lg cursor-pointer"
              >
                {t('sos_cancel_button')} (False Alarm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatched Confirmation Modal with Problem, Address, and SOS Contacts */}
      {isTriggered && (
        <Modal
          isOpen={isTriggered}
          onClose={resetSOS}
          title="🚨 Emergency SOS Distress Dispatched"
          size="lg"
        >
          <div className="py-2 space-y-4">
            {/* Header banner */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-sm">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  Distress Alert Dispatched Automatically!
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Your emergency situation, resident profile, and full address have been transmitted to all association responders and emergency contacts.
                </p>
              </div>
            </div>

            {/* Problem & Resident Address Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Problem Details */}
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
                <span className="font-bold text-red-800 uppercase tracking-wider block text-[10px]">
                  Emergency Problem
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-red-700">
                    {problemName}
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 flex items-center gap-1 pt-1">
                  <HiClock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Address Details */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
                <span className="font-bold text-blue-800 uppercase tracking-wider block text-[10px]">
                  Dispatched Resident Address
                </span>
                <p className="font-semibold text-gray-900 leading-relaxed">
                  {residentAddress}
                </p>
                {lastAlert?.location_link && (
                  <a
                    href={lastAlert.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline pt-0.5"
                  >
                    <HiMapPin className="w-3.5 h-3.5 text-primary-600" />
                    <span>View Live GPS Location</span>
                    <HiArrowTopRightOnSquare className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* SOS Contacts Notified Section (Image 2 list) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Emergency Contacts Notified ({displayedContacts.length})
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <HiCheckCircle className="w-3.5 h-3.5" />
                  <span>SMS Dispatched</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {displayedContacts.map((contact, idx) => {
                  const cleanedPhone = (contact.phone || '').replace(/\D/g, '').slice(-10);
                  const waUrl = `https://wa.me/91${cleanedPhone}?text=${encodeURIComponent(constructDistressText())}`;

                  return (
                    <div
                      key={contact.id || idx}
                      className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs flex flex-col justify-between hover:border-gray-300 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                            {contact.contact_type === 'member'
                              ? `Community Member`
                              : contact.contact_type === 'police'
                              ? 'Police Department'
                              : 'Family Contact'}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <HiCheckCircle className="w-3 h-3" />
                            Sent
                          </span>
                        </div>

                        <h5 className="font-bold text-gray-900 text-xs sm:text-sm mt-1">
                          {contact.name || 'Emergency Responder'}
                        </h5>
                        <p className="text-[11px] text-gray-500 truncate">
                          {contact.designation || 'Emergency Contact'}
                        </p>
                        <p className="font-mono text-xs font-semibold text-gray-700 mt-0.5">
                          📞 {contact.phone}
                        </p>
                      </div>

                      {/* Immediate Call & WhatsApp Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 pt-2 mt-2 border-t border-gray-100">
                        <a
                          href={`tel:${contact.phone}`}
                          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition"
                          title="Call Contact"
                        >
                          <HiPhone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>

                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition"
                          title="Send SOS message on WhatsApp"
                        >
                          <HiChatBubbleOvalLeftEllipsis className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct Emergency Call Bar */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-200">
              <a
                href="tel:100"
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <HiPhone className="w-4 h-4" />
                <span>Call Police (100)</span>
              </a>
              <a
                href="tel:112"
                className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <HiPhone className="w-4 h-4" />
                <span>Helpline (112)</span>
              </a>
              <a
                href="tel:108"
                className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <HiPhone className="w-4 h-4" />
                <span>Ambulance (108)</span>
              </a>
            </div>

            {/* Dismiss */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={resetSOS}
                className="text-xs text-gray-500 hover:text-gray-800 underline font-medium cursor-pointer"
              >
                Dismiss alert view
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
