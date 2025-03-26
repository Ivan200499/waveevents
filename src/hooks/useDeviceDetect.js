import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native-web';
import responsiveUtils from '../utils/responsiveUtils';

/**
 * Hook per rilevare il tipo di dispositivo e le sue dimensioni.
 * Fornisce informazioni utili per adattare l'interfaccia in base al dispositivo.
 * 
 * @returns {Object} Informazioni sul dispositivo
 */
const useDeviceDetect = () => {
  const [deviceInfo, setDeviceInfo] = useState(() => responsiveUtils.getDeviceInfo());
  const [orientation, setOrientation] = useState(
    () => deviceInfo.height > deviceInfo.width ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    // Funzione per aggiornare le dimensioni quando cambia la finestra
    const handleDimensionChange = ({ width, height }) => {
      const newOrientation = height > width ? 'portrait' : 'landscape';
      
      setDeviceInfo(responsiveUtils.getDeviceInfo());
      setOrientation(newOrientation);
      
      // Aggiorna le meta viewport per dispositivi mobili
      updateViewportMeta(width);
    };

    // Funzione per aggiornare i meta tag del viewport per ottimizzazione mobile
    const updateViewportMeta = (width) => {
      // Solo per dispositivi mobili
      if (width <= 768) {
        let metaViewport = document.querySelector('meta[name="viewport"]');
        if (!metaViewport) {
          metaViewport = document.createElement('meta');
          metaViewport.name = 'viewport';
          document.head.appendChild(metaViewport);
        }
        
        // Per iPhone 5 e dispositivi molto piccoli
        if (width <= 320) {
          metaViewport.content = 'width=device-width, initial-scale=0.86, maximum-scale=5.0, viewport-fit=cover, user-scalable=yes';
        } else {
          metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover, user-scalable=yes';
        }
      }
    };

    // Imposta il meta tag iniziale
    updateViewportMeta(deviceInfo.width);

    // Aggiungi il listener per i cambiamenti di dimensione
    const unsubscribeDimensions = responsiveUtils.addDimensionListener(({ width, height }) => {
      handleDimensionChange({ width, height });
    });

    // Cleanup al dismount
    return () => {
      if (unsubscribeDimensions && typeof unsubscribeDimensions.remove === 'function') {
        unsubscribeDimensions.remove();
      }
    };
  }, []);

  // Rileva se è un browser mobile
  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    
    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
    
    // Regex per dispositivi mobili
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    
    return mobileRegex.test(userAgent);
  };

  // Rileva se è un dispositivo touch
  const isTouchDevice = () => {
    if (typeof window === 'undefined') return false;
    
    return (('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0));
  };

  return {
    ...deviceInfo,
    orientation,
    isMobileDevice: isMobileDevice(),
    isTouchDevice: isTouchDevice(),
    isIOS: /iPhone|iPad|iPod/i.test(navigator?.userAgent || ''),
    isAndroid: /Android/i.test(navigator?.userAgent || ''),
  };
};

export default useDeviceDetect; 