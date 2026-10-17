import React from 'react';
import {
  HiExclamationTriangle,
  HiPhone,
  HiShieldCheck,
  HiFire,
  HiHeart,
  HiShieldExclamation,
  HiXMark,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import { useSOS } from '../../hooks/useSOS';
import Modal from '../common/Modal';

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

  // Floating SOS button is only displayed for resident members
  if (user?.role !== 'member') {
    return null;
  }

  const emergencyTypes = [
    { key: 'Medical', label: t('sos_type_medical') || 'Medical Emergency', icon: HiHeart, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { key: 'Fire', label: t('sos_type_fire') || 'Fire Incident', icon: HiFire, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { key: 'Theft/Intruder', label: t('sos_type_theft') || 'Theft / Intruder', icon: HiShieldExclamation, color: 'text-red-600 bg-red-50 border-red-200' },
    { key: 'Women Safety', label: t('sos_type_women') || 'Women Safety', icon: HiShieldCheck, color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { key: 'Other', label: t('sos_type_other') || 'General Emergency', icon: HiExclamationTriangle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  ];

  return (
    <>
      {/* Floating SOS Action Button (Immediate Reaction on Click) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-center">
        <div className="relative group">
          {/* Button Element */}
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
        title={t('sos_select_type') || '🚨 Emergency SOS Dispatch'}
        size="md"
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-600">
            Click any situation below to immediately dispatch emergency distress to association administrators and neighbors:
          </p>

          <button
            type="button"
            onClick={() => triggerSOS('Immediate Distress')}
            disabled={isSending}
            className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
          >
            <HiShieldExclamation className="w-5 h-5 text-white" />
            <span>🚨 SEND IMMEDIATE SOS (DISPATCH NOW)</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {emergencyTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => triggerSOS(type.key)}
                  disabled={isSending}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left font-semibold text-sm transition hover:scale-[1.02] shadow-sm cursor-pointer active:scale-95 ${type.color}`}
                >
                  <Icon className="w-6 h-6 flex-shrink-0" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Immediate phone call:</span>
            <div className="flex gap-2">
              <a
                href="tel:100"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition"
              >
                <HiPhone className="w-3.5 h-3.5" />
                <span>100 (Police)</span>
              </a>
              <a
                href="tel:112"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 font-semibold rounded-lg hover:bg-red-100 transition"
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
                className="w-full py-3.5 px-6 bg-gray-900 hover:bg-black text-white font-bold text-base rounded-xl transition shadow-lg"
              >
                {t('sos_cancel_button')} (False Alarm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatched Confirmation Modal */}
      {isTriggered && (
        <Modal
          isOpen={isTriggered}
          onClose={resetSOS}
          title="SOS Distress Signal Active"
          size="md"
        >
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>

            <h4 className="text-xl font-bold text-gray-900">
              {t('sos_alert_sent')}
            </h4>

            <p className="text-sm text-gray-600">
              Association emergency responders and community security have received your location. Please remain calm and in a safe place.
            </p>

            {lastAlert && (
              <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-500 font-mono text-left border border-gray-200">
                <p>Alert ID: #{lastAlert.id || 'N/A'}</p>
                <p>Emergency Type: {lastAlert.emergency_type || 'General'}</p>
                <p>Coordinates: {lastAlert.latitude || 'GPS Pending'}, {lastAlert.longitude || ''}</p>
                <p>Status: {lastAlert.status || 'Triggered'}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="tel:100"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <HiPhone className="w-5 h-5" />
                <span>{t('sos_call_police')} (100)</span>
              </a>
              <a
                href="tel:112"
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <HiPhone className="w-5 h-5" />
                <span>{t('sos_call_112')} (112)</span>
              </a>
            </div>

            <button
              type="button"
              onClick={resetSOS}
              className="mt-3 text-xs text-gray-500 hover:text-gray-800 underline block mx-auto"
            >
              Dismiss alert view
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
