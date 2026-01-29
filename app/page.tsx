"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "converting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Load state from localStorage on component mount
  useEffect(() => {
    const savedFileData = localStorage.getItem("excalidraw-pdf-file");
    const savedStatus = localStorage.getItem("excalidraw-pdf-status");
    const savedError = localStorage.getItem("excalidraw-pdf-error");

    if (savedFileData) {
      try {
        const fileData = JSON.parse(savedFileData);
        // Create a File object from saved data
        const file = new File([fileData.content], fileData.name, {
          type: fileData.type
        });
        setFile(file);
      } catch (error) {
        console.error("Failed to load saved file:", error);
        localStorage.removeItem("excalidraw-pdf-file");
      }
    }

    if (savedStatus) {
      setStatus(savedStatus as "idle" | "converting" | "success" | "error");
    }

    if (savedError) {
      setErrorMessage(savedError);
    }
  }, []);

  // Save file state to localStorage whenever it changes
  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = {
          name: file.name,
          type: file.type,
          content: reader.result
        };
        localStorage.setItem("excalidraw-pdf-file", JSON.stringify(fileData));
      };
      reader.readAsText(file);
    } else {
      localStorage.removeItem("excalidraw-pdf-file");
    }
  }, [file]);

  // Save status state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("excalidraw-pdf-status", status);
  }, [status]);

  // Save error message to localStorage whenever it changes
  useEffect(() => {
    if (errorMessage) {
      localStorage.setItem("excalidraw-pdf-error", errorMessage);
    } else {
      localStorage.removeItem("excalidraw-pdf-error");
    }
  }, [errorMessage]);

  const handleFile = (selectedFile: File | undefined) => {
    if (selectedFile && selectedFile.name.endsWith(".excalidraw")) {
      setFile(selectedFile);
      setStatus("idle");
      setErrorMessage("");
    } else {
      setErrorMessage("Please upload a valid .excalidraw file.");
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setStatus("converting");
    setErrorMessage("");

    try {
      const text = await file.text();
      const response = await fetch("/api/convert", {
        method: "POST",
        body: text,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Conversion failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(".excalidraw", ".pdf");
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="page-wrapper">
      {/* --- NAVBAR --- */}
      <nav className="navbar">
        <div className="logo">
          <span style={{ color: "var(--primary)", fontSize: "1.8rem" }}>✦</span>
          <span>Excalidraw to PDF</span>
        </div>
        <div className="credits">
          Created by{" "}
          <a
            href="https://www.linkedin.com/in/krishgupta7/"
            target="_blank"
            className="link"
          >
            Krish
          </a>
          {" & "}
          <a
            href="https://www.linkedin.com/in/sahilmishra03/"
            target="_blank"
            className="link"
          >
            Sahil
          </a>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="main-container">
        {/* HEADER SECTION */}
        <div className="header-section">
          <h1 className="hero-title">
            Turn your <span className="highlight">sketches</span>
            <br />
            into polished documents.
          </h1>
          <p className="hero-subtitle">
            Simple, free, and secure conversion.
            <br />
            Keep the hand-crafted feel, lose the hassle.
          </p>
        </div>

        {/* UPLOAD "SKETCHPAD" SECTION */}
        <div className="upload-wrapper">
          {/* Decorative Badge (Replaces Arrow) */}
          {!file && <div className="badge-decoration">Drag & Drop Here</div>}

          <div className="sketchpad-card">
            <div
              className={`drop-area ${dragActive ? "active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0])
                  handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                type="file"
                accept=".excalidraw"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />

              {/* LOGIC: SHOW UPLOAD UI OR FILE UI */}
              {!file ? (
                <>
                  <div className="icon-large">📄</div>
                  <h3 className="drop-title hand-font">
                    Click or drag a file here
                  </h3>
                  <p className="drop-subtitle">
                    Supports .excalidraw files
                  </p>
                </>
              ) : (
                <div className="file-state">
                  <div className="file-info">
                    <span>{file.name}</span>
                    <button
                      className="btn-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConvert();
                    }}
                    disabled={status === "converting"}
                  >
                    {status === "converting"
                      ? "Converting..."
                      : status === "success"
                        ? "Converted Successfully 🎉"
                        : "Convert to PDF"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* STATUS MESSAGES */}
          {errorMessage && (
            <div className="status-msg error">⚠️ {errorMessage}</div>
          )}
          {status === "success" && (
            <div className="status-msg success">
              File downloaded successfully!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
