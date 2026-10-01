"use client";

import { useState, useEffect, useRef } from "react";

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  label 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: {label: string, value: string}[], 
  label: string 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dropdown kapandığında aramayı sıfırla
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <div 
        className="w-full border border-gray-300 rounded-md bg-white p-2 text-sm flex justify-between items-center cursor-pointer hover:border-slate-500 transition-colors h-[38px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-semibold text-gray-700 truncate mr-2">{selectedOption?.label || "Seçiniz"}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100">
          
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none"
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <li 
                  key={option.value}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-2 ${value === option.value ? 'bg-slate-50 font-bold text-slate-700' : 'text-gray-700 font-medium'}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {value === option.value && <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  <span className="truncate">{option.label}</span>
                </li>
              ))
            ) : (
              <li className="px-3 py-4 text-xs text-center text-gray-400 font-medium">Sonuç bulunamadı</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
