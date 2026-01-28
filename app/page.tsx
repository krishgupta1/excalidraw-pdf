// app/page.js
'use client';
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      // Read file as text to send raw content
      const text = await file.text();

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: text,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Conversion failed');
      }

      // Create a blob from the PDF response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.excalidraw', '.pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Excalidraw to PDF</h1>
      <p>Select your <code>.excalidraw</code> file to convert.</p>
      
      <div style={{ marginTop: '20px' }}>
        <input 
          type="file" 
          accept=".excalidraw" 
          onChange={handleFileUpload} 
          disabled={loading}
        />
      </div>

      {loading && <p style={{ color: 'blue' }}>Converting... (this may take a few seconds)</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}