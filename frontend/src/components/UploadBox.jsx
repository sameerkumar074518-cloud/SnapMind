import { useRef, useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  RotateCcw,
} from "lucide-react";

function UploadBox({ onUploadComplete }) {
  const inputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFile = (file) => {
    if (!file) return;

    setErrorMessage("");
    setUploadSuccess(false);

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Image must be smaller than 10MB.");
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleChange = (event) => {
    handleFile(event.target.files[0]);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];

    handleFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setUploadSuccess(false);
    setErrorMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const uploadScreenshot = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadSuccess(false);
    setErrorMessage("");

    const formData = new FormData();

    formData.append("screenshot", selectedFile);

    try {
      const token = localStorage.getItem("snapmind_token");

      const response = await fetch(
        "http://localhost:5000/api/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log("SnapMind response:", data);

        setUploadSuccess(true);

        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        setErrorMessage(
          data.message || "Something went wrong while uploading."
        );
      }
    } catch (error) {
      console.error("Upload error:", error);

      setErrorMessage(
        "Could not connect to SnapMind backend."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-section">
      {/* Upload Header */}
      <div className="upload-header">
        <p className="eyebrow">SNAPMIND LIBRARY</p>

        <h2>Save something you want to remember.</h2>

        <p>
          Upload a screenshot and SnapMind will understand,
          organize, and remember it for you.
        </p>
      </div>

      {/* No file selected */}
      {!selectedFile && !uploadSuccess && (
        <div
          className={`upload-box ${
            isDragging ? "upload-box-dragging" : ""
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-icon">
            <Upload size={25} />
          </div>

          <h3>
            {isDragging
              ? "Drop your screenshot here"
              : "Upload a screenshot"}
          </h3>

          <p>
            Drag & drop your image here or click to browse
          </p>

          <span>
            PNG, JPG, JPEG • Maximum 10MB
          </span>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            hidden
          />
        </div>
      )}

      {/* Preview */}
      {selectedFile && !uploadSuccess && (
        <div className="preview-card">
          <div className="preview-top">
            <div>
              <ImageIcon size={18} />

              <span>
                {selectedFile.name}
              </span>
            </div>

            {!isUploading && (
              <button
                type="button"
                onClick={removeFile}
                aria-label="Remove image"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="preview-image-container">
            <img
              src={preview}
              alt="Selected screenshot"
              className="image-preview"
            />

            {isUploading && (
              <div className="upload-overlay">
                <div className="upload-loading">
                  <Loader2
                    size={30}
                    className="loading-spinner"
                  />

                  <strong>Understanding your screenshot...</strong>

                  <span>
                    Uploading, reading and processing
                  </span>
                </div>
              </div>
            )}
          </div>

          {!isUploading && (
            <>
              <button
                className="analyze-btn"
                onClick={uploadScreenshot}
              >
                <Sparkles size={17} />
                Analyze Screenshot
              </button>

              {errorMessage && (
                <div className="upload-error">
                  {errorMessage}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Success */}
      {uploadSuccess && (
        <div className="upload-success-card">
          <div className="success-icon">
            <CheckCircle2 size={32} />
          </div>

          <h3>Screenshot saved successfully</h3>

          <p>
            SnapMind has received your screenshot and
            processed its content.
          </p>

          <div className="success-file">
            <ImageIcon size={16} />
            <span>{selectedFile?.name}</span>
          </div>

          <button
            className="upload-again-btn"
            onClick={removeFile}
          >
            <RotateCcw size={16} />
            Upload another
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadBox;