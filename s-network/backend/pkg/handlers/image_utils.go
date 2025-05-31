package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
)

// ValidImageFormats defines the allowed image formats
var ValidImageFormats = map[string][]byte{
	"image/jpeg": {0xFF, 0xD8, 0xFF},
	"image/png":  {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
	"image/gif":  {0x47, 0x49, 0x46},
}

// ValidateImageFile validates if the uploaded file is a valid JPEG, PNG, or GIF image
func ValidateImageFile(file multipart.File, header *multipart.FileHeader) error {
	// Check if filename is provided
	if header.Filename == "" {
		return fmt.Errorf("filename is empty")
	}

	// Check file extension (case insensitive)
	filename := strings.ToLower(strings.TrimSpace(header.Filename))
	hasValidExtension := strings.HasSuffix(filename, ".jpg") || 
	                   strings.HasSuffix(filename, ".jpeg") || 
	                   strings.HasSuffix(filename, ".png") || 
	                   strings.HasSuffix(filename, ".gif")
	
	if !hasValidExtension {
		return fmt.Errorf("invalid file extension. Only JPEG (.jpg, .jpeg), PNG (.png), and GIF (.gif) files are allowed. Got: %s", filename)
	}

	// Check file size
	if header.Size == 0 {
		return fmt.Errorf("file is empty")
	}

	// Check file size limit (10MB)
	const maxFileSize = 10 * 1024 * 1024 // 10MB
	if header.Size > maxFileSize {
		return fmt.Errorf("file too large. Maximum size is 10MB, got %d bytes", header.Size)
	}

	// Reset file pointer to beginning
	file.Seek(0, 0)

	// Read the first 512 bytes to detect content type
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return fmt.Errorf("failed to read file: %v", err)
	}

	if n == 0 {
		return fmt.Errorf("file appears to be empty or unreadable")
	}

	// Detect MIME type
	contentType := http.DetectContentType(buffer[:n])
	
	// Check if content type is allowed
	allowedTypes := []string{"image/jpeg", "image/png", "image/gif"}
	isValidType := false
	for _, validType := range allowedTypes {
		if contentType == validType {
			isValidType = true
			break
		}
	}
	
	if !isValidType {
		return fmt.Errorf("invalid file type: %s. Only JPEG, PNG, and GIF images are allowed", contentType)
	}

	// Additional validation: check file signature (magic bytes) only for known types
	if signature, exists := ValidImageFormats[contentType]; exists {
		// Check if file starts with the correct signature
		if len(buffer) < len(signature) {
			return fmt.Errorf("file too small or corrupted")
		}

		for i, b := range signature {
			if buffer[i] != b {
				return fmt.Errorf("invalid file signature for %s format", contentType)
			}
		}
	}

	// Reset file pointer back to beginning for subsequent operations
	file.Seek(0, 0)

	return nil
}

// GetImageMimeType returns the MIME type of the validated image
func GetImageMimeType(file multipart.File) (string, error) {
	// Reset file pointer to beginning
	file.Seek(0, 0)

	// Read the first 512 bytes to detect content type
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("failed to read file: %v", err)
	}

	// Detect MIME type
	contentType := http.DetectContentType(buffer[:n])
	
	// Reset file pointer back to beginning
	file.Seek(0, 0)

	return contentType, nil
} 