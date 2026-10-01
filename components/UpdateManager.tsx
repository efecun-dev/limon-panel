"use client";

import { useState, useEffect } from "react";

export default function UpdateManager() {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "downloading" | "downloaded" | "error">("idle");
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isElectron, setIsElectron] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setIsElectron(true);
      const api = (window as any).electronAPI;

      api.onUpdateAvailable(() => setStatus("available"));
      api.onUpdateNotAvailable(() => {
        setStatus("idle");
        alert("Uygulamanız zaten güncel!");
      });
      api.onDownloadProgress((_event: any, progressObj: any) => {
        setStatus("downloading");
        if (progressObj && progressObj.percent) {
          setProgress(Math.round(progressObj.percent));
        }
      });
      api.onUpdateDownloaded(() => setStatus("downloaded"));
      api.onError((_event: any, err: string) => {
        setStatus("error");
        setErrorMsg(err);
      });
    }
  }, []);

  const checkForUpdates = () => {
    if (isElectron) {
      setStatus("checking");
      (window as any).electronAPI.checkForUpdates();
    }
  };

  const installUpdate = () => {
    if (isElectron) {
      (window as any).electronAPI.installUpdate();
    }
  };

  if (!isElectron) return null;

  return (
    <div className="flex items-center gap-3">
      {status === "idle" && (
        <button
          onClick={checkForUpdates}
          className="text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded border border-gray-600 transition-colors"
        >
          Güncellemeleri Denetle
        </button>
      )}

      {status === "checking" && (
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          <svg className="animate-spin h-3.5 w-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Kontrol ediliyor...
        </span>
      )}

      {status === "available" && (
        <span className="text-xs text-blue-400 font-medium animate-pulse">
          Güncelleme bulundu, hazırlanıyor...
        </span>
      )}

      {status === "downloading" && (
        <div className="flex items-center gap-2 w-32">
          <span className="text-[10px] text-gray-400 font-medium w-8 text-right">{progress}%</span>
          <div className="w-full bg-gray-800 rounded-full h-1.5 border border-gray-700">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {status === "downloaded" && (
        <button
          onClick={installUpdate}
          className="text-xs font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded border border-green-500 transition-colors shadow-[0_0_10px_rgba(34,197,94,0.3)] animate-pulse"
        >
          Yeniden Başlat ve Güncelle
        </button>
      )}

      {status === "error" && (
        <span className="text-xs text-red-400 truncate max-w-[150px]" title={errorMsg}>
          Hata: {errorMsg}
        </span>
      )}
    </div>
  );
}
