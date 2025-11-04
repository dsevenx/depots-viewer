"use client"

import { fetchDomainData } from "@/app/api/FetchDomainAndProdukt";
import { DropdownOption } from "@/constants/index";
import { useEditMode } from "@/contexts/EditModeContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { setFieldValueWithEchteEingabe } from "@/constants/fieldConfig";
import { useGlobalProductData } from "@/hooks/useGlobalProductData";
import { getDomainVersion } from "@/hooks/useDomainServices";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export interface DropDownProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  fieldKey?: string; // Für echteEingabe tracking
  defaultValue?: string; // Fallback wenn value noch leer ist
  disabled?: boolean;
  domainId?: string; // Optional wenn options direkt übergeben werden
  placeholder?: string;
  hideLabel?: boolean;
  allowInViewMode?: boolean; // Erlaubt Interaktion auch bei isEditMode=false
  fixDomValue?: string; // Fester Wert für Domain-Value (überschreibt alles andere)
  fixDisplayValue?: string; // Fester Anzeige-Text (überschreibt alles andere)
  options?: DropdownOption[]; // Direkte Optionen ohne Domain-System
  onFieldComplete?: (fieldKey: string) => void; // Backend-Sync Callback
}

export const DropDown: React.FC<DropDownProps> = ({
  value = '',
  onChange,
  label = '',
  fieldKey,
  defaultValue,
  disabled = false,
  domainId,
  placeholder = '',
  hideLabel = false,
  allowInViewMode = false,
  fixDomValue,
  fixDisplayValue,
  options: directOptions,
  onFieldComplete
}) => {
  const { isEditMode } = useEditMode();
  const { preferences } = useUserPreferences();
  const { isLoaded: isProductDataLoaded, productDataVersion } = useGlobalProductData();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [lastDomainVersion, setLastDomainVersion] = useState<number>(-1); // Start mit -1 um ersten Load zu triggern

  // Effektiv disabled wenn EditMode aus ist (außer allowInViewMode) oder prop disabled ist
  // Bei fixDomValue ist immer disabled
  const isEffectivelyDisabled = (!isEditMode && !allowInViewMode) || disabled || !!fixDomValue;

  // Berechne den effektiven Wert: fixDomValue > echteEingabe > defaultValue > bisheriger Wert
  const getEffectiveValue = (): string => {
    // Bei fixDomValue: verwende diesen Wert
    if (fixDomValue !== undefined) {
      return fixDomValue;
    }
    
    // Wenn echte Eingabe vorhanden ist (value nicht leer), verwende value
    if (value && value.trim() !== '') {
      return value;
    }
    
    // Fallback auf defaultValue wenn vorhanden
    if (defaultValue && defaultValue.trim() !== '') {
      return defaultValue;
    }
    
    // Sonst bisherigen Wert beibehalten
    return value || '';
  };

  const effectiveValue = getEffectiveValue();

  // Wrapper für onChange mit echteEingabe tracking
  const handleValueChange = (newValue: string) => {
    if (fieldKey) {
      setFieldValueWithEchteEingabe(fieldKey, newValue, onChange);
    } else {
      onChange(newValue);
    }
  };
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Position calculation for portal
  const calculatePortalPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      
      // Check if input is visible in viewport
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight && 
                       rect.right > 0 && rect.left < window.innerWidth;
      
      if (!isVisible) {
        // Close dropdown if input field scrolled out of view
        setIsOpen(false);
        return;
      }
      
      // Check available space above and below
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 240; // Approximate dropdown height (max-h-60)
      const menuHeight = 120; // Top menu height
      
      // Determine position: above or below
      const shouldShowAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
      
      let dropdownTop;
      if (shouldShowAbove) {
        // Position dropdown so its bottom edge is just above the input field
        // Use smaller estimate: each option ~32px + padding
        const actualDropdownHeight = Math.min(240, Math.max(filteredOptions.length * 32 + 16, 60));
        dropdownTop = rect.top - actualDropdownHeight - 4;
      } else {
        dropdownTop = rect.bottom + 4;
      }
      
      // Check if dropdown would overlap with top menu area or go outside viewport
      if (dropdownTop < menuHeight || dropdownTop > window.innerHeight - 100) {
        // Dropdown would overlap with menu or be outside viewport, close it
        setIsOpen(false);
        return;
      }
      
      // Position dropdown
      setPortalPosition({
        top: dropdownTop,
        left: rect.left,
        width: Math.max(200, rect.width)
      });
    }
  };

  // Open dropdown handler
  const handleOpenDropdown = () => {
    if (!isEffectivelyDisabled) {
      calculatePortalPosition();
      setIsOpen(true);
    }
  };

  // Prüfe auf Domain-Version-Änderungen und triggere Re-Load
  // WICHTIG: Polling-Mechanismus um domainVersion-Änderungen zu erkennen
  React.useEffect(() => {
    // Skip bei fixDomValue oder directOptions (diese brauchen kein Domain-Loading)
    if (fixDomValue || directOptions) {
      return;
    }

    // Skip wenn keine domainId
    if (!domainId) {
      return;
    }

    // Polling: Prüfe alle 50ms ob sich die Version geändert hat
    const intervalId = setInterval(() => {
      const currentVersion = getDomainVersion();

      if (currentVersion !== lastDomainVersion) {
        const isInitialLoad = lastDomainVersion === -1;

        if (isInitialLoad) {
          console.log(`🆕 DropDown (${domainId}): Initial load, Domain Version = ${currentVersion}`);
        } else {
          console.log(`🔄 DropDown (${domainId}): Domain-Version geändert (${lastDomainVersion} → ${currentVersion})`);
        }

        setLastDomainVersion(currentVersion);

        // Lade Optionen mit kleiner Verzögerung
        setLoading(true);
        setTimeout(async () => {
          try {
            const data = await fetchDomainData(domainId);
            setOptions(data);
            console.log(`✅ DropDown (${domainId}): ${data.length} Optionen geladen`);

            if (effectiveValue) {
              const selectedOption = data.find(option => option.value === effectiveValue);
              setSelectedLabel(selectedOption?.label || effectiveValue);
            }
          } catch (error) {
            console.error(`❌ DropDown (${domainId}): Error loading domain data:`, error);
          } finally {
            setLoading(false);
          }
        }, 100); // 100ms Verzögerung um sicherzustellen dass globalDomaenen aktualisiert ist
      }
    }, 50); // Prüfe alle 50ms

    // Cleanup
    return () => clearInterval(intervalId);
  }, [domainId, effectiveValue, fixDomValue, directOptions, lastDomainVersion]);

  React.useEffect(() => {
    // Bei fixDomValue: verwende direkt die festen Werte und überspringe Domain-Loading
    if (fixDomValue !== undefined && fixDisplayValue !== undefined) {
      setOptions([{ value: fixDomValue, label: fixDisplayValue, classId: "fixed-option" }]);
      setSelectedLabel(fixDisplayValue);
      setLoading(false);
      //console.log(`🔒 DropDown: Verwende feste Werte - Value: ${fixDomValue}, Display: ${fixDisplayValue}`);
      return;
    }

    // Bei directOptions: verwende direkte Optionen ohne Domain-Loading
    if (directOptions && directOptions.length > 0) {
      setOptions(directOptions);
      setLoading(false);
      //console.log(`🎯 DropDown: Verwende direkte Optionen (${directOptions.length} Optionen)`);

      if (effectiveValue) {
        const selectedOption = directOptions.find(option => option.value === effectiveValue);
        setSelectedLabel(selectedOption?.label || effectiveValue);
      }
      return;
    }

    // Für Domain-basierte DropDowns: Polling-useEffect handled das Laden
    // Dieser useEffect wird nur noch für fixDomValue und directOptions verwendet
  }, [fixDomValue, fixDisplayValue, directOptions, effectiveValue]);

  // Wichtig: Aktualisiere selectedLabel wenn effectiveValue sich ändert (z.B. durch PopUp-Reset)
  React.useEffect(() => {
    // Skip wenn fixDisplayValue gesetzt ist (wird von anderem useEffect gehandhabt)
    if (fixDisplayValue !== undefined) {
      return;
    }

    // Suche das Label für den aktuellen effectiveValue in den geladenen Optionen
    if (options.length > 0) {
      if (effectiveValue && effectiveValue.trim() !== '') {
        const selectedOption = options.find(option => option.value === effectiveValue);
        const newLabel = selectedOption?.label || effectiveValue;

        // Nur updaten wenn sich das Label wirklich geändert hat
        if (newLabel !== selectedLabel) {
          console.log(`🔄 DropDown (${domainId}): selectedLabel aktualisiert von "${selectedLabel}" zu "${newLabel}"`);
          setSelectedLabel(newLabel);
        }
      } else {
        // effectiveValue ist leer → setze selectedLabel zurück
        if (selectedLabel !== '') {
          console.log(`🔄 DropDown (${domainId}): selectedLabel zurückgesetzt (effectiveValue ist leer)`);
          setSelectedLabel('');
        }
      }
    }
  }, [effectiveValue, options, fixDisplayValue, selectedLabel, domainId]);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOptionSelect = (option: DropdownOption): void => {
    handleValueChange(option.value);
    setSelectedLabel(option.label);
    setSearchTerm('');
    setIsOpen(false);
    
    // Backend-Sync Callback nach Option-Auswahl
    if (onFieldComplete && fieldKey && isEditMode && !isEffectivelyDisabled) {
      console.log(`🔄 DropDown: Field completion for ${fieldKey}`);
      onFieldComplete(fieldKey);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    
    if (!isOpen) {
      handleOpenDropdown();
    }
  };

  const handleInputFocus = (): void => {
    if (!isEffectivelyDisabled) {
      handleOpenDropdown();
      setSearchTerm('');
    }
  };

  const handleDropdownToggle = (): void => {
    if (!isEffectivelyDisabled) {
      if (!isOpen) {
        handleOpenDropdown();
        inputRef.current?.focus();
      } else {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
  };

  // Handle outside clicks and scrolling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        // Use requestAnimationFrame for smoother positioning
        requestAnimationFrame(() => {
          calculatePortalPosition();
        });
      }
    };

    const handleResize = () => {
      if (isOpen) {
        calculatePortalPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Add scroll listeners to window and all scrollable parent elements
      window.addEventListener('scroll', handleScroll, true);
      document.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      // Find and add listeners to all scrollable parent containers
      const scrollableParents: Element[] = [];
      let element = inputRef.current?.parentElement;
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        if (style.overflow === 'auto' || style.overflow === 'scroll' || 
            style.overflowY === 'auto' || style.overflowY === 'scroll' ||
            style.overflowX === 'auto' || style.overflowX === 'scroll') {
          scrollableParents.push(element);
          element.addEventListener('scroll', handleScroll);
        }
        element = element.parentElement;
      }
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        document.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
        
        // Remove listeners from scrollable parents
        scrollableParents.forEach(parent => {
          parent.removeEventListener('scroll', handleScroll);
        });
      };
    }
  }, [isOpen]);

  const getDisplayValue = (): string => {
    // Bei fixDisplayValue: verwende diesen Wert (außer wenn Dropdown offen und gesucht wird)
    if (fixDisplayValue !== undefined) {
      return isOpen ? searchTerm : fixDisplayValue;
    }
    
    if (isOpen) {
      return searchTerm;
    }
    return selectedLabel || '';
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Label - nur anzeigen wenn vorhanden und nicht versteckt */}
      {label && !hideLabel && (
        <label className={`
          block text-sm font-medium text-gray-700 mb-1 flex items-start gap-2 leading-5
          ${preferences.labelMode === 'compact' ? 'min-h-[1.25rem]' : 'min-h-[1.75rem]'}
        `}>
          <span className={`
            flex-1 
            ${preferences.labelMode === 'compact' 
              ? 'truncate' 
              : 'break-words hyphens-auto'
            }
          `} title={preferences.labelMode === 'compact' ? label : undefined}>
            {label}
          </span>
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={getDisplayValue()}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={isEffectivelyDisabled}
          className={`
            w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            pr-10
            ${isEffectivelyDisabled 
              ? 'bg-gray-100 cursor-not-allowed text-gray-500' 
              : 'bg-white hover:border-gray-400'
            }
            transition-colors duration-200
          `}
          placeholder={isOpen ? placeholder : (!selectedLabel ? placeholder : '')}
        />
        
        <button
          type="button"
          onClick={handleDropdownToggle}
          disabled={isEffectivelyDisabled}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded disabled:cursor-not-allowed"
        >
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {/* Dropdown Options via Portal */}
      {isOpen && !isEffectivelyDisabled && isMounted && portalPosition && (
        createPortal(
          <div 
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto"
            style={{
              top: `${portalPosition?.top}px`,
              left: `${portalPosition?.left}px`,
              width: `${portalPosition?.width}px`
            }}
          >
            {loading ? (
              <div className="p-3 text-center text-gray-500">
                Laden...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-gray-500">
                Keine Optionen gefunden
              </div>
            ) : (
              <>
                {searchTerm && (
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                    {filteredOptions.length} von {options.length} Optionen
                  </div>
                )}
                
                <div className="py-1">
                  {filteredOptions.map((option, index) => (
                    <button
                      key={`${option.value}-${index}`}
                      onClick={() => handleOptionSelect(option)}
                      className={`
                        w-full text-left px-3 py-2 text-sm hover:bg-gray-100 
                        focus:bg-gray-100 focus:outline-none transition-colors
                        ${option.value === effectiveValue ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>,
          document.body
        )
      )}
    </div>
  );
};