'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file selection
  const handleFile = (selectedFile: File | undefined) => {
    if (selectedFile && selectedFile.name.endsWith('.excalidraw')) {
      setFile(selectedFile);
      setStatus('idle');
      setErrorMessage('');
    } else {
      setErrorMessage('Please upload a valid .excalidraw file');
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    setStatus('converting');
    setErrorMessage('');

    try {
      const text = await file.text();

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: text,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Conversion failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.excalidraw', '.pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000); // Reset after 3s
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An unexpected error occurred');
      setStatus('error');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Excalidraw to PDF</h1>
        <p className="subtitle">Convert your sketches into crisp PDFs instantly.</p>

        {/* Drag & Drop Zone */}
        <div 
          className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="icon">📄</span>
          <p style={{ margin: 0, fontWeight: 500 }}>
            {file ? 'Change File' : 'Click or Drag file here'}
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Supports .excalidraw files
          </p>
          <input 
            type="file" 
            accept=".excalidraw" 
            ref={fileInputRef}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0])}
            className="hidden-input"
          />
        </div>

        {/* File Details (Visible only when file selected) */}
        {file && (
          <div className="file-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <span style={{ fontSize: '1.2rem' }}>📝</span>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Action Button */}
        <button 
          className="btn" 
          onClick={handleConvert}
          disabled={!file || status === 'converting'}
        >
          {status === 'converting' ? (
            <>
              <span className="spinner"></span> Converting...
            </>
          ) : status === 'success' ? (
            'Downloaded! 🎉'
          ) : (
            'Convert to PDF'
          )}
        </button>

        {/* Error Message */}
        {errorMessage && (
          <div className="error-msg">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}