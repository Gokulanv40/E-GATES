import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export const useSOS = () => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState('Other');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelCountdown, setCancelCountdown] = useState(5);
  const [isSending, setIsSending] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const [lastAlert, setLastAlert] = useState(null);

  const holdIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const holdStartTimeRef = useRef(null);
  const HOLD_DURATION_MS = 3000;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const startHold = useCallback(() => {
    if (showCancel || showTypeSelector || isSending) return;

    setIsHolding(true);
    setHoldProgress(0);
    holdStartTimeRef.current = Date.now();

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
      setHoldProgress(progress);

      if (elapsed >= HOLD_DURATION_MS) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        setIsHolding(false);
        setHoldProgress(100);

        // Haptic feedback if supported on mobile
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }

        // Open emergency type selector modal
        setShowTypeSelector(true);
      }
    }, 40);
  }, [showCancel, showTypeSelector, isSending]);

  const releaseHold = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const getCoordinates = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        resolve({ latitude: null, longitude: null });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          // Return null coords so emergency can still dispatch without blocking
          resolve({ latitude: null, longitude: null });
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        }
      );
    });
  };

  const dispatchSOS = useCallback(async (emergencyType) => {
    setIsSending(true);
    try {
      const coords = await getCoordinates();
      const payload = {
        emergency_type: emergencyType || 'Other',
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      const response = await api.post('/sos/trigger', payload);
      const alertData = response.data.data || response.data;
      setLastAlert(alertData);
      setIsTriggered(true);
      setShowCancel(false);
      setShowTypeSelector(false);

      toast.error('EMERGENCY SOS ALERT DISPATCHED TO ASSOCIATION!', {
        duration: 7000,
        style: {
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      });
      return alertData;
    } catch (error) {
      console.error('Failed to trigger SOS:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to send SOS alert. Please call emergency services directly!'
      );
      throw error;
    } finally {
      setIsSending(false);
    }
  }, []);

  // When type is selected, start 5 second countdown before final dispatch
  const selectTypeAndStartCountdown = useCallback((type) => {
    setSelectedType(type);
    setShowTypeSelector(false);
    setShowCancel(true);
    setCancelCountdown(5);

    let secondsLeft = 5;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCancelCountdown(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        dispatchSOS(type);
      }
    }, 1000);
  }, [dispatchSOS]);

  const cancelSOS = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setShowCancel(false);
    setShowTypeSelector(false);
    setIsHolding(false);
    setHoldProgress(0);
    setCancelCountdown(5);
    toast('Emergency SOS cancelled', { icon: '🛑' });
  }, []);

  const resetSOS = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setShowCancel(false);
    setShowTypeSelector(false);
    setIsHolding(false);
    setHoldProgress(0);
    setIsTriggered(false);
    setIsSending(false);
  }, []);

  return {
    isHolding,
    holdProgress,
    showTypeSelector,
    setShowTypeSelector,
    selectedType,
    setSelectedType,
    showCancel,
    cancelCountdown,
    isSending,
    isTriggered,
    lastAlert,
    startHold,
    releaseHold,
    selectTypeAndStartCountdown,
    triggerSOS: dispatchSOS,
    cancelSOS,
    resetSOS,
  };
};

export default useSOS;
